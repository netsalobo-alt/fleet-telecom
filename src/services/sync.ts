/**
 * Sincronização dos dados do app com o servidor (SQLite).
 *
 * O resto do app continua lendo e gravando de forma síncrona, como fazia com o
 * localStorage: aqui fica uma cópia em memória de cada coleção, carregada depois do
 * login. Cada gravação atualiza a memória na hora e é enviada ao servidor logo em
 * seguida (agrupando gravações rápidas).
 *
 * Duas pessoas salvando ao mesmo tempo: o servidor recusa a versão antiga (409) e
 * devolve a atual; aqui as mudanças locais são reaplicadas por cima dela, item a item
 * (pelo id), e o envio é repetido. Assim nenhuma das duas perde o que fez.
 *
 * Eventos no window:
 * - fleet:data-changed  dados mudaram por causa de outra pessoa (a tela deve recarregar)
 * - fleet:sync-status   { status: 'salvo' | 'salvando' | 'offline' | 'erro', message? }
 * - fleet:unauthorized  a sessão acabou
 * - fleet:sync-denied   { key, message } o servidor recusou uma gravação
 */

const PREFIX = 'fleet_real_v2_';
const POLL_MS = 20_000;
const FLUSH_DELAY_MS = 250;

/** Chave do app (ex.: fleet_real_v2_vehicles) → coleção no servidor (vehicles). */
export const toCollection = (storageKey: string) =>
  storageKey.startsWith(PREFIX) ? storageKey.slice(PREFIX.length) : storageKey;
const toStorageKey = (collection: string) => PREFIX + collection;

type Status = 'salvo' | 'salvando' | 'offline' | 'erro';

class SyncService {
  /** Valores como texto JSON (assim cada leitura devolve uma cópia nova, como o localStorage). */
  private mem = new Map<string, string>();
  /** Último valor confirmado pelo servidor, para saber o que mudou localmente. */
  private base = new Map<string, string>();
  private ver = new Map<string, number>();
  private dirty = new Set<string>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private inflight = new Map<string, Promise<void>>();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private retryDelay = 2000;
  private status: Status = 'salvo';
  private ready = false;

  isReady() {
    return this.ready;
  }

  has(key: string) {
    return this.mem.has(key);
  }

  read(key: string): string | null {
    return this.mem.get(key) ?? null;
  }

  write(key: string, json: string) {
    if (!this.ready) return;
    if (this.mem.get(key) === json) return;
    this.mem.set(key, json);
    this.dirty.add(key);
    this.setStatus('salvando');
    this.schedule(key, FLUSH_DELAY_MS);
  }

  /** Há gravações ainda não confirmadas pelo servidor? */
  hasPending() {
    return this.dirty.size > 0 || this.inflight.size > 0;
  }

  getStatus() {
    return this.status;
  }

  /** Carrega todas as coleções depois do login. */
  async hydrate() {
    const res = await fetch('/api/data', { credentials: 'same-origin' });
    if (res.status === 401) throw new Error('unauthorized');
    if (!res.ok) throw new Error(`Falha ao carregar os dados (HTTP ${res.status})`);
    const body = (await res.json()) as { colecoes: Record<string, { versao: number; dados: unknown }> };
    this.clear();
    for (const [col, { versao, dados }] of Object.entries(body.colecoes || {})) {
      const key = toStorageKey(col);
      const json = JSON.stringify(dados);
      this.mem.set(key, json);
      this.base.set(key, json);
      this.ver.set(key, versao);
    }
    this.ready = true;
    this.setStatus('salvo');
    this.startPolling();
  }

  /** Logout: esquece tudo o que estava em memória. */
  clear() {
    this.ready = false;
    this.stopPolling();
    this.timers.forEach(t => clearTimeout(t));
    this.timers.clear();
    this.mem.clear();
    this.base.clear();
    this.ver.clear();
    this.dirty.clear();
  }

  /** Envia já tudo o que estiver pendente (ex.: antes de sair). */
  async flushAll() {
    const keys = [...this.dirty];
    await Promise.all(keys.map(k => this.flush(k)));
    await Promise.all([...this.inflight.values()]);
  }

  // ---------------------------------------------------------------------------
  private schedule(key: string, delay: number) {
    const t = this.timers.get(key);
    if (t) clearTimeout(t);
    this.timers.set(
      key,
      setTimeout(() => {
        this.timers.delete(key);
        void this.flush(key);
      }, delay),
    );
  }

  private flush(key: string): Promise<void> {
    // Um envio por coleção de cada vez; o próximo sai quando este terminar
    const running = this.inflight.get(key);
    if (running) return running.then(() => (this.dirty.has(key) ? this.flush(key) : undefined));
    if (!this.dirty.has(key)) return Promise.resolve();

    const p = this.send(key).finally(() => {
      this.inflight.delete(key);
      if (!this.hasPending()) this.setStatus('salvo');
    });
    this.inflight.set(key, p);
    return p;
  }

  private async send(key: string, attempt = 0): Promise<void> {
    const col = toCollection(key);
    const json = this.mem.get(key);
    if (json === undefined) return;
    this.dirty.delete(key);
    const versao = this.ver.get(key) ?? 0;

    let res: Response;
    try {
      res = await fetch(`/api/data/${encodeURIComponent(col)}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: `{"versao":${versao},"dados":${json}}`,
      });
    } catch {
      // Sem conexão: tenta de novo com espera crescente, sem perder a mudança
      this.dirty.add(key);
      this.setStatus('offline');
      this.schedule(key, this.retryDelay);
      this.retryDelay = Math.min(this.retryDelay * 2, 30_000);
      return;
    }
    this.retryDelay = 2000;

    if (res.ok) {
      const body = (await res.json()) as { versao: number; dados?: unknown };
      this.ver.set(key, body.versao);
      if (body.dados !== undefined) {
        // Servidor devolveu a versão limpa (ex.: usuários sem senha)
        const clean = JSON.stringify(body.dados);
        this.base.set(key, clean);
        if (this.mem.get(key) === json) this.mem.set(key, clean);
      } else {
        this.base.set(key, json);
      }
      return;
    }

    if (res.status === 409 && attempt < 5) {
      const remote = (await res.json()) as { versao: number; dados: unknown };
      const merged = mergeChanges(this.base.get(key), this.mem.get(key)!, remote.dados);
      const remoteJson = JSON.stringify(remote.dados);
      this.base.set(key, remoteJson);
      this.ver.set(key, remote.versao);
      this.mem.set(key, merged);
      this.emit('fleet:data-changed', { keys: [key] });
      if (merged === remoteJson) return; // nada local a reaplicar
      this.dirty.add(key);
      return this.send(key, attempt + 1);
    }

    if (res.status === 401) {
      this.dirty.add(key);
      this.emit('fleet:unauthorized');
      return;
    }

    // Recusado (sem permissão ou dado inválido): volta ao que está no servidor
    let message = `Não foi possível salvar (HTTP ${res.status}).`;
    try {
      message = ((await res.json()) as { error?: string }).error || message;
    } catch {
      /* sem corpo */
    }
    const base = this.base.get(key);
    if (base !== undefined) this.mem.set(key, base);
    else this.mem.delete(key);
    this.setStatus('erro');
    this.emit('fleet:sync-denied', { key: col, message });
    this.emit('fleet:data-changed', { keys: [key] });
  }

  // ---------------------------------------------------------------------------
  // Busca o que outras pessoas mudaram
  private startPolling() {
    this.stopPolling();
    this.pollTimer = setInterval(() => void this.pull(), POLL_MS);
    window.addEventListener('focus', this.onFocus);
  }

  private stopPolling() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
    window.removeEventListener('focus', this.onFocus);
  }

  private onFocus = () => void this.pull();

  async pull() {
    if (!this.ready) return;
    let versoes: Record<string, number>;
    try {
      const res = await fetch('/api/data/versions', { credentials: 'same-origin' });
      if (res.status === 401) return this.emit('fleet:unauthorized');
      if (!res.ok) return;
      versoes = ((await res.json()) as { versoes: Record<string, number> }).versoes;
      if (this.status === 'offline' && !this.hasPending()) this.setStatus('salvo');
    } catch {
      return this.setStatus('offline');
    }

    const changed: string[] = [];
    for (const [col, v] of Object.entries(versoes)) {
      const key = toStorageKey(col);
      // Se há mudança local pendente, o envio cuida do conflito
      if (v === this.ver.get(key) || this.dirty.has(key) || this.inflight.has(key)) continue;
      try {
        const res = await fetch(`/api/data/${encodeURIComponent(col)}`, { credentials: 'same-origin' });
        if (!res.ok) continue;
        const body = (await res.json()) as { versao: number; dados: unknown };
        if (this.dirty.has(key) || this.inflight.has(key)) continue;
        const json = JSON.stringify(body.dados);
        this.mem.set(key, json);
        this.base.set(key, json);
        this.ver.set(key, body.versao);
        changed.push(key);
      } catch {
        /* tenta no próximo ciclo */
      }
    }
    if (changed.length) this.emit('fleet:data-changed', { keys: changed });
  }

  private setStatus(status: Status, message?: string) {
    if (this.status === status) return;
    this.status = status;
    this.emit('fleet:sync-status', { status, message });
  }

  private emit(name: string, detail?: unknown) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }
}

/**
 * Junta mudanças: aplica sobre a versão do servidor (`remote`) o que mudou
 * localmente (`local`) em relação à última versão conhecida (`baseJson`).
 * Listas de itens com id: inclusões, alterações e exclusões item a item.
 * Outros formatos (ex.: configurações): vale a versão local.
 */
export function mergeChanges(baseJson: string | undefined, localJson: string, remote: unknown): string {
  const local = JSON.parse(localJson);
  const base = baseJson ? JSON.parse(baseJson) : [];
  const withIds = (x: unknown): x is { id: string }[] =>
    Array.isArray(x) && x.every(i => i && typeof i === 'object' && typeof (i as { id?: unknown }).id === 'string');

  if (remote === null || remote === undefined) return localJson;
  if (!withIds(local) || !withIds(remote) || !withIds(base)) return localJson;

  const baseMap = new Map(base.map(i => [i.id, JSON.stringify(i)]));
  const localIds = new Set(local.map(i => i.id));
  const deleted = new Set([...baseMap.keys()].filter(id => !localIds.has(id)));
  const changed = new Map<string, unknown>();
  const added: { id: string }[] = [];
  for (const item of local) {
    const before = baseMap.get(item.id);
    if (before === undefined) added.push(item);
    else if (before !== JSON.stringify(item)) changed.set(item.id, item);
  }

  const result: unknown[] = [];
  const remoteIds = new Set(remote.map(i => i.id));
  // Itens novos daqui entram no começo (as listas do app põem o mais recente primeiro)
  for (const item of added) if (!remoteIds.has(item.id)) result.push(item);
  for (const item of remote) {
    if (deleted.has(item.id)) continue;
    result.push(changed.has(item.id) ? changed.get(item.id) : item);
  }
  return JSON.stringify(result);
}

export const sync = new SyncService();

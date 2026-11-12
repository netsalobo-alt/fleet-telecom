import React, { useMemo, useState } from 'react';
import { Plus, Search, Pencil, Trash2, X, IdCard, Phone, Car, KeyRound, AlertTriangle } from 'lucide-react';
import { storage } from '../services/storage';
import { Driver, SystemUser, Vehicle, USER_ROLE_SHORT } from '../types';

interface DriversViewProps {
  drivers: Driver[];
  vehicles: Vehicle[];
  users: SystemUser[];
  canManage: boolean;
  onChanged: () => void;
  showToast: (message: string, type?: 'success' | 'warning' | 'info') => void;
}

const EMPTY: Omit<Driver, 'id' | 'dataCriacao'> = {
  nome: '',
  telefone: '',
  cpf: '',
  cnh: '',
  cnhCategoria: '',
  cnhValidade: '',
  status: 'ATIVO',
  usuarioId: '',
  observacoes: '',
};

function cnhSituacao(validade?: string): { label: string; tone: 'ok' | 'warn' | 'bad' | 'none' } {
  if (!validade) return { label: 'Sem validade', tone: 'none' };
  const dias = Math.floor((new Date(validade + 'T12:00:00').getTime() - Date.now()) / 86_400_000);
  const data = new Date(validade + 'T12:00:00').toLocaleDateString('pt-BR');
  if (dias < 0) return { label: `Vencida em ${data}`, tone: 'bad' };
  if (dias <= 30) return { label: `Vence em ${dias} dia(s)`, tone: 'warn' };
  return { label: `Válida até ${data}`, tone: 'ok' };
}

const TONE: Record<string, string> = {
  ok: 'text-green-text',
  warn: 'text-amber-700',
  bad: 'text-red-700 font-semibold',
  none: 'text-ink-muted',
};

export const DriversView: React.FC<DriversViewProps> = ({ drivers, vehicles, users, canManage, onChanged, showToast }) => {
  const [busca, setBusca] = useState('');
  const [editing, setEditing] = useState<Driver | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);

  const veiculosPorMotorista = useMemo(() => {
    const map = new Map<string, Vehicle[]>();
    vehicles.forEach(v => {
      if (!v.motoristaId) return;
      map.set(v.motoristaId, [...(map.get(v.motoristaId) || []), v]);
    });
    return map;
  }, [vehicles]);

  const lista = drivers
    .filter(d => {
      const q = busca.trim().toLowerCase();
      if (!q) return true;
      return [d.nome, d.telefone, d.cnh, d.cpf].some(x => (x || '').toLowerCase().includes(q));
    })
    .sort((a, b) => (a.status === b.status ? a.nome.localeCompare(b.nome) : a.status === 'ATIVO' ? -1 : 1));

  // Um usuário só pode estar ligado a um motorista
  const usuariosLivres = users.filter(
    u => u.status === 'ATIVO' && !drivers.some(d => d.usuarioId === u.id && d.id !== editing?.id),
  );

  const abrirNovo = () => {
    setEditing({ id: '', nome: '', telefone: '', status: 'ATIVO', dataCriacao: '' });
    setForm(EMPTY);
    setFormError(null);
  };

  const abrirEdicao = (d: Driver) => {
    setEditing(d);
    setForm({
      nome: d.nome,
      telefone: d.telefone || '',
      cpf: d.cpf || '',
      cnh: d.cnh || '',
      cnhCategoria: d.cnhCategoria || '',
      cnhValidade: d.cnhValidade || '',
      status: d.status,
      usuarioId: d.usuarioId || '',
      observacoes: d.observacoes || '',
    });
    setFormError(null);
  };

  const salvar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!form.nome.trim()) return setFormError('Informe o nome do motorista.');
    if (form.telefone.replace(/\D/g, '').length < 10) return setFormError('Informe o telefone com DDD.');
    const driver: Driver = {
      id: editing.id || `drv-${Date.now()}`,
      dataCriacao: editing.dataCriacao || new Date().toISOString(),
      nome: form.nome.trim(),
      telefone: form.telefone.trim(),
      cpf: form.cpf?.trim() || undefined,
      cnh: form.cnh?.trim() || undefined,
      cnhCategoria: form.cnhCategoria?.trim().toUpperCase() || undefined,
      cnhValidade: form.cnhValidade || undefined,
      status: form.status,
      usuarioId: form.usuarioId || undefined,
      observacoes: form.observacoes?.trim() || undefined,
    };
    storage.upsertDriver(driver);
    onChanged();
    setEditing(null);
    showToast(editing.id ? 'Motorista atualizado.' : 'Motorista cadastrado.', 'success');
  };

  const excluir = (d: Driver) => {
    const carros = veiculosPorMotorista.get(d.id) || [];
    const aviso = carros.length
      ? `\n\nEle será desvinculado de: ${carros.map(v => v.placa).join(', ')}.`
      : '';
    if (!confirm(`Excluir o motorista ${d.nome}?${aviso}\n\nO usuário de acesso (se houver) não é apagado.`)) return;
    storage.deleteDriver(d.id);
    onChanged();
    showToast('Motorista excluído.', 'info');
  };

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(f => ({ ...f, [k]: v }));
  const input =
    'w-full h-10 rounded-[10px] border border-line-strong/50 px-3 text-[14px] text-navy-deep focus:outline-none focus:ring-2 focus:ring-focus';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] sm:text-[34px] font-bold tracking-[-0.02em] text-navy-deep">Motoristas</h1>
          <p className="text-[15px] text-ink-muted mt-1">
            Quem dirige os veículos. Ter acesso ao sistema é opcional e fica em Usuários.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={abrirNovo}
            className="h-10 px-4 rounded-[10px] bg-brand-navy hover:bg-navy-deep text-white text-[14px] font-semibold flex items-center gap-2 self-start"
          >
            <Plus className="w-4 h-4" />
            Novo motorista
          </button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome, telefone ou CNH"
          aria-label="Buscar motorista"
          className={`${input} pl-9 bg-white`}
        />
      </div>

      {lista.length === 0 ? (
        <div className="bg-white rounded-2xl border border-line p-10 text-center text-ink-muted text-[14px]">
          {drivers.length === 0 ? 'Nenhum motorista cadastrado ainda.' : 'Nenhum motorista encontrado.'}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {lista.map(d => {
            const cnh = cnhSituacao(d.cnhValidade);
            const carros = veiculosPorMotorista.get(d.id) || [];
            const usuario = d.usuarioId ? users.find(u => u.id === d.usuarioId) : undefined;
            return (
              <article
                key={d.id}
                className={`bg-white rounded-2xl border border-line p-4 flex flex-col gap-3 ${d.status === 'INATIVO' ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-[16px] font-semibold text-navy-deep truncate">{d.nome}</h2>
                    <p className="text-[13px] text-ink-muted flex items-center gap-1.5 mt-0.5">
                      <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                      {d.telefone || 'Sem telefone'}
                    </p>
                  </div>
                  {d.status === 'INATIVO' && (
                    <span className="text-[11px] font-semibold rounded-full bg-surface-100 text-ink-muted px-2 py-0.5">Inativo</span>
                  )}
                </div>

                <dl className="text-[13px] space-y-1.5">
                  <div className="flex items-center gap-2">
                    <IdCard className="w-4 h-4 text-ink-muted shrink-0" aria-hidden="true" />
                    <dt className="sr-only">CNH</dt>
                    <dd>
                      <span className="text-navy-deep">{d.cnhCategoria ? `CNH ${d.cnhCategoria}` : 'CNH não informada'}</span>
                      <span className={`ml-1.5 ${TONE[cnh.tone]}`}>
                        {cnh.tone === 'bad' && <AlertTriangle className="inline w-3.5 h-3.5 -mt-0.5 mr-0.5" />}
                        {cnh.label}
                      </span>
                    </dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <Car className="w-4 h-4 text-ink-muted shrink-0" aria-hidden="true" />
                    <dt className="sr-only">Veículos</dt>
                    <dd className="text-navy-deep">
                      {carros.length ? carros.map(v => v.placa).join(', ') : <span className="text-ink-muted">Sem veículo</span>}
                    </dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-ink-muted shrink-0" aria-hidden="true" />
                    <dt className="sr-only">Acesso ao sistema</dt>
                    <dd className={usuario ? 'text-navy-deep' : 'text-ink-muted'}>
                      {usuario ? `Entra como @${usuario.login} (${USER_ROLE_SHORT[usuario.cargo]})` : 'Sem acesso ao sistema'}
                    </dd>
                  </div>
                </dl>

                {canManage && (
                  <div className="flex gap-2 pt-2 border-t border-line mt-auto">
                    <button
                      type="button"
                      onClick={() => abrirEdicao(d)}
                      className="h-9 px-3 rounded-lg text-[13px] font-semibold text-brand-navy hover:bg-surface-100 flex items-center gap-1.5"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => excluir(d)}
                      className="h-9 px-3 rounded-lg text-[13px] font-semibold text-red-700 hover:bg-red-50 flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Excluir
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {editing && (
        <div
          className="fixed inset-0 z-50 bg-navy-deep/40 flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="driver-form-title"
          onKeyDown={e => e.key === 'Escape' && setEditing(null)}
        >
          <form
            onSubmit={salvar}
            noValidate
            className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-line sticky top-0 bg-white">
              <h2 id="driver-form-title" className="text-[17px] font-semibold text-navy-deep">
                {editing.id ? 'Editar motorista' : 'Novo motorista'}
              </h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-ink-muted hover:bg-surface-100"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {formError && (
                <div role="alert" className="rounded-[10px] bg-red-50 border border-red-200 text-red-800 text-[13px] px-3 py-2">
                  {formError}
                </div>
              )}

              <div>
                <label htmlFor="drv-nome" className="block text-[13px] font-semibold text-navy-deep mb-1.5">Nome completo</label>
                <input id="drv-nome" autoFocus className={input} value={form.nome} onChange={e => set('nome', e.target.value)} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="drv-tel" className="block text-[13px] font-semibold text-navy-deep mb-1.5">Telefone (WhatsApp)</label>
                  <input id="drv-tel" inputMode="tel" placeholder="(91) 98888-7777" className={input} value={form.telefone} onChange={e => set('telefone', e.target.value)} />
                </div>
                <div>
                  <label htmlFor="drv-cpf" className="block text-[13px] font-semibold text-navy-deep mb-1.5">CPF <span className="font-normal text-ink-muted">(opcional)</span></label>
                  <input id="drv-cpf" inputMode="numeric" className={input} value={form.cpf} onChange={e => set('cpf', e.target.value)} />
                </div>
              </div>

              <fieldset className="grid grid-cols-3 gap-3">
                <legend className="text-[13px] font-semibold text-navy-deep mb-1.5 col-span-3">Habilitação (CNH)</legend>
                <div>
                  <label htmlFor="drv-cnh" className="block text-[12px] text-ink-muted mb-1">Número</label>
                  <input id="drv-cnh" inputMode="numeric" className={input} value={form.cnh} onChange={e => set('cnh', e.target.value)} />
                </div>
                <div>
                  <label htmlFor="drv-cat" className="block text-[12px] text-ink-muted mb-1">Categoria</label>
                  <input id="drv-cat" placeholder="B, D, AD…" maxLength={3} className={`${input} uppercase`} value={form.cnhCategoria} onChange={e => set('cnhCategoria', e.target.value)} />
                </div>
                <div>
                  <label htmlFor="drv-val" className="block text-[12px] text-ink-muted mb-1">Validade</label>
                  <input id="drv-val" type="date" className={input} value={form.cnhValidade} onChange={e => set('cnhValidade', e.target.value)} />
                </div>
              </fieldset>

              <div>
                <label htmlFor="drv-user" className="block text-[13px] font-semibold text-navy-deep mb-1.5">Acesso ao sistema</label>
                <select id="drv-user" className={`${input} bg-white`} value={form.usuarioId} onChange={e => set('usuarioId', e.target.value)}>
                  <option value="">Não entra no sistema</option>
                  {usuariosLivres.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.nome} · @{u.login} ({USER_ROLE_SHORT[u.cargo]})
                    </option>
                  ))}
                </select>
                <p className="text-[12px] text-ink-muted mt-1">
                  Se ele também lança notas, crie o usuário dele em Usuários e escolha aqui.
                </p>
              </div>

              <div>
                <label htmlFor="drv-status" className="block text-[13px] font-semibold text-navy-deep mb-1.5">Situação</label>
                <select id="drv-status" className={`${input} bg-white`} value={form.status} onChange={e => set('status', e.target.value as Driver['status'])}>
                  <option value="ATIVO">Ativo</option>
                  <option value="INATIVO">Inativo (não aparece para novos veículos)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-5 py-4 border-t border-line sticky bottom-0 bg-white">
              <button type="button" onClick={() => setEditing(null)} className="h-10 px-4 rounded-[10px] text-[14px] font-semibold text-brand-navy hover:bg-surface-100">
                Cancelar
              </button>
              <button type="submit" className="h-10 px-4 rounded-[10px] bg-brand-navy hover:bg-navy-deep text-white text-[14px] font-semibold">
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

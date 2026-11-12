/**
 * Login e dados do app (coleções) sobre o SQLite.
 * Toda rota /api exige sessão, exceto login e healthcheck.
 */
import type { Express, Request, Response, NextFunction } from 'express';
import express from 'express';
import type { SystemUser } from '../src/types';
import {
  COLLECTIONS,
  isCollection,
  getAllCollections,
  getCollection,
  getVersions,
  putCollection,
  readUsers,
  setPassword,
  checkPassword,
  hasPassword,
  pruneCredentials,
  createSession,
  sessionUserId,
  deleteSession,
  deleteUserSessions,
  SESSION_DAYS,
} from './db';

const COOKIE = 'fleet_sess';
const PUBLIC_API = new Set(['/api/auth/login', '/api/health', '/api/ready']);

declare module 'express-serve-static-core' {
  interface Request {
    user?: SystemUser;
  }
}

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

function setSessionCookie(req: Request, res: Response, token: string | null) {
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const attrs = [
    `${COOKIE}=${token ? encodeURIComponent(token) : ''}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    token ? `Max-Age=${SESSION_DAYS * 86400}` : 'Max-Age=0',
  ];
  if (secure) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

/** Usuário sem nada sensível, para devolver ao navegador. */
function publicUser(u: SystemUser): SystemUser {
  const { senha: _s, ...rest } = u;
  return rest as SystemUser;
}

function findActiveUser(id: string | null): SystemUser | null {
  if (!id) return null;
  return readUsers().find(u => u.id === id && u.status === 'ATIVO') || null;
}

const canManageUsers = (u: SystemUser) => u.cargo === 'GESTOR' || Boolean(u.permissoes?.podeGerenciarUsuarios);

/** Quem pode gravar cada coleção. */
function canWrite(user: SystemUser, key: string): boolean {
  if (key === 'users') return canManageUsers(user);
  if (key === 'settings') return user.cargo === 'GESTOR';
  if (key === 'integration_logs' || key === 'whatsapp_logs') return true;
  return user.cargo !== 'VISUALIZADOR';
}

// Proteção simples contra tentativa de senha em sequência (por IP + login)
const failures = new Map<string, { count: number; until: number }>();
function tooManyAttempts(key: string): number {
  const f = failures.get(key);
  if (!f) return 0;
  if (f.until > Date.now() && f.count >= 5) return Math.ceil((f.until - Date.now()) / 1000);
  if (f.until <= Date.now()) failures.delete(key);
  return 0;
}
function registerFailure(key: string) {
  const f = failures.get(key);
  const until = Date.now() + 5 * 60_000;
  failures.set(key, { count: (f && f.until > Date.now() ? f.count : 0) + 1, until });
}

/**
 * Antes de gravar a lista de usuários: tira as senhas do JSON (vão para a tabela de
 * credenciais, com hash) e confere que sempre sobra um gestor ativo com senha.
 */
function prepareUsers(raw: unknown, editor: SystemUser): { dados: string } | { erro: string } {
  if (!Array.isArray(raw)) return { erro: 'Lista de usuários inválida.' };
  const logins = new Set<string>();
  const novasSenhas: [string, string][] = [];
  const limpos: SystemUser[] = [];
  for (const item of raw as SystemUser[]) {
    if (!item || typeof item.id !== 'string' || !item.id) return { erro: 'Usuário sem identificador.' };
    const login = String(item.login || '').trim().toLowerCase();
    if (login.length < 3) return { erro: `Login inválido para ${item.nome || item.id}.` };
    if (logins.has(login)) return { erro: `O login "${login}" está repetido.` };
    logins.add(login);
    if (typeof item.senha === 'string' && item.senha.length > 0) {
      if (item.senha.length < 3) return { erro: `Senha muito curta para ${item.nome}.` };
      novasSenhas.push([item.id, item.senha]);
    }
    const { senha: _s, ...rest } = item;
    limpos.push({ ...(rest as SystemUser), login });
  }
  const temSenha = (id: string) => hasPassword(id) || novasSenhas.some(([uid]) => uid === id);
  for (const u of limpos) {
    if (!temSenha(u.id)) return { erro: `Defina uma senha para ${u.nome}.` };
  }
  if (!limpos.some(u => u.cargo === 'GESTOR' && u.status === 'ATIVO')) {
    return { erro: 'Precisa sobrar pelo menos um gestor ativo.' };
  }
  if (!limpos.some(u => u.id === editor.id && u.status === 'ATIVO')) {
    return { erro: 'Você não pode excluir ou desativar o seu próprio usuário.' };
  }
  // Tudo certo: grava as senhas novas e encerra as sessões de quem foi desativado
  for (const [id, senha] of novasSenhas) {
    setPassword(id, senha);
    if (id !== editor.id) deleteUserSessions(id);
  }
  for (const u of limpos) if (u.status !== 'ATIVO') deleteUserSessions(u.id);
  pruneCredentials(new Set(limpos.map(u => u.id)));
  return { dados: JSON.stringify(limpos) };
}

export function registerApi(app: Express) {
  // Sessão: identifica o usuário em toda chamada /api e bloqueia quem não entrou
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    const user = findActiveUser(sessionUserId(readCookie(req, COOKIE)));
    if (user) req.user = user;
    if (PUBLIC_API.has(req.baseUrl + req.path) || user) return next();
    return res.status(401).json({ error: 'Sessão expirada. Entre novamente.' });
  });

  app.post('/api/auth/login', (req, res) => {
    const login = String(req.body?.login || '').trim().toLowerCase();
    const senha = String(req.body?.senha || '');
    const key = `${req.ip}|${login}`;
    const wait = tooManyAttempts(key);
    if (wait) return res.status(429).json({ error: `Muitas tentativas. Tente de novo em ${wait}s.` });

    const user = readUsers().find(
      u => u.status === 'ATIVO' && (u.login?.toLowerCase() === login || u.email?.toLowerCase() === login),
    );
    if (!login || !senha || !user || !checkPassword(user.id, senha)) {
      registerFailure(key);
      return res.status(401).json({ error: 'Usuário ou senha incorretos, ou acesso desativado.' });
    }
    failures.delete(key);
    setSessionCookie(req, res, createSession(user.id));
    return res.json({ user: publicUser(user) });
  });

  app.post('/api/auth/logout', (req, res) => {
    deleteSession(readCookie(req, COOKIE));
    setSessionCookie(req, res, null);
    res.json({ ok: true });
  });

  app.get('/api/auth/me', (req, res) => {
    res.json({ user: publicUser(req.user!) });
  });

  /** Troca da própria senha. */
  app.post('/api/auth/password', (req, res) => {
    const atual = String(req.body?.atual || '');
    const nova = String(req.body?.nova || '');
    if (!checkPassword(req.user!.id, atual)) return res.status(400).json({ error: 'Senha atual incorreta.' });
    if (nova.length < 6) return res.status(400).json({ error: 'A nova senha precisa de pelo menos 6 caracteres.' });
    setPassword(req.user!.id, nova);
    res.json({ ok: true });
  });

  // ---- Dados -------------------------------------------------------------
  app.get('/api/data', (_req, res) => {
    const all = getAllCollections();
    // Monta o JSON à mão: os dados já estão serializados no banco
    const parts = Object.entries(all).map(
      ([k, v]) => `${JSON.stringify(k)}:{"versao":${v.versao},"dados":${v.dados}}`,
    );
    res.type('application/json').send(`{"colecoes":{${parts.join(',')}}}`);
  });

  app.get('/api/data/versions', (_req, res) => {
    res.json({ versoes: getVersions() });
  });

  app.get('/api/data/:key', (req, res) => {
    const key = req.params.key;
    if (!isCollection(key)) return res.status(404).json({ error: 'Coleção desconhecida.' });
    const row = getCollection(key);
    if (!row) return res.json({ versao: 0, dados: null });
    res.type('application/json').send(`{"versao":${row.versao},"dados":${row.dados}}`);
  });

  app.put('/api/data/:key', express.json({ limit: '60mb' }), (req, res) => {
    const key = req.params.key;
    const user = req.user!;
    if (!isCollection(key)) return res.status(404).json({ error: 'Coleção desconhecida.' });
    if (!canWrite(user, key)) return res.status(403).json({ error: 'Seu perfil não pode alterar estes dados.' });

    const versao = Number(req.body?.versao);
    const dados = req.body?.dados;
    if (!Number.isInteger(versao) || versao < 0 || dados === undefined) {
      return res.status(400).json({ error: 'Envio inválido.' });
    }
    if (key !== 'settings' && !Array.isArray(dados)) return res.status(400).json({ error: 'Esperava uma lista.' });

    // Conflito: devolve o que está no banco para o app juntar com as mudanças locais
    const atual = getCollection(key);
    if ((atual?.versao ?? 0) !== versao) {
      return res
        .status(409)
        .type('application/json')
        .send(atual ? `{"versao":${atual.versao},"dados":${atual.dados}}` : '{"versao":0,"dados":null}');
    }

    let serialized: string;
    if (key === 'users') {
      const r = prepareUsers(dados, user);
      if ('erro' in r) return res.status(422).json({ error: r.erro });
      serialized = r.dados;
    } else {
      serialized = JSON.stringify(dados);
    }

    const nova = putCollection(key, serialized, versao, user.id);
    if (nova === null) {
      const agora = getCollection(key)!;
      return res.status(409).type('application/json').send(`{"versao":${agora.versao},"dados":${agora.dados}}`);
    }
    // Para usuários devolve a lista já sem senhas, para o navegador descartar as que enviou
    if (key === 'users') return res.type('application/json').send(`{"versao":${nova},"dados":${serialized}}`);
    res.json({ versao: nova });
  });
}

export { COLLECTIONS };

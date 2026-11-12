/**
 * Banco do Fleet Telecom: um arquivo SQLite no servidor (sem serviço externo).
 *
 * - colecoes: cada lista do app (veículos, serviços, motoristas…) é um documento JSON
 *   com número de versão. A versão evita que um salvamento apague o de outra pessoa:
 *   quem salvar com versão antiga recebe 409 e o app junta as mudanças.
 * - credenciais: hash das senhas (scrypt). A senha nunca fica junto dos dados.
 * - sessoes: login por aparelho, guardado como hash do token do cookie.
 *
 * Backup = copiar o arquivo fleet.db (de preferência com o app parado, ou usando
 * `sqlite3 fleet.db ".backup copia.db"`).
 */
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { SystemUser } from '../src/types';
import { DEFAULT_SYSTEM_USERS, getDefaultPermissionsByRole } from '../src/services/permissions';

/** Coleções que o app pode ler e gravar. Qualquer outra chave é recusada. */
export const COLLECTIONS = [
  'vehicles',
  'services',
  'suppliers',
  'revisions',
  'licensing',
  'alerts',
  'users',
  'settings',
  'drivers',
  'whatsapp_logs',
  'integration_logs',
] as const;
export type CollectionKey = (typeof COLLECTIONS)[number];
export const isCollection = (k: string): k is CollectionKey => (COLLECTIONS as readonly string[]).includes(k);

const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
fs.mkdirSync(DATA_DIR, { recursive: true });
export const DB_FILE = path.join(DATA_DIR, 'fleet.db');

const db = new DatabaseSync(DB_FILE);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS colecoes (
    chave TEXT PRIMARY KEY,
    dados TEXT NOT NULL,
    versao INTEGER NOT NULL DEFAULT 1,
    atualizado_em TEXT NOT NULL,
    atualizado_por TEXT
  );

  CREATE TABLE IF NOT EXISTS credenciais (
    usuario_id TEXT PRIMARY KEY,
    hash TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessoes (
    token_hash TEXT PRIMARY KEY,
    usuario_id TEXT NOT NULL,
    criado_em TEXT NOT NULL,
    expira_em TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sessoes_usuario ON sessoes(usuario_id);
`);

const now = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// Coleções
// ---------------------------------------------------------------------------
const qGet = db.prepare('SELECT dados, versao FROM colecoes WHERE chave = ?');
const qAll = db.prepare('SELECT chave, dados, versao FROM colecoes');
const qVersions = db.prepare('SELECT chave, versao FROM colecoes');
const qInsert = db.prepare(
  'INSERT INTO colecoes (chave, dados, versao, atualizado_em, atualizado_por) VALUES (?, ?, 1, ?, ?)',
);
const qUpdate = db.prepare(
  'UPDATE colecoes SET dados = ?, versao = versao + 1, atualizado_em = ?, atualizado_por = ? WHERE chave = ? AND versao = ?',
);

export function getCollection(key: CollectionKey): { dados: string; versao: number } | null {
  const row = qGet.get(key) as { dados: string; versao: number } | undefined;
  return row ? { dados: row.dados, versao: Number(row.versao) } : null;
}

export function getAllCollections(): Record<string, { dados: string; versao: number }> {
  const out: Record<string, { dados: string; versao: number }> = {};
  for (const row of qAll.all() as { chave: string; dados: string; versao: number }[]) {
    out[row.chave] = { dados: row.dados, versao: Number(row.versao) };
  }
  return out;
}

export function getVersions(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of qVersions.all() as { chave: string; versao: number }[]) out[row.chave] = Number(row.versao);
  return out;
}

/**
 * Grava se a versão enviada for a atual (0 = coleção ainda não existe).
 * Devolve a nova versão, ou null quando outra pessoa salvou antes (conflito).
 */
export function putCollection(key: CollectionKey, dados: string, versaoEsperada: number, por: string): number | null {
  const atual = getCollection(key);
  if (!atual) {
    if (versaoEsperada !== 0) return null;
    qInsert.run(key, dados, now(), por);
    return 1;
  }
  const r = qUpdate.run(dados, now(), por, key, versaoEsperada);
  return Number(r.changes) === 1 ? versaoEsperada + 1 : null;
}

export function readUsers(): SystemUser[] {
  const row = getCollection('users');
  if (!row) return [];
  try {
    const list = JSON.parse(row.dados);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Senhas
// ---------------------------------------------------------------------------
export function hashPassword(senha: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(senha, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

function verifyHash(senha: string, stored: string): boolean {
  const [alg, saltB64, hashB64] = stored.split('$');
  if (alg !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const got = scryptSync(senha, Buffer.from(saltB64, 'base64'), expected.length);
  return timingSafeEqual(expected, got);
}

const qCredGet = db.prepare('SELECT hash FROM credenciais WHERE usuario_id = ?');
const qCredSet = db.prepare(
  'INSERT INTO credenciais (usuario_id, hash, atualizado_em) VALUES (?, ?, ?) ON CONFLICT(usuario_id) DO UPDATE SET hash = excluded.hash, atualizado_em = excluded.atualizado_em',
);
const qCredDel = db.prepare('DELETE FROM credenciais WHERE usuario_id = ?');
const qCredIds = db.prepare('SELECT usuario_id FROM credenciais');

export function setPassword(usuarioId: string, senha: string) {
  qCredSet.run(usuarioId, hashPassword(senha), now());
}

export function hasPassword(usuarioId: string): boolean {
  return Boolean(qCredGet.get(usuarioId));
}

export function checkPassword(usuarioId: string, senha: string): boolean {
  const row = qCredGet.get(usuarioId) as { hash: string } | undefined;
  if (!row) {
    // Mesmo custo de tempo de quando o usuário existe, para não revelar quem existe
    verifyHash(senha, hashPassword('x'));
    return false;
  }
  return verifyHash(senha, row.hash);
}

/** Apaga senhas e sessões de usuários que não existem mais na lista. */
export function pruneCredentials(idsValidos: Set<string>) {
  for (const { usuario_id } of qCredIds.all() as { usuario_id: string }[]) {
    if (!idsValidos.has(usuario_id)) {
      qCredDel.run(usuario_id);
      qSessDelUser.run(usuario_id);
    }
  }
}

// ---------------------------------------------------------------------------
// Sessões
// ---------------------------------------------------------------------------
export const SESSION_DAYS = Number(process.env.SESSION_DAYS) || 30;
const tokenHash = (t: string) => createHash('sha256').update(t).digest('hex');

const qSessIns = db.prepare('INSERT INTO sessoes (token_hash, usuario_id, criado_em, expira_em) VALUES (?, ?, ?, ?)');
const qSessGet = db.prepare('SELECT usuario_id, expira_em FROM sessoes WHERE token_hash = ?');
const qSessDel = db.prepare('DELETE FROM sessoes WHERE token_hash = ?');
const qSessDelUser = db.prepare('DELETE FROM sessoes WHERE usuario_id = ?');
const qSessPurge = db.prepare('DELETE FROM sessoes WHERE expira_em < ?');

export function createSession(usuarioId: string): string {
  const token = randomBytes(32).toString('base64url');
  const expira = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
  qSessIns.run(tokenHash(token), usuarioId, now(), expira);
  return token;
}

export function sessionUserId(token: string | undefined): string | null {
  if (!token) return null;
  const row = qSessGet.get(tokenHash(token)) as { usuario_id: string; expira_em: string } | undefined;
  if (!row) return null;
  if (row.expira_em < now()) {
    qSessDel.run(tokenHash(token));
    return null;
  }
  return row.usuario_id;
}

export function deleteSession(token: string | undefined) {
  if (token) qSessDel.run(tokenHash(token));
}

export function deleteUserSessions(usuarioId: string) {
  qSessDelUser.run(usuarioId);
}

setInterval(() => qSessPurge.run(now()), 6 * 3_600_000).unref();

// ---------------------------------------------------------------------------
// Primeira execução
// ---------------------------------------------------------------------------
/**
 * Banco novo:
 * - produção: cria só o administrador (FLEET_ADMIN_LOGIN / FLEET_ADMIN_PASSWORD; sem senha
 *   definida, gera uma e mostra no log uma única vez) e deixa as listas vazias, sem dados de exemplo;
 * - desenvolvimento: cria os usuários de demonstração (senha 123) e o app preenche os dados de exemplo.
 */
export function seedIfEmpty() {
  if (getCollection('users')) return;
  const production = process.env.NODE_ENV === 'production' || Boolean(process.env.FLEET_ADMIN_PASSWORD);

  if (!production) {
    const users = DEFAULT_SYSTEM_USERS.map(({ senha: _s, ...u }) => u);
    putCollection('users', JSON.stringify(users), 0, 'sistema');
    for (const u of DEFAULT_SYSTEM_USERS) setPassword(u.id, u.senha || '123');
    console.log('[DB] Banco novo (desenvolvimento): usuários de demonstração criados, senha 123.');
    return;
  }

  const login = (process.env.FLEET_ADMIN_LOGIN || 'admin').trim().toLowerCase();
  let senha = process.env.FLEET_ADMIN_PASSWORD || '';
  const gerada = !senha;
  if (gerada) senha = randomBytes(9).toString('base64url');
  const admin: SystemUser = {
    id: 'usr-admin',
    nome: process.env.FLEET_ADMIN_NAME || 'Administrador',
    login,
    email: process.env.FLEET_ADMIN_EMAIL || `${login}@fleet.local`,
    cpf: '',
    cargo: 'GESTOR',
    status: 'ATIVO',
    telefone: '',
    dataCriacao: now(),
    permissoes: getDefaultPermissionsByRole('GESTOR'),
  };
  putCollection('users', JSON.stringify([admin]), 0, 'sistema');
  setPassword(admin.id, senha);
  for (const k of COLLECTIONS) {
    if (k === 'users' || k === 'settings') continue;
    putCollection(k, '[]', 0, 'sistema');
  }
  console.log(
    gerada
      ? `[DB] Banco novo: administrador "${login}" criado com a senha temporária: ${senha}  (troque depois de entrar)`
      : `[DB] Banco novo: administrador "${login}" criado com a senha de FLEET_ADMIN_PASSWORD.`,
  );
}

export function closeDb() {
  db.close();
}

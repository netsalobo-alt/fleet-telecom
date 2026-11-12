import React, { useCallback, useEffect, useState } from 'react';
import App from './App';
import { LoginView } from './components/LoginView';
import { storage } from './services/storage';
import { sync } from './services/sync';
import { SystemUser } from './types';

type Phase = { kind: 'checking' } | { kind: 'login'; notice?: string } | { kind: 'loading' } | { kind: 'ready'; user: SystemUser } | { kind: 'error'; message: string };

/**
 * Entrada do app: confere a sessão no servidor, carrega os dados e só então mostra o App.
 * Para trocar de pessoa, sai (logout) e entra de novo.
 */
export default function Root() {
  const [phase, setPhase] = useState<Phase>({ kind: 'checking' });

  const loadFor = useCallback(async (user: SystemUser) => {
    setPhase({ kind: 'loading' });
    try {
      storage.setActiveUser(user);
      await sync.hydrate();
      setPhase({ kind: 'ready', user });
    } catch (e) {
      if ((e as Error).message === 'unauthorized') return setPhase({ kind: 'login' });
      setPhase({ kind: 'error', message: (e as Error).message || 'Falha ao carregar os dados.' });
    }
  }, []);

  // Sessão já aberta neste aparelho?
  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : null))
      .then(body => (body?.user ? loadFor(body.user) : setPhase({ kind: 'login' })))
      .catch(() => setPhase({ kind: 'error', message: 'Servidor indisponível.' }));
  }, [loadFor]);

  const logout = useCallback(async (notice?: string) => {
    try {
      await sync.flushAll();
    } catch {
      /* segue com a saída */
    }
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => undefined);
    sync.clear();
    storage.logout();
    setPhase({ kind: 'login', notice });
  }, []);

  // Sessão expirou no servidor
  useEffect(() => {
    const onUnauthorized = () => {
      sync.clear();
      storage.logout();
      setPhase({ kind: 'login', notice: 'Sua sessão expirou. Entre novamente.' });
    };
    window.addEventListener('fleet:unauthorized', onUnauthorized);
    return () => window.removeEventListener('fleet:unauthorized', onUnauthorized);
  }, []);

  // Avisa antes de fechar a aba com alteração ainda não salva no servidor
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (sync.hasPending()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  if (phase.kind === 'login') return <LoginView onLogin={loadFor} notice={phase.notice} />;
  if (phase.kind === 'ready') return <App key={phase.user.id} onLogout={() => logout()} />;

  return (
    <div className="min-h-screen bg-surface-100 flex items-center justify-center px-4">
      {phase.kind === 'error' ? (
        <div className="bg-white rounded-2xl border border-line p-6 max-w-sm text-center">
          <h1 className="text-[17px] font-semibold text-navy-deep">Não foi possível abrir o Fleet</h1>
          <p className="text-[14px] text-ink-muted mt-1">{phase.message}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 h-10 px-4 rounded-[10px] bg-brand-navy text-white text-[14px] font-semibold"
          >
            Tentar de novo
          </button>
        </div>
      ) : (
        <p className="text-[14px] text-ink-muted" role="status">
          Carregando…
        </p>
      )}
    </div>
  );
}

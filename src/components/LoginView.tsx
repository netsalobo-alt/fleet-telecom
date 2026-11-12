import React, { useState } from 'react';
import { LogIn, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { SystemUser } from '../types';

interface LoginViewProps {
  onLogin: (user: SystemUser) => void;
  /** Aviso mostrado acima do formulário (ex.: sessão expirada). */
  notice?: string;
}

/** Entrada no sistema. Cada pessoa usa o próprio login; para trocar de pessoa, sai e entra de novo. */
export const LoginView: React.FC<LoginViewProps> = ({ onLogin, notice }) => {
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!login.trim() || !senha) {
      setError('Informe o usuário e a senha.');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: login.trim(), senha }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.user) {
        setError(body.error || 'Não foi possível entrar.');
        return;
      }
      setError(null);
      onLogin(body.user);
    } catch {
      setError('Sem conexão com o servidor.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <span className="w-10 h-10 rounded-[12px] bg-brand-green flex items-center justify-center" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#00375a" strokeWidth="2.4" strokeLinecap="round">
              <path d="M5 12a7 7 0 0 1 14 0" />
              <path d="M8.5 12a3.5 3.5 0 0 1 7 0" />
              <circle cx="12" cy="12" r="1.2" fill="#00375a" stroke="none" />
            </svg>
          </span>
          <span className="text-[22px] tracking-[-0.01em] text-navy-deep">
            <span className="font-medium">Fleet</span>
            <span className="font-extrabold">Telecom</span>
          </span>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-line p-6 space-y-4" noValidate>
          <div>
            <h1 className="text-[22px] font-bold text-navy-deep tracking-[-0.01em]">Entrar</h1>
            <p className="text-[13px] text-ink-muted mt-1">Use o seu usuário de acesso à gestão da frota.</p>
          </div>

          {notice && !error && (
            <div role="status" className="rounded-[10px] bg-surface-100 border border-line text-navy-deep text-[13px] px-3 py-2">
              {notice}
            </div>
          )}

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-[10px] bg-red-50 border border-red-200 text-red-800 text-[13px] px-3 py-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label htmlFor="login-user" className="block text-[13px] font-semibold text-navy-deep mb-1.5">
              Usuário ou e-mail
            </label>
            <input
              id="login-user"
              autoFocus
              autoComplete="username"
              value={login}
              onChange={e => setLogin(e.target.value)}
              className="w-full h-11 rounded-[10px] border border-line-strong/50 px-3 text-[15px] text-navy-deep focus:outline-none focus:ring-2 focus:ring-focus"
            />
          </div>

          <div>
            <label htmlFor="login-pass" className="block text-[13px] font-semibold text-navy-deep mb-1.5">
              Senha
            </label>
            <div className="relative">
              <input
                id="login-pass"
                type={showSenha ? 'text' : 'password'}
                autoComplete="current-password"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                className="w-full h-11 rounded-[10px] border border-line-strong/50 pl-3 pr-11 text-[15px] text-navy-deep focus:outline-none focus:ring-2 focus:ring-focus"
              />
              <button
                type="button"
                onClick={() => setShowSenha(v => !v)}
                className="absolute right-1 top-1 w-9 h-9 rounded-lg flex items-center justify-center text-ink-muted hover:bg-surface-100"
                aria-label={showSenha ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={sending}
            className="disabled:opacity-60 w-full h-11 rounded-[10px] bg-brand-navy hover:bg-navy-deep text-white text-[15px] font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <LogIn className="w-4 h-4" />
            {sending ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-[12px] text-ink-muted mt-6">
          Esqueceu a senha? Peça a um gestor para redefinir em Usuários.
        </p>
      </div>
    </div>
  );
};

import React, { useMemo, useState } from 'react';
import { UploadCloud, X } from 'lucide-react';
import { storage } from '../services/storage';

/**
 * A versão anterior guardava tudo no navegador (localStorage). Para um gestor, oferece
 * uma única vez levar esses dados para o servidor. Junta pelo id (não apaga nada do
 * servidor) e mantém a cópia antiga no navegador como backup.
 * Usuários e senhas antigos não são importados: são recriados em Usuários.
 */
const PREFIX = 'fleet_real_v2_';
const DONE_FLAG = 'fleet_local_import_done';
const LISTS = ['vehicles', 'services', 'suppliers', 'revisions', 'licensing', 'alerts', 'drivers', 'whatsapp_logs'] as const;
const LABEL: Record<string, string> = {
  vehicles: 'veículos',
  services: 'serviços',
  suppliers: 'fornecedores',
  revisions: 'revisões',
  drivers: 'motoristas',
};

function readLocal(key: string): unknown {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const LocalImportBanner: React.FC<{ onImported: () => void }> = ({ onImported }) => {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(DONE_FLAG) === '1';
    } catch {
      return true;
    }
  });

  const found = useMemo(() => {
    if (hidden) return null;
    const counts: Record<string, number> = {};
    for (const k of LISTS) {
      const v = readLocal(k);
      if (Array.isArray(v) && v.length) counts[k] = v.length;
    }
    const hasSettings = Boolean(readLocal('settings'));
    return Object.keys(counts).length || hasSettings ? { counts, hasSettings } : null;
  }, [hidden]);

  if (hidden || !found) return null;

  const finish = () => {
    try {
      localStorage.setItem(DONE_FLAG, '1');
    } catch {
      /* sem armazenamento local */
    }
    setHidden(true);
  };

  const importNow = () => {
    for (const k of LISTS) {
      const local = readLocal(k);
      if (Array.isArray(local) && local.length) storage.importList(PREFIX + k, local);
    }
    const settings = readLocal('settings');
    if (settings && typeof settings === 'object') storage.importSettingsIfMissing(settings);
    finish();
    onImported();
  };

  const resumo = Object.entries(found.counts)
    .filter(([k]) => LABEL[k])
    .map(([k, n]) => `${n} ${LABEL[k]}`)
    .join(', ');

  return (
    <div className="mb-6 bg-white border border-line rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <UploadCloud className="w-5 h-5 text-info shrink-0" aria-hidden="true" />
      <div className="flex-1 text-[14px]">
        <p className="font-semibold text-navy-deep">Este navegador tem dados da versão anterior</p>
        <p className="text-ink-muted">
          {resumo || 'Configurações salvas'}. Quer levar para o servidor, para todos verem? Nada do que já está no servidor é apagado.
        </p>
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          type="button"
          onClick={importNow}
          className="h-9 px-3 rounded-[10px] bg-brand-navy hover:bg-navy-deep text-white text-[13px] font-semibold"
        >
          Importar
        </button>
        <button
          type="button"
          onClick={finish}
          className="h-9 px-3 rounded-[10px] text-[13px] font-semibold text-brand-navy hover:bg-surface-100 flex items-center gap-1"
        >
          <X className="w-3.5 h-3.5" /> Ignorar
        </button>
      </div>
    </div>
  );
};

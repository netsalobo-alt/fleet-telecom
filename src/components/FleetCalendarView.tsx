import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, Plus, X, CalendarX2, Gauge, Wrench } from 'lucide-react';
import { RevisionPlan, ServiceLog, Vehicle } from '../types';

/* ------------------------------------------------------------------ */
/* Categorias de serviço unificadas (plano de revisão + serviços)      */
/* ------------------------------------------------------------------ */

type Categoria =
  | 'OLEO' | 'FREIOS' | 'CORREIA' | 'PNEUS' | 'FILTROS' | 'ARREFECIMENTO'
  | 'SUSPENSAO' | 'REVISAO' | 'MECANICA' | 'ELETRICA' | 'FUNILARIA' | 'VISTORIA' | 'OUTROS';

const CATEGORIA_LABEL: Record<Categoria, string> = {
  OLEO: 'Óleo e filtro',
  FREIOS: 'Freios',
  CORREIA: 'Correia dentada',
  PNEUS: 'Pneus',
  FILTROS: 'Filtros de ar e combustível',
  ARREFECIMENTO: 'Arrefecimento',
  SUSPENSAO: 'Suspensão',
  REVISAO: 'Revisão geral',
  MECANICA: 'Mecânica',
  ELETRICA: 'Elétrica',
  FUNILARIA: 'Funilaria',
  VISTORIA: 'Vistoria',
  OUTROS: 'Outros',
};

const REVISION_CAT: Record<RevisionPlan['item'], Categoria> = {
  OLEO_FILTRO: 'OLEO',
  PASTILHAS_FREIO: 'FREIOS',
  CORREIA_DENTADA: 'CORREIA',
  PNEUS: 'PNEUS',
  FILTRO_AR_COMBUSTIVEL: 'FILTROS',
  SISTEMA_ARREFECIMENTO: 'ARREFECIMENTO',
  SUSPENSAO: 'SUSPENSAO',
  REVISAO_GERAL: 'REVISAO',
};

const SERVICE_CAT: Record<ServiceLog['tipo'], Categoria> = {
  OLEO: 'OLEO',
  MECANICA: 'MECANICA',
  ELETRICA: 'ELETRICA',
  PNEU: 'PNEUS',
  FUNILARIA: 'FUNILARIA',
  REVISAO_PROGRAMADA: 'REVISAO',
  VISTORIA: 'VISTORIA',
  OUTROS: 'OUTROS',
};

/* ------------------------------------------------------------------ */
/* Eventos                                                             */
/* ------------------------------------------------------------------ */

type Estado = 'VENCIDO' | 'PROXIMO' | 'EM_DIA' | 'AGENDADO' | 'EM_ANDAMENTO' | 'CONCLUIDO';

const ESTADO: Record<Estado, { label: string; chip: string; dot: string }> = {
  VENCIDO: { label: 'Vencida', chip: 'bg-red-100 text-red-700', dot: 'bg-red-600' },
  PROXIMO: { label: 'Próxima', chip: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  EM_DIA: { label: 'Programada', chip: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  AGENDADO: { label: 'Agendado', chip: 'bg-sky-100 text-sky-800', dot: 'bg-sky-700' },
  EM_ANDAMENTO: { label: 'Na oficina', chip: 'bg-cyan-100 text-cyan-800', dot: 'bg-cyan-600' },
  CONCLUIDO: { label: 'Concluído', chip: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
};

interface CalEvent {
  id: string;
  date: string; // YYYY-MM-DD
  placa: string;
  veiculoId: string;
  titulo: string;
  categoria: Categoria;
  estado: Estado;
  origem: 'revisao' | 'servico';
  detalhe: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtKm = (n: number) => n.toLocaleString('pt-BR');
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DIAS_LETRA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

/** Semanas do mês (5 ou 6), começando no domingo da semana do dia 1. */
function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Math.ceil((first.getDay() + daysInMonth) / 7) * 7;
  const start = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: cells }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

function buildEvents(revisions: RevisionPlan[], services: ServiceLog[]): CalEvent[] {
  const evs: CalEvent[] = [];
  for (const r of revisions) {
    if (!r.proximaData) continue;
    evs.push({
      id: `rev-${r.id}`,
      date: r.proximaData.slice(0, 10),
      placa: r.placa,
      veiculoId: r.veiculoId,
      titulo: r.titulo,
      categoria: REVISION_CAT[r.item] || 'REVISAO',
      estado: r.status,
      origem: 'revisao',
      detalhe:
        r.status === 'VENCIDO'
          ? `Passou ${fmtKm(Math.abs(r.kmRestantes))} km do limite (${fmtKm(r.proximoKm)} km).`
          : `Previsto para ${fmtKm(r.proximoKm)} km, faltam ${fmtKm(Math.max(0, r.kmRestantes))} km.`,
    });
  }
  for (const s of services) {
    if (!s.data) continue;
    evs.push({
      id: `srv-${s.id}`,
      date: s.data.slice(0, 10),
      placa: s.placa,
      veiculoId: s.veiculoId,
      titulo: s.descricaoResumida || CATEGORIA_LABEL[SERVICE_CAT[s.tipo] || 'OUTROS'],
      categoria: SERVICE_CAT[s.tipo] || 'OUTROS',
      estado: s.status,
      origem: 'servico',
      detalhe: [s.fornecedorNome || s.fornecedor, s.valorTotal ? s.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '']
        .filter(Boolean)
        .join(' · '),
    });
  }
  return evs.sort((a, b) => a.date.localeCompare(b.date) || a.placa.localeCompare(b.placa));
}

/* ------------------------------------------------------------------ */

interface FleetCalendarViewProps {
  vehicles: Vehicle[];
  revisions: RevisionPlan[];
  services: ServiceLog[];
  onScheduleRevision: () => void;
}

export const FleetCalendarView: React.FC<FleetCalendarViewProps> = ({ vehicles, revisions, services, onScheduleRevision }) => {
  const today = new Date();
  const todayKey = toKey(today);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [miniCursor, setMiniCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [view, setView] = useState<'mes' | 'lista'>('mes');
  const [hiddenVehicles, setHiddenVehicles] = useState<Set<string>>(new Set());
  const [hiddenCats, setHiddenCats] = useState<Set<Categoria>>(new Set());
  const [showDone, setShowDone] = useState(false);
  const [selected, setSelected] = useState<CalEvent | null>(null);
  const [dayOpen, setDayOpen] = useState<string | null>(null);

  const allEvents = useMemo(() => buildEvents(revisions, services), [revisions, services]);

  const usedCats = useMemo(() => {
    const set = new Set<Categoria>(allEvents.map(e => e.categoria));
    return (Object.keys(CATEGORIA_LABEL) as Categoria[]).filter(c => set.has(c));
  }, [allEvents]);

  const fleet = useMemo(() => {
    const byPlate = new Map<string, { id: string; placa: string; modelo: string }>();
    vehicles.forEach(v => byPlate.set(v.id, { id: v.id, placa: v.placa, modelo: v.modelo }));
    allEvents.forEach(e => {
      if (!byPlate.has(e.veiculoId)) byPlate.set(e.veiculoId, { id: e.veiculoId, placa: e.placa, modelo: '' });
    });
    return [...byPlate.values()].sort((a, b) => a.placa.localeCompare(b.placa));
  }, [vehicles, allEvents]);

  const events = useMemo(
    () =>
      allEvents.filter(
        e =>
          !hiddenVehicles.has(e.veiculoId) &&
          !hiddenCats.has(e.categoria) &&
          (showDone || e.estado !== 'CONCLUIDO')
      ),
    [allEvents, hiddenVehicles, hiddenCats, showDone]
  );

  const byDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    events.forEach(e => {
      const list = m.get(e.date) || [];
      list.push(e);
      m.set(e.date, list);
    });
    return m;
  }, [events]);

  const upcoming = useMemo(() => {
    const limit = toKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30));
    return events.filter(e => e.estado === 'VENCIDO' || (e.date >= todayKey && e.date <= limit && e.estado !== 'CONCLUIDO')).slice(0, 6);
  }, [events, todayKey]);

  const monthEvents = useMemo(() => {
    const prefix = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}`;
    return events.filter(e => e.date.startsWith(prefix));
  }, [events, cursor]);

  const toggle = <T,>(set: Set<T>, value: T, setter: (s: Set<T>) => void) => {
    const next = new Set(set);
    next.has(value) ? next.delete(value) : next.add(value);
    setter(next);
  };

  const shiftMonth = (delta: number) => {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1);
    setCursor(next);
    setMiniCursor(next);
  };

  const goToday = () => {
    const m = new Date(today.getFullYear(), today.getMonth(), 1);
    setCursor(m);
    setMiniCursor(m);
  };

  const pickDay = (d: Date) => {
    const m = new Date(d.getFullYear(), d.getMonth(), 1);
    setCursor(m);
    setMiniCursor(m);
    if (byDay.has(toKey(d))) setDayOpen(toKey(d));
  };

  const grid = monthGrid(cursor.getFullYear(), cursor.getMonth());
  const miniGrid = monthGrid(miniCursor.getFullYear(), miniCursor.getMonth());
  const filtersActive = hiddenVehicles.size + hiddenCats.size > 0;

  const iconBtn = 'w-10 h-10 rounded-[10px] border border-line bg-white flex items-center justify-center text-ink hover:bg-surface-200 transition-colors';

  return (
    <div className="space-y-6">
      {/* Barra superior */}
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => shiftMonth(-1)} className={iconBtn} aria-label="Mês anterior">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button type="button" onClick={goToday} className="h-10 px-4 rounded-[10px] border border-line bg-white text-sm font-semibold text-ink hover:bg-surface-200">
            Hoje
          </button>
          <button type="button" onClick={() => shiftMonth(1)} className={iconBtn} aria-label="Próximo mês">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <h1 className="text-[28px] leading-[34px] font-bold tracking-[-0.02em] text-navy-deep">
          {MESES[cursor.getMonth()]} <span className="font-medium text-ink-muted">{cursor.getFullYear()}</span>
        </h1>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Modo de visualização" className="inline-flex p-0.5 rounded-[10px] bg-surface-200">
            {(['mes', 'lista'] as const).map(v => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={`h-9 px-4 rounded-lg text-[13px] font-semibold transition ${
                  view === v ? 'bg-white text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
                }`}
              >
                {v === 'mes' ? 'Mês' : 'Lista'}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onScheduleRevision}
            className="h-10 px-4 rounded-[10px] bg-brand-navy hover:bg-navy-deep text-white text-sm font-semibold flex items-center gap-2 active:scale-[0.98] transition"
          >
            <Plus className="w-4 h-4" strokeWidth={2.25} />
            Programar revisão
          </button>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Coluna lateral: mini calendário + filtros */}
        <aside className="w-full lg:w-72 shrink-0 space-y-5">
          <section aria-label="Calendário do mês" className="bg-white rounded-2xl border border-line p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[15px] font-semibold text-ink">
                {MESES[miniCursor.getMonth()]} {miniCursor.getFullYear()}
              </span>
              <span className="flex gap-1">
                <button type="button" aria-label="Mês anterior no minicalendário" onClick={() => setMiniCursor(new Date(miniCursor.getFullYear(), miniCursor.getMonth() - 1, 1))} className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-muted hover:bg-surface-200">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button type="button" aria-label="Próximo mês no minicalendário" onClick={() => setMiniCursor(new Date(miniCursor.getFullYear(), miniCursor.getMonth() + 1, 1))} className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-muted hover:bg-surface-200">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </span>
            </div>
            <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-ink-muted mb-1">
              {DIAS_LETRA.map((d, i) => (
                <span key={i} className="py-1">{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-0.5 text-center">
              {miniGrid.map(d => {
                const key = toKey(d);
                const outside = d.getMonth() !== miniCursor.getMonth();
                const isToday = key === todayKey;
                const has = byDay.has(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => pickDay(d)}
                    aria-label={d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' }) + (has ? ', com serviços' : '')}
                    className={`relative mx-auto w-8 h-8 rounded-full text-[13px] tabular-nums transition-colors ${
                      isToday ? 'bg-brand-navy text-white font-bold' : outside ? 'text-slate-400 hover:bg-surface-200' : 'text-ink hover:bg-surface-200'
                    }`}
                  >
                    {d.getDate()}
                    {has && !isToday && <span aria-hidden="true" className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand-green" />}
                  </button>
                );
              })}
            </div>
          </section>

          <FilterGroup
            title="Veículos"
            onAll={() => setHiddenVehicles(new Set())}
            onNone={() => setHiddenVehicles(new Set(fleet.map(v => v.id)))}
          >
            {fleet.map(v => (
              <CheckRow
                key={v.id}
                checked={!hiddenVehicles.has(v.id)}
                onChange={() => toggle(hiddenVehicles, v.id, setHiddenVehicles)}
                label={v.placa}
                hint={v.modelo}
                mono
              />
            ))}
            {fleet.length === 0 && <p className="text-[13px] text-ink-muted px-1">Nenhum veículo cadastrado.</p>}
          </FilterGroup>

          <FilterGroup
            title="Serviços"
            onAll={() => setHiddenCats(new Set())}
            onNone={() => setHiddenCats(new Set(usedCats))}
          >
            {usedCats.map(c => (
              <CheckRow key={c} checked={!hiddenCats.has(c)} onChange={() => toggle(hiddenCats, c, setHiddenCats)} label={CATEGORIA_LABEL[c]} />
            ))}
            <div className="border-t border-line mt-2 pt-2">
              <CheckRow checked={showDone} onChange={() => setShowDone(!showDone)} label="Mostrar serviços concluídos" />
            </div>
          </FilterGroup>

          <section aria-label="Próximos 30 dias" className="bg-white rounded-2xl border border-line p-4">
            <h2 className="text-[15px] font-semibold text-ink mb-3">Próximos 30 dias</h2>
            {upcoming.length === 0 ? (
              <div className="flex flex-col items-center text-center gap-2 py-4 text-ink-muted">
                <CalendarX2 className="w-6 h-6" strokeWidth={1.5} />
                <p className="text-[13px]">Nenhuma revisão nos próximos dias.</p>
              </div>
            ) : (
              <ul className="space-y-1">
                {upcoming.map(e => (
                  <li key={e.id}>
                    <button type="button" onClick={() => setSelected(e)} className="w-full text-left flex items-start gap-2.5 p-2 rounded-[10px] hover:bg-surface-100">
                      <span aria-hidden="true" className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${ESTADO[e.estado].dot}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-semibold text-ink truncate">{e.placa} · {e.titulo}</span>
                        <span className="block text-[12px] text-ink-muted">
                          {e.estado === 'VENCIDO' ? 'Vencida' : new Date(e.date + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>

        {/* Área principal */}
        <section className="flex-1 min-w-0 w-full">
          {filtersActive && (
            <div className="mb-3 flex flex-wrap items-center gap-2 text-[13px] text-ink-muted">
              <span>
                Mostrando {events.length} de {allEvents.length} itens.
              </span>
              <button type="button" onClick={() => { setHiddenVehicles(new Set()); setHiddenCats(new Set()); }} className="font-semibold text-info hover:underline">
                Limpar filtros
              </button>
            </div>
          )}

          {view === 'mes' ? (
            <div className="bg-white rounded-2xl border border-line overflow-hidden">
              <div className="overflow-x-auto">
                <div className="min-w-[720px]">
                  <div className="grid grid-cols-7 border-b border-line">
                    {DIAS_CURTOS.map(d => (
                      <div key={d} className="py-2.5 text-center text-[12px] font-semibold text-ink-muted">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7">
                    {grid.map((d, i) => {
                      const key = toKey(d);
                      const outside = d.getMonth() !== cursor.getMonth();
                      const isToday = key === todayKey;
                      const list = byDay.get(key) || [];
                      const visible = list.slice(0, 3);
                      return (
                        <div
                          key={key}
                          className={`min-h-[118px] p-1.5 border-line ${i % 7 !== 6 ? 'border-r' : ''} ${i < grid.length - 7 ? 'border-b' : ''} ${outside ? 'bg-surface-100/60' : ''}`}
                        >
                          <div className="flex justify-start mb-1">
                            <span
                              className={`inline-flex items-center justify-center min-w-7 h-7 px-1 rounded-full text-[13px] tabular-nums ${
                                isToday ? 'bg-brand-navy text-white font-bold' : outside ? 'text-slate-400' : 'text-ink font-medium'
                              }`}
                            >
                              {d.getDate()}
                            </span>
                          </div>
                          <div className="space-y-1">
                            {visible.map(e => (
                              <button
                                key={e.id}
                                type="button"
                                onClick={() => setSelected(e)}
                                title={`${e.placa} · ${e.titulo}`}
                                className={`w-full text-left flex flex-col px-2 py-1 rounded-md leading-4 hover:brightness-95 ${ESTADO[e.estado].chip}`}
                              >
                                <span className="font-mono font-bold text-[11px] whitespace-nowrap">{e.placa}</span>
                                <span className="text-[12px] font-medium truncate">{e.titulo}</span>
                              </button>
                            ))}
                            {list.length > 3 && (
                              <button type="button" onClick={() => setDayOpen(key)} className="w-full text-left px-1.5 text-[12px] font-semibold text-info hover:underline">
                                Mais {list.length - 3}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-line overflow-hidden">
              {monthEvents.length === 0 ? (
                <div className="flex flex-col items-center text-center gap-2 py-16 text-ink-muted">
                  <CalendarX2 className="w-8 h-8" strokeWidth={1.5} />
                  <p className="text-[15px]">Nada programado em {MESES[cursor.getMonth()].toLowerCase()} com esses filtros.</p>
                </div>
              ) : (
                <ul>
                  {monthEvents.map((e, i) => {
                    const showDay = i === 0 || monthEvents[i - 1].date !== e.date;
                    return (
                      <li key={e.id}>
                        {showDay && (
                          <div className="px-5 pt-4 pb-1.5 text-[13px] font-semibold text-ink-muted first-letter:uppercase">
                            {new Date(e.date + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                          </div>
                        )}
                        <button type="button" onClick={() => setSelected(e)} className="w-full text-left flex flex-wrap items-center gap-3 px-5 py-3 border-b border-line hover:bg-surface-100">
                          <span className="font-mono font-bold text-[13px] w-20 shrink-0 text-ink">{e.placa}</span>
                          <span className="flex-1 min-w-40">
                            <span className="block text-[15px] font-semibold text-ink">{e.titulo}</span>
                            <span className="block text-[13px] text-ink-muted">{CATEGORIA_LABEL[e.categoria]} · {e.detalhe}</span>
                          </span>
                          <span className={`text-[12px] font-semibold px-2.5 py-1 rounded-full ${ESTADO[e.estado].chip}`}>{ESTADO[e.estado].label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {/* Legenda */}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[12px] text-ink-muted">
            {(Object.keys(ESTADO) as Estado[]).filter(s => showDone || s !== 'CONCLUIDO').map(s => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className={`w-2 h-2 rounded-full ${ESTADO[s].dot}`} />
                {ESTADO[s].label}
              </span>
            ))}
          </div>
        </section>
      </div>

      {/* Detalhe do evento */}
      {selected && (
        <Sheet onClose={() => setSelected(null)} title={selected.titulo}>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-[12px] font-semibold px-2.5 py-1 rounded-full ${ESTADO[selected.estado].chip}`}>{ESTADO[selected.estado].label}</span>
              <span className="text-[13px] text-ink-muted">{CATEGORIA_LABEL[selected.categoria]}</span>
            </div>
            <dl className="grid grid-cols-2 gap-3">
              <div className="bg-surface-100 rounded-[10px] p-3">
                <dt className="text-[12px] font-semibold text-ink-muted">Veículo</dt>
                <dd className="mt-1 font-mono font-bold text-ink">{selected.placa}</dd>
              </div>
              <div className="bg-surface-100 rounded-[10px] p-3">
                <dt className="text-[12px] font-semibold text-ink-muted">Data</dt>
                <dd className="mt-1 font-semibold text-ink">
                  {new Date(selected.date + 'T12:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}
                </dd>
              </div>
            </dl>
            <p className="flex items-start gap-2 text-[14px] text-ink">
              {selected.origem === 'revisao' ? <Gauge className="w-4 h-4 mt-0.5 text-ink-muted shrink-0" /> : <Wrench className="w-4 h-4 mt-0.5 text-ink-muted shrink-0" />}
              <span>{selected.detalhe || 'Sem detalhes.'}</span>
            </p>
            {selected.origem === 'revisao' && selected.estado !== 'EM_DIA' && (
              <button type="button" onClick={() => { setSelected(null); onScheduleRevision(); }} className="w-full h-11 rounded-[10px] bg-brand-navy hover:bg-navy-deep text-white text-sm font-semibold">
                Abrir no plano de revisões
              </button>
            )}
          </div>
        </Sheet>
      )}

      {/* Todos os itens de um dia */}
      {dayOpen && (
        <Sheet
          onClose={() => setDayOpen(null)}
          title={new Date(dayOpen + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        >
          <ul className="space-y-1.5">
            {(byDay.get(dayOpen) || []).map(e => (
              <li key={e.id}>
                <button type="button" onClick={() => { setDayOpen(null); setSelected(e); }} className={`w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-[10px] text-[14px] font-medium ${ESTADO[e.estado].chip}`}>
                  <span className="font-mono font-bold text-[12px]">{e.placa}</span>
                  <span className="truncate">{e.titulo}</span>
                </button>
              </li>
            ))}
          </ul>
        </Sheet>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */

const FilterGroup: React.FC<{ title: string; onAll: () => void; onNone: () => void; children: React.ReactNode }> = ({ title, onAll, onNone, children }) => {
  const [open, setOpen] = useState(true);
  return (
    <section className="bg-white rounded-2xl border border-line p-4">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex items-center gap-1.5 text-[15px] font-semibold text-ink min-h-8">
          {title}
          <ChevronDown className={`w-4 h-4 text-ink-muted transition-transform ${open ? '' : '-rotate-90'}`} />
        </button>
        {open && (
          <span className="flex gap-2 text-[12px] font-semibold">
            <button type="button" onClick={onAll} className="text-info hover:underline">Todos</button>
            <button type="button" onClick={onNone} className="text-info hover:underline">Nenhum</button>
          </span>
        )}
      </div>
      {open && <div className="mt-2 max-h-64 overflow-y-auto -mx-1 px-1 space-y-0.5">{children}</div>}
    </section>
  );
};

const CheckRow: React.FC<{ checked: boolean; onChange: () => void; label: string; hint?: string; mono?: boolean }> = ({ checked, onChange, label, hint, mono }) => (
  <label className="flex items-center gap-2.5 min-h-9 px-1 rounded-lg cursor-pointer hover:bg-surface-100">
    <input type="checkbox" checked={checked} onChange={onChange} className="w-[18px] h-[18px] rounded accent-[#00375a] shrink-0" />
    <span className="min-w-0 flex-1 flex items-baseline gap-2">
      <span className={`text-[14px] text-ink whitespace-nowrap ${mono ? 'font-mono font-semibold' : ''}`}>{label}</span>
      {hint && <span className="text-[12px] text-ink-muted truncate">{hint}</span>}
    </span>
  </label>
);

const Sheet: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
    <div className="absolute inset-0 bg-navy-deep/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
    <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <h2 className="text-[20px] leading-[26px] font-semibold text-ink first-letter:uppercase">{title}</h2>
        <button type="button" onClick={onClose} className="w-9 h-9 -mr-1 -mt-1 rounded-full bg-surface-200 flex items-center justify-center text-ink-muted hover:text-ink" aria-label="Fechar">
          <X className="w-4 h-4" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

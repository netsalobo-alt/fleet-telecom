import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Printer,
  Download,
  Wrench,
  Gauge,
  CalendarClock,
  Receipt,
  Paperclip,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronRight,
  Search,
} from 'lucide-react';
import { Vehicle, ServiceLog, RevisionPlan, LicenciamentoPA, MaintenanceType } from '../types';
import { LicensePlateBadge } from './LicensePlateBadge';

/**
 * Raio-X da frota: histórico completo de serviços, por veículo e geral.
 * Totais contam só serviços concluídos; agendados e em andamento aparecem
 * na linha do tempo marcados, mas fora da soma.
 */

interface HistoryViewProps {
  vehicles: Vehicle[];
  services: ServiceLog[];
  revisions: RevisionPlan[];
  licensingList: LicenciamentoPA[];
  /** Abre direto num veículo (ex.: vindo da Frota). */
  initialVehicleId?: string | null;
}

const TIPO_LABEL: Record<MaintenanceType, string> = {
  OLEO: 'Troca de óleo',
  MECANICA: 'Mecânica',
  ELETRICA: 'Elétrica e bateria',
  PNEU: 'Pneus e alinhamento',
  FUNILARIA: 'Funilaria e pintura',
  REVISAO_PROGRAMADA: 'Revisão programada',
  VISTORIA: 'Vistoria',
  OUTROS: 'Outros',
};

const STATUS_SERVICO: Record<ServiceLog['status'], string> = {
  CONCLUIDO: 'Concluído',
  AGENDADO: 'Agendado',
  EM_ANDAMENTO: 'Em andamento',
};

type Periodo = 'tudo' | '12m' | 'ano';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brl0 = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const km = (n: number) => `${Math.round(n).toLocaleString('pt-BR')} km`;
const dataBR = (iso?: string) => (iso ? new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR') : '—');
const mesCurto = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '');
};

function servicosDoVeiculo(v: Vehicle, services: ServiceLog[]) {
  return services.filter(s => s.veiculoId === v.id || s.placa === v.placa);
}

function dentroDoPeriodo(s: ServiceLog, periodo: Periodo, ano: number) {
  if (periodo === 'tudo') return true;
  if (periodo === 'ano') return s.data?.startsWith(String(ano));
  const limite = new Date();
  limite.setFullYear(limite.getFullYear() - 1);
  return new Date(s.data + 'T12:00:00') >= limite;
}

/** Números do veículo no período. */
function resumo(v: Vehicle, lista: ServiceLog[]) {
  const concluidos = lista.filter(s => s.status === 'CONCLUIDO');
  const total = concluidos.reduce((t, s) => t + (s.valorTotal || 0), 0);
  const pecas = concluidos.reduce((t, s) => t + (s.valorPecas || 0), 0);
  const maoDeObra = concluidos.reduce((t, s) => t + (s.valorMaoDeObra || 0), 0);
  const ordenados = [...concluidos].sort((a, b) => a.data.localeCompare(b.data));
  const kmAtual = v.odometroEstimado ?? v.odometroAtual ?? 0;
  const kmInicial = ordenados.find(s => s.odometro > 0)?.odometro ?? 0;
  const kmRodados = kmInicial > 0 && kmAtual > kmInicial ? kmAtual - kmInicial : 0;
  return {
    qtd: concluidos.length,
    pendentes: lista.length - concluidos.length,
    total,
    pecas,
    maoDeObra,
    ultimo: ordenados[ordenados.length - 1],
    custoKm: kmRodados > 0 ? total / kmRodados : null,
    kmRodados,
    kmAtual,
    pctFipe: v.valorVenalFipe > 0 ? (total / v.valorVenalFipe) * 100 : null,
  };
}

function baixarCsv(nome: string, linhas: (string | number)[][]) {
  const esc = (x: string | number) => {
    const s = String(x ?? '');
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // Ponto e vírgula + BOM: abre direto no Excel em português
  const csv = '﻿' + linhas.map(l => l.map(esc).join(';')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

const num = (n: number) => n.toFixed(2).replace('.', ',');

// ---------------------------------------------------------------------------
// Barras horizontais de uma série só (navy), com o valor escrito ao lado
// ---------------------------------------------------------------------------
const Barras: React.FC<{ itens: { rotulo: string; valor: number; detalhe?: string }[]; titulo: string }> = ({ itens, titulo }) => {
  const max = Math.max(...itens.map(i => i.valor), 1);
  if (!itens.length) return <p className="text-[13px] text-ink-muted">Sem gastos no período.</p>;
  return (
    <ul className="space-y-2.5 text-[13px]" aria-label={titulo}>
      {itens.map(i => (
        <li key={i.rotulo} title={`${i.rotulo}: ${brl(i.valor)}${i.detalhe ? ` · ${i.detalhe}` : ''}`}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-navy-deep truncate">{i.rotulo}</span>
            <span className="tabular-nums text-navy-deep shrink-0">
              {brl0(i.valor)}
            </span>
          </div>
          <div className="mt-1 h-2 bg-surface-100 rounded-r" aria-hidden="true">
            <div className="h-2 rounded-r bg-brand-navy print-bar" style={{ width: `${Math.max((i.valor / max) * 100, 1.5)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
};

const Kpi: React.FC<{ rotulo: string; valor: string; nota?: string }> = ({ rotulo, valor, nota }) => (
  <div className="bg-white rounded-2xl border border-line p-4">
    <div className="text-[12px] text-ink-muted">{rotulo}</div>
    <div className="text-[22px] font-bold text-navy-deep tabular-nums mt-0.5">{valor}</div>
    {nota && <div className="text-[12px] text-ink-muted mt-0.5">{nota}</div>}
  </div>
);

// ---------------------------------------------------------------------------
export const HistoryView: React.FC<HistoryViewProps> = ({ vehicles, services, revisions, licensingList, initialVehicleId }) => {
  const [veiculoId, setVeiculoId] = useState<string | null>(initialVehicleId ?? null);
  const [periodo, setPeriodo] = useState<Periodo>('tudo');
  const anos = useMemo(() => {
    const set = new Set(services.map(s => Number(s.data?.slice(0, 4))).filter(Boolean));
    set.add(new Date().getFullYear());
    return [...set].sort((a, b) => b - a);
  }, [services]);
  const [ano, setAno] = useState(anos[0]);
  const [busca, setBusca] = useState('');

  const noPeriodo = useMemo(() => services.filter(s => dentroDoPeriodo(s, periodo, ano)), [services, periodo, ano]);
  const veiculo = vehicles.find(v => v.id === veiculoId) || null;
  const periodoTexto = periodo === 'tudo' ? 'Todo o histórico' : periodo === '12m' ? 'Últimos 12 meses' : `Ano de ${ano}`;

  const Filtros = (
    <div className="flex flex-wrap items-center gap-2 no-print" role="group" aria-label="Período">
      {(
        [
          ['tudo', 'Todo o histórico'],
          ['12m', 'Últimos 12 meses'],
          ['ano', 'Ano'],
        ] as [Periodo, string][]
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          aria-pressed={periodo === id}
          onClick={() => setPeriodo(id)}
          className={`h-9 px-3 rounded-[10px] text-[13px] font-semibold border ${
            periodo === id ? 'bg-brand-navy text-white border-brand-navy' : 'bg-white text-brand-navy border-line hover:bg-surface-100'
          }`}
        >
          {label}
        </button>
      ))}
      {periodo === 'ano' && (
        <select
          aria-label="Ano"
          value={ano}
          onChange={e => setAno(Number(e.target.value))}
          className="h-9 px-2 rounded-[10px] border border-line bg-white text-[13px] text-navy-deep"
        >
          {anos.map(a => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      )}
    </div>
  );

  // =========================================================================
  // RAIO-X DE UM VEÍCULO
  // =========================================================================
  if (veiculo) {
    const todos = servicosDoVeiculo(veiculo, services);
    const lista = todos.filter(s => dentroDoPeriodo(s, periodo, ano)).sort((a, b) => b.data.localeCompare(a.data) || b.odometro - a.odometro);
    const r = resumo(veiculo, lista);

    const porTipo = Object.entries(
      lista
        .filter(s => s.status === 'CONCLUIDO')
        .reduce<Record<string, { valor: number; qtd: number }>>((acc, s) => {
          const k = TIPO_LABEL[s.tipo] || s.tipo;
          acc[k] = { valor: (acc[k]?.valor || 0) + (s.valorTotal || 0), qtd: (acc[k]?.qtd || 0) + 1 };
          return acc;
        }, {}),
    )
      .map(([rotulo, x]) => ({ rotulo, valor: x.valor, detalhe: `${x.qtd} serviço(s)` }))
      .sort((a, b) => b.valor - a.valor);

    const porFornecedor = Object.entries(
      lista
        .filter(s => s.status === 'CONCLUIDO')
        .reduce<Record<string, number>>((acc, s) => {
          const k = s.fornecedorNome || s.fornecedor || 'Sem fornecedor';
          acc[k] = (acc[k] || 0) + (s.valorTotal || 0);
          return acc;
        }, {}),
    )
      .map(([rotulo, valor]) => ({ rotulo, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 6);

    const revs = revisions
      .filter(rv => rv.veiculoId === veiculo.id || rv.placa === veiculo.placa)
      .sort((a, b) => ({ VENCIDO: 0, PROXIMO: 1, EM_DIA: 2 }[a.status] - { VENCIDO: 0, PROXIMO: 1, EM_DIA: 2 }[b.status]));
    const lic = licensingList.filter(l => l.placa === veiculo.placa).sort((a, b) => b.exercicio - a.exercicio)[0];

    const exportar = () =>
      baixarCsv(`raio-x-${veiculo.placa}.csv`, [
        ['Data', 'Km', 'Tipo', 'Situação', 'Fornecedor', 'O que foi feito', 'Peças (R$)', 'Mão de obra (R$)', 'Total (R$)', 'Lançado por', 'Observações'],
        ...lista.map(s => [
          dataBR(s.data),
          s.odometro || '',
          TIPO_LABEL[s.tipo] || s.tipo,
          STATUS_SERVICO[s.status],
          s.fornecedorNome || s.fornecedor || '',
          [
            ...(s.servicos || []).map(x => x.descricao),
            ...(s.pecas || []).map(p => `${p.quantidade}x ${p.descricao}`),
          ].join(' | ') || s.descricaoResumida || '',
          num(s.valorPecas || 0),
          num(s.valorMaoDeObra || 0),
          num(s.valorTotal || 0),
          s.criadoPorNome || '',
          s.observacoes || '',
        ]),
      ]);

    return (
      <div className="space-y-6 print-area">
        <div className="flex flex-wrap items-center justify-between gap-3 no-print">
          <button
            type="button"
            onClick={() => setVeiculoId(null)}
            className="h-9 px-3 -ml-3 rounded-[10px] text-[14px] font-semibold text-brand-navy hover:bg-surface-200 flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" /> Frota inteira
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={exportar} className="h-9 px-3 rounded-[10px] border border-line bg-white text-[13px] font-semibold text-brand-navy hover:bg-surface-100 flex items-center gap-1.5">
              <Download className="w-4 h-4" /> Planilha
            </button>
            <button type="button" onClick={() => window.print()} className="h-9 px-3 rounded-[10px] bg-brand-navy hover:bg-navy-deep text-white text-[13px] font-semibold flex items-center gap-1.5">
              <Printer className="w-4 h-4" /> Imprimir / PDF
            </button>
          </div>
        </div>

        {/* Ficha */}
        <header className="bg-white rounded-2xl border border-line p-5 flex flex-col md:flex-row md:items-center gap-5">
          <LicensePlateBadge placa={veiculo.placa} size="lg" />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] text-ink-muted uppercase tracking-wide">Raio-X do veículo · {periodoTexto}</p>
            <h1 className="text-[26px] font-bold text-navy-deep tracking-[-0.01em]">
              {veiculo.marca} {veiculo.modelo}
            </h1>
            <p className="text-[14px] text-ink-muted">
              {veiculo.ano} · {veiculo.cor} · {veiculo.combustivel} · Motorista: {veiculo.motoristaNome || 'não atribuído'}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-[13px]">
            <dt className="text-ink-muted">Km atual</dt>
            <dd className="text-navy-deep tabular-nums text-right">{km(r.kmAtual)}</dd>
            <dt className="text-ink-muted">Chassi</dt>
            <dd className="text-navy-deep font-mono text-[12px] text-right">{veiculo.chassi || '—'}</dd>
            <dt className="text-ink-muted">Renavam</dt>
            <dd className="text-navy-deep font-mono text-[12px] text-right">{veiculo.renavam || '—'}</dd>
            <dt className="text-ink-muted">FIPE</dt>
            <dd className="text-navy-deep tabular-nums text-right">{veiculo.valorVenalFipe ? brl0(veiculo.valorVenalFipe) : '—'}</dd>
          </dl>
        </header>

        <div className="no-print">{Filtros}</div>

        {/* Números */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi rotulo="Gasto total" valor={brl0(r.total)} nota={`Peças ${brl0(r.pecas)} · Mão de obra ${brl0(r.maoDeObra)}`} />
          <Kpi rotulo="Serviços realizados" valor={String(r.qtd)} nota={r.pendentes ? `+ ${r.pendentes} agendado(s)/em andamento` : undefined} />
          <Kpi
            rotulo="Custo por km"
            valor={r.custoKm !== null ? brl(r.custoKm) : '—'}
            nota={r.custoKm !== null ? `em ${km(r.kmRodados)} desde o 1º serviço` : 'precisa de km nos serviços'}
          />
          <Kpi
            rotulo="Gasto sobre a FIPE"
            valor={r.pctFipe !== null ? `${r.pctFipe.toFixed(1).replace('.', ',')}%` : '—'}
            nota={r.ultimo ? `Último serviço em ${dataBR(r.ultimo.data)}` : 'Nenhum serviço concluído'}
          />
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          <section className="bg-white rounded-2xl border border-line p-5 break-inside-avoid">
            <h2 className="text-[15px] font-semibold text-navy-deep mb-3">Gasto por tipo de serviço</h2>
            <Barras titulo="Gasto por tipo de serviço" itens={porTipo} />
          </section>
          <section className="bg-white rounded-2xl border border-line p-5 break-inside-avoid">
            <h2 className="text-[15px] font-semibold text-navy-deep mb-3">Onde foi feito</h2>
            <Barras titulo="Gasto por fornecedor" itens={porFornecedor} />
          </section>
          <section className="bg-white rounded-2xl border border-line p-5 md:col-span-2 xl:col-span-1 space-y-3 break-inside-avoid">
            <h2 className="text-[15px] font-semibold text-navy-deep">Situação agora</h2>
            <ul className="space-y-2 text-[13px]">
              {revs.length === 0 && <li className="text-ink-muted">Nenhum plano de revisão.</li>}
              {revs.slice(0, 5).map(rv => (
                <li key={rv.id} className="flex items-start gap-2">
                  {rv.status === 'VENCIDO' ? (
                    <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" aria-hidden="true" />
                  ) : rv.status === 'PROXIMO' ? (
                    <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-green-text shrink-0 mt-0.5" aria-hidden="true" />
                  )}
                  <span className="text-navy-deep">
                    {rv.titulo}
                    <span className="block text-ink-muted">
                      {rv.status === 'VENCIDO' ? 'Vencida' : rv.status === 'PROXIMO' ? 'Próxima' : 'Em dia'} · {km(rv.proximoKm)} ou {dataBR(rv.proximaData)}
                    </span>
                  </span>
                </li>
              ))}
              {lic && (
                <li className="flex items-start gap-2 pt-2 border-t border-line">
                  {lic.pago ? (
                    <CheckCircle2 className="w-4 h-4 text-green-text shrink-0 mt-0.5" aria-hidden="true" />
                  ) : (
                    <Receipt className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
                  )}
                  <span className="text-navy-deep">
                    IPVA e licenciamento {lic.exercicio}
                    <span className="block text-ink-muted">
                      {lic.pago ? 'Pago' : `Em aberto · ${brl0(lic.valorTotalEstimado)}`}
                    </span>
                  </span>
                </li>
              )}
            </ul>
          </section>
        </div>

        {/* Linha do tempo */}
        <section className="bg-white rounded-2xl border border-line">
          <div className="px-5 py-4 border-b border-line flex items-baseline justify-between gap-3">
            <h2 className="text-[17px] font-semibold text-navy-deep">Histórico de serviços</h2>
            <span className="text-[13px] text-ink-muted">{lista.length} registro(s) · mais recente primeiro</span>
          </div>
          {lista.length === 0 ? (
            <p className="p-8 text-center text-[14px] text-ink-muted">Nenhum serviço registrado para este veículo no período.</p>
          ) : (
            <ol className="divide-y divide-line">
              {lista.map(s => (
                <li key={s.id} className="p-5 grid md:grid-cols-[120px_1fr_auto] gap-x-5 gap-y-2 break-inside-avoid">
                  <div className="text-[13px]">
                    <div className="font-semibold text-navy-deep">{dataBR(s.data)}</div>
                    <div className="text-ink-muted tabular-nums flex items-center gap-1">
                      <Gauge className="w-3.5 h-3.5" aria-hidden="true" />
                      {s.odometro ? km(s.odometro) : 'km não informado'}
                    </div>
                  </div>

                  <div className="min-w-0 text-[14px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-navy-deep">{TIPO_LABEL[s.tipo] || s.tipo}</span>
                      {s.status !== 'CONCLUIDO' && (
                        <span className="text-[11px] font-semibold rounded-full bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5">
                          {STATUS_SERVICO[s.status]} · fora do total
                        </span>
                      )}
                      <span className="text-ink-muted text-[13px]">{s.fornecedorNome || s.fornecedor || 'Sem fornecedor'}</span>
                    </div>
                    {s.descricaoResumida && <p className="text-ink-muted text-[13px] mt-0.5">{s.descricaoResumida}</p>}

                    {(s.servicos?.length > 0 || s.pecas?.length > 0) && (
                      <table className="mt-2 w-full text-[13px]">
                        <tbody>
                          {(s.servicos || []).map((x, i) => (
                            <tr key={`m${i}`}>
                              <td className="py-0.5 pr-3 text-navy-deep">
                                <Wrench className="inline w-3.5 h-3.5 mr-1 text-ink-muted -mt-0.5" aria-label="Serviço" />
                                {x.descricao}
                              </td>
                              <td className="py-0.5 text-right tabular-nums text-ink-muted whitespace-nowrap">{brl(x.valor || 0)}</td>
                            </tr>
                          ))}
                          {(s.pecas || []).map((p, i) => (
                            <tr key={`p${i}`}>
                              <td className="py-0.5 pr-3 text-navy-deep">
                                <span className="text-ink-muted tabular-nums mr-1">{p.quantidade}×</span>
                                {p.descricao}
                              </td>
                              <td className="py-0.5 text-right tabular-nums text-ink-muted whitespace-nowrap">{brl(p.total || 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {s.observacoes && <p className="mt-2 text-[13px] text-ink-muted">Obs.: {s.observacoes}</p>}
                    <p className="mt-2 text-[12px] text-ink-muted flex flex-wrap gap-x-3">
                      {s.criadoPorNome && <span>Lançado por {s.criadoPorNome}</span>}
                      {s.editadoPorNome && <span>Editado por {s.editadoPorNome}</span>}
                      {s.anexoDocumento && (
                        <span className="flex items-center gap-1">
                          <Paperclip className="w-3 h-3" aria-hidden="true" /> {s.anexoDocumento.nome}
                        </span>
                      )}
                      {s.proximaRevisaoKm > 0 && (
                        <span className="flex items-center gap-1">
                          <CalendarClock className="w-3 h-3" aria-hidden="true" /> Próxima: {km(s.proximaRevisaoKm)}
                          {s.proximaRevisaoData ? ` ou ${dataBR(s.proximaRevisaoData)}` : ''}
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="text-right md:min-w-[120px]">
                    <div className="text-[17px] font-bold text-navy-deep tabular-nums">{brl(s.valorTotal || 0)}</div>
                    <div className="text-[12px] text-ink-muted tabular-nums">
                      Peças {brl0(s.valorPecas || 0)}
                      <br />
                      M. obra {brl0(s.valorMaoDeObra || 0)}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
          {lista.length > 0 && (
            <div className="px-5 py-4 border-t border-line flex justify-between text-[14px]">
              <span className="text-ink-muted">Total concluído no período</span>
              <span className="font-bold text-navy-deep tabular-nums">{brl(r.total)}</span>
            </div>
          )}
        </section>

        <p className="hidden print-only text-[11px] text-ink-muted">
          Fleet Telecom · gerado em {new Date().toLocaleString('pt-BR')}
        </p>
      </div>
    );
  }

  // =========================================================================
  // VISÃO GERAL DA FROTA
  // =========================================================================
  const linhas = vehicles
    .map(v => {
      const lista = servicosDoVeiculo(v, noPeriodo);
      return { v, r: resumo(v, lista) };
    })
    .sort((a, b) => b.r.total - a.r.total);

  const totalFrota = linhas.reduce((t, l) => t + l.r.total, 0);
  const qtdFrota = linhas.reduce((t, l) => t + l.r.qtd, 0);
  const pecasFrota = linhas.reduce((t, l) => t + l.r.pecas, 0);
  const maoFrota = linhas.reduce((t, l) => t + l.r.maoDeObra, 0);

  const porMes = Object.entries(
    noPeriodo
      .filter(s => s.status === 'CONCLUIDO')
      .reduce<Record<string, number>>((acc, s) => {
        const k = s.data.slice(0, 7);
        acc[k] = (acc[k] || 0) + (s.valorTotal || 0);
        return acc;
      }, {}),
  )
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 12)
    .map(([ym, valor]) => ({ rotulo: mesCurto(ym), valor }));

  const porTipoFrota = Object.entries(
    noPeriodo
      .filter(s => s.status === 'CONCLUIDO')
      .reduce<Record<string, number>>((acc, s) => {
        const k = TIPO_LABEL[s.tipo] || s.tipo;
        acc[k] = (acc[k] || 0) + (s.valorTotal || 0);
        return acc;
      }, {}),
  )
    .map(([rotulo, valor]) => ({ rotulo, valor }))
    .sort((a, b) => b.valor - a.valor);

  const filtradas = linhas.filter(({ v }) => {
    const q = busca.trim().toLowerCase();
    return !q || [v.placa, v.modelo, v.marca, v.motoristaNome].some(x => (x || '').toLowerCase().includes(q));
  });

  const exportarGeral = () =>
    baixarCsv(`raio-x-frota.csv`, [
      ['Placa', 'Veículo', 'Ano', 'Motorista', 'Serviços', 'Peças (R$)', 'Mão de obra (R$)', 'Total (R$)', 'Custo por km (R$)', 'Último serviço', 'Km atual'],
      ...linhas.map(({ v, r }) => [
        v.placa,
        `${v.marca} ${v.modelo}`,
        v.ano,
        v.motoristaNome || '',
        r.qtd,
        num(r.pecas),
        num(r.maoDeObra),
        num(r.total),
        r.custoKm !== null ? num(r.custoKm) : '',
        r.ultimo ? dataBR(r.ultimo.data) : '',
        Math.round(r.kmAtual),
      ]),
    ]);

  return (
    <div className="space-y-6 print-area">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] sm:text-[34px] font-bold tracking-[-0.02em] text-navy-deep">Raio-X da frota</h1>
          <p className="text-[15px] text-ink-muted mt-1">
            Tudo o que já foi feito em cada carro, quanto custou e onde. {periodoTexto}.
          </p>
        </div>
        <div className="flex gap-2 no-print">
          <button type="button" onClick={exportarGeral} className="h-9 px-3 rounded-[10px] border border-line bg-white text-[13px] font-semibold text-brand-navy hover:bg-surface-100 flex items-center gap-1.5">
            <Download className="w-4 h-4" /> Planilha
          </button>
          <button type="button" onClick={() => window.print()} className="h-9 px-3 rounded-[10px] bg-brand-navy hover:bg-navy-deep text-white text-[13px] font-semibold flex items-center gap-1.5">
            <Printer className="w-4 h-4" /> Imprimir / PDF
          </button>
        </div>
      </div>

      {Filtros}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi rotulo="Gasto da frota" valor={brl0(totalFrota)} nota={`${vehicles.length} veículo(s)`} />
        <Kpi rotulo="Serviços realizados" valor={String(qtdFrota)} />
        <Kpi rotulo="Gasto médio por veículo" valor={brl0(vehicles.length ? totalFrota / vehicles.length : 0)} />
        <Kpi
          rotulo="Peças × mão de obra"
          valor={totalFrota ? `${Math.round((pecasFrota / totalFrota) * 100)}% peças` : '—'}
          nota={totalFrota ? `${brl0(pecasFrota)} em peças` : undefined}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="bg-white rounded-2xl border border-line p-5 break-inside-avoid">
          <h2 className="text-[15px] font-semibold text-navy-deep mb-3">Gasto por mês</h2>
          <Barras titulo="Gasto por mês" itens={porMes} />
        </section>
        <section className="bg-white rounded-2xl border border-line p-5 break-inside-avoid">
          <h2 className="text-[15px] font-semibold text-navy-deep mb-3">Gasto por tipo de serviço</h2>
          <Barras titulo="Gasto da frota por tipo de serviço" itens={porTipoFrota} />
        </section>
      </div>

      <section className="bg-white rounded-2xl border border-line overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-[17px] font-semibold text-navy-deep">Por veículo</h2>
          <div className="relative no-print">
            <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Placa, modelo ou motorista"
              aria-label="Buscar veículo"
              className="h-9 w-64 max-w-full rounded-[10px] border border-line pl-9 pr-3 text-[13px] text-navy-deep focus:outline-none focus:ring-2 focus:ring-focus"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-ink-muted border-b border-line">
                <th scope="col" className="font-medium px-5 py-2">Veículo</th>
                <th scope="col" className="font-medium px-3 py-2 text-right">Serviços</th>
                <th scope="col" className="font-medium px-3 py-2 text-right">Peças</th>
                <th scope="col" className="font-medium px-3 py-2 text-right">Mão de obra</th>
                <th scope="col" className="font-medium px-3 py-2 text-right">Total</th>
                <th scope="col" className="font-medium px-3 py-2 text-right">R$/km</th>
                <th scope="col" className="font-medium px-3 py-2">Último serviço</th>
                <th scope="col" className="px-3 py-2 no-print"><span className="sr-only">Abrir</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtradas.map(({ v, r }) => (
                <tr
                  key={v.id}
                  className="hover:bg-surface-100 cursor-pointer"
                  onClick={() => setVeiculoId(v.id)}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <LicensePlateBadge placa={v.placa} size="sm" />
                      <span className="min-w-0">
                        <span className="block font-semibold text-navy-deep truncate">{v.marca} {v.modelo}</span>
                        <span className="block text-ink-muted truncate">{v.ano} · {v.motoristaNome || 'sem motorista'}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-navy-deep">{r.qtd}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-ink-muted">{brl0(r.pecas)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-ink-muted">{brl0(r.maoDeObra)}</td>
                  <td className="px-3 py-3 text-right tabular-nums font-semibold text-navy-deep">{brl0(r.total)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-ink-muted">{r.custoKm !== null ? brl(r.custoKm) : '—'}</td>
                  <td className="px-3 py-3 text-ink-muted whitespace-nowrap">
                    {r.ultimo ? `${dataBR(r.ultimo.data)} · ${TIPO_LABEL[r.ultimo.tipo] || r.ultimo.tipo}` : 'Nenhum'}
                  </td>
                  <td className="px-3 py-3 no-print">
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        setVeiculoId(v.id);
                      }}
                      className="h-8 px-2 rounded-lg text-brand-navy hover:bg-surface-200 flex items-center gap-1 text-[13px] font-semibold"
                      aria-label={`Abrir o raio-X de ${v.placa}`}
                    >
                      Raio-X <ChevronRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtradas.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-ink-muted">Nenhum veículo encontrado.</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t border-line font-semibold text-navy-deep">
                <td className="px-5 py-3">Frota</td>
                <td className="px-3 py-3 text-right tabular-nums">{qtdFrota}</td>
                <td className="px-3 py-3 text-right tabular-nums">{brl0(pecasFrota)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{brl0(maoFrota)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{brl0(totalFrota)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
      <p className="text-[12px] text-ink-muted">
        Os totais somam só serviços concluídos. Custo por km = gasto ÷ km rodados desde o primeiro serviço com km informado.
      </p>
    </div>
  );
};

import React, { useState } from 'react';
import {
  Car,
  Activity,
  AlertTriangle,
  Clock,
  Sparkles,
  Send,
  Wrench,
  ShieldAlert,
  CheckCircle2,
  CalendarCheck2,
  FileText,
  MapPin,
  TrendingUp,
  DollarSign,
  ChevronRight,
  Radio,
  RefreshCw,
  Gauge,
} from 'lucide-react';
import { Vehicle, ServiceLog, RevisionPlan, LicenciamentoPA, TelemetryAlert } from '../types';
import { LicensePlateBadge } from './LicensePlateBadge';
import { TabType } from './Navbar';

interface DashboardViewProps {
  vehicles: Vehicle[];
  services: ServiceLog[];
  revisions: RevisionPlan[];
  licensingList: LicenciamentoPA[];
  alerts: TelemetryAlert[];
  setCurrentTab: (tab: TabType) => void;
  /** O usuário pode lançar serviços? Esconde o botão de quem não pode. */
  canLaunch?: boolean;
  onSendWhatsAppAlert: (message: string, placa: string) => Promise<boolean>;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  vehicles,
  services,
  revisions,
  licensingList,
  alerts,
  setCurrentTab,
  canLaunch = true,
  onSendWhatsAppAlert,
}) => {
  const [isGeneratingAiReport, setIsGeneratingAiReport] = useState(false);
  const [aiReport, setAiReport] = useState<any | null>(null);
  const [sentAlertIndex, setSentAlertIndex] = useState<number | null>(null);

  // Metrics
  const activeVehicles = vehicles.filter(v => v.status === 'OPERANDO').length;
  const overdueRevisions = revisions.filter(r => r.status === 'VENCIDO').length;
  const upcomingRevisions = revisions.filter(r => r.status === 'PROXIMO').length;
  const overdueLicensing = licensingList.filter(l => l.status === 'VENCIDO' && !l.pago).length;
  const imminentLicensing = licensingList.filter(l => l.status === 'VENCE_EM_BREVE' && !l.pago).length;
  const totalKmFrota = vehicles.reduce((acc, curr) => acc + (curr.odometroEstimado ?? curr.odometroAtual), 0);
  const totalGastoMes = services.reduce((acc, curr) => acc + curr.valorTotal, 0);
  const criticalAlertsCount = alerts.filter(a => !a.resolvido && a.nivel === 'CRITICO').length;

  // AI Fleet Advisor Call
  const handleGenerateAdvisor = async () => {
    setIsGeneratingAiReport(true);
    try {
      const response = await fetch('/api/gemini/fleet-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicles: vehicles.map(v => ({
            placa: v.placa,
            modelo: v.modelo,
            status: v.status,
            odometro: v.odometroEstimado ?? v.odometroAtual,
            odometroRastreador: v.odometroRastreador,
            cidade: v.localizacao.cidade,
          })),
          pendingRevisions: revisions.filter(r => r.status !== 'EM_DIA'),
          licensingAlerts: licensingList.filter(l => !l.pago),
        }),
      });

      const data = await response.json();
      if (data && data.success) {
        setAiReport(data.data);
      }
    } catch (e) {
      console.error('Falha ao gerar relatório executivo IA:', e);
    } finally {
      setIsGeneratingAiReport(false);
    }
  };

  const handleSendDraftAlert = async (text: string, index: number) => {
    setSentAlertIndex(index);
    await onSendWhatsAppAlert(text, 'FROTA-PA');
    setTimeout(() => setSentAlertIndex(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho: título grande no estilo Apple */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[13px] font-semibold text-ink-muted first-letter:uppercase">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="text-[32px] leading-[38px] font-bold tracking-[-0.02em] text-navy-deep">Visão geral</h1>
          <p className="text-[15px] text-ink-muted">Frota, revisões e documentos num só lugar.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleGenerateAdvisor}
            disabled={isGeneratingAiReport}
            className="h-10 px-4 rounded-[10px] bg-white border border-line-strong text-brand-navy text-sm font-semibold flex items-center gap-2 hover:bg-surface-200 disabled:opacity-60 transition-colors"
          >
            {isGeneratingAiReport ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Analisando a frota…</span>
              </>
            ) : (
              <>
                <Activity className="w-4 h-4" />
                <span>Diagnóstico com IA</span>
              </>
            )}
          </button>
          {canLaunch && (
          <button
            type="button"
            onClick={() => setCurrentTab('maintenance')}
            className="h-10 px-4 rounded-[10px] bg-brand-navy hover:bg-navy-deep text-white text-sm font-semibold flex items-center gap-2 active:scale-[0.98] transition"
          >
            <Sparkles className="w-4 h-4" />
            <span>Lançar serviço</span>
          </button>
          )}
        </div>
      </header>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Vehicles */}
        <div
          onClick={() => setCurrentTab('vehicles')}
          className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-slate-300 cursor-pointer transition-all space-y-2 group"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Frota Operacional</span>
            <div className="p-2 rounded-lg bg-sky-50 text-sky-700 group-hover:bg-brand-navy group-hover:text-white transition-colors">
              <Car className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-[#00375a] tabular-nums tracking-tight">
              {activeVehicles}
            </span>
            <span className="text-xs text-slate-500 font-medium">de {vehicles.length} veículos</span>
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            {((activeVehicles / (vehicles.length || 1)) * 100).toFixed(0)}% com ignição ativa
          </div>
        </div>

        {/* Card 2: Revisions */}
        <div
          onClick={() => setCurrentTab('revisions')}
          className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-slate-300 cursor-pointer transition-all space-y-2 group"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Revisões Pendentes</span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <CalendarCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums tracking-tight">
              {overdueRevisions + upcomingRevisions}
            </span>
            {overdueRevisions > 0 && (
              <span className="text-xs font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                {overdueRevisions} vencida{overdueRevisions > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500">
            {upcomingRevisions} a vencer nos próximos 1.500 km
          </div>
        </div>

        {/* Card 3: DETRAN Pará Licenciamento */}
        <div
          onClick={() => setCurrentTab('detran')}
          className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-slate-300 cursor-pointer transition-all space-y-2 group"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>DETRAN-PA / IPVA 2026</span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-[#00375a] tabular-nums tracking-tight">
              {imminentLicensing + overdueLicensing}
            </span>
            <span className="text-xs text-slate-500">vencendo/vencidos</span>
          </div>
          <div className="text-[11px] text-slate-600">
            {overdueLicensing > 0 ? (
              <span className="text-red-600 font-bold">🚨 {overdueLicensing} irregular no Pará</span>
            ) : (
              <span className="text-emerald-700 font-medium">Todos em conformidade fiscal</span>
            )}
          </div>
        </div>

        {/* Card 4: Total Maintenance Expense */}
        <div
          onClick={() => setCurrentTab('maintenance')}
          className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-slate-300 cursor-pointer transition-all space-y-2 group"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Gasto de Manutenção</span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums tracking-tight">
              R$ {totalGastoMes.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            {services.length} ordens de serviço cadastradas
          </div>
        </div>
      </div>

      {/* AI Fleet Health Advisor Section (When generated or by default) */}
      {aiReport && (
        <div className="bg-white rounded-2xl border-2 border-sky-400/40 p-6 shadow-md space-y-4 animate-in fade-in duration-300">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-700 flex items-center justify-center text-white shadow-xs">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-[#00375a] text-base">
                  Diagnóstico Técnico Inteligente (Gemini 3.8 Flash)
                </h3>
                <span className="text-xs text-slate-500">
                  Índice de Conformidade Geral da Frota: <strong>{aiReport.indiceConformidade || 88}/100</strong>
                </span>
              </div>
            </div>

            <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-3 py-1 rounded-full border border-emerald-300">
              Análise Concluída
            </span>
          </div>

          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-sans">
            {aiReport.resumoGeral}
          </p>

          {/* Action Points */}
          {aiReport.acoesPrioritarias && (
            <div className="space-y-1.5 pt-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                Ações Imediatas Recomendadas:
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                {aiReport.acoesPrioritarias.map((acao: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-800 font-bold flex items-center justify-center shrink-0 text-[11px]">
                      {i + 1}
                    </span>
                    <span className="text-slate-700">{acao}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Alertas sugeridos para o WhatsApp */}
          {aiReport.whatsappAlertas && aiReport.whatsappAlertas.length > 0 && (
            <div className="space-y-2 pt-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                Alertas prontos para enviar pelo WhatsApp:
              </span>
              <div className="space-y-2">
                {aiReport.whatsappAlertas.map((msg: string, i: number) => (
                  <div
                    key={i}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-3 rounded-lg border border-slate-200 text-xs"
                  >
                    <span className="text-slate-800 font-medium whitespace-pre-line">{msg}</span>
                    <button
                      onClick={() => handleSendDraftAlert(msg, i)}
                      className="bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 shrink-0 transition-colors"
                    >
                      {sentAlertIndex === i ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                          <span>Transmitido!</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Enviar no WhatsApp</span>
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Split: Left Urgencies & Recent Activity, Right Live Fleet Telemetry Snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Urgencies & Actions */}
        <div className="lg:col-span-7 space-y-5">
          {/* Urgent Revision Warnings */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <h3 className="font-bold text-sm text-[#00375a]">
                  Atenção Prioritária: Revisões que Exigem Parada
                </h3>
              </div>
              <button
                onClick={() => setCurrentTab('revisions')}
                className="text-xs text-sky-600 hover:text-sky-800 font-semibold flex items-center gap-0.5"
              >
                <span>Ver todas</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2.5">
              {revisions
                .filter(r => r.status === 'VENCIDO' || r.status === 'PROXIMO')
                .slice(0, 3)
                .map(rev => {
                  const isVencido = rev.status === 'VENCIDO';
                  return (
                    <div
                      key={rev.id}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                        isVencido ? 'bg-red-50/50 border-red-200' : 'bg-amber-50/40 border-amber-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <LicensePlateBadge placa={rev.placa} size="sm" />
                        <div>
                          <div className="font-bold text-slate-900">{rev.titulo}</div>
                          <div className="text-[11px] text-slate-500">
                            Meta: {rev.proximoKm.toLocaleString()} km • Data: {rev.proximaData.split('-').reverse().join('/')}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase ${
                            isVencido ? 'bg-red-500 text-white' : 'bg-amber-700 text-white'
                          }`}
                        >
                          {isVencido ? `Vencido há ${Math.abs(rev.kmRestantes)} km` : `Restam ${rev.kmRestantes} km`}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* DETRAN-PA Imminent Expirations */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-700" />
                <h3 className="font-bold text-sm text-[#00375a]">
                  Calendário DETRAN-PA: Licenciamento Próximo
                </h3>
              </div>
              <button
                onClick={() => setCurrentTab('detran')}
                className="text-xs text-sky-600 hover:text-sky-800 font-semibold flex items-center gap-0.5"
              >
                <span>Ver tabela completa</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2.5">
              {licensingList.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  Nenhum veículo aguardando licenciamento. Cadastre seus veículos para ver os prazos do DETRAN-PA.
                </div>
              ) : (
                licensingList.slice(0, 3).map(lic => {
                  const vehicle = vehicles.find(v => v.placa === lic.placa);
                  return (
                    <div
                      key={lic.placa}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <LicensePlateBadge placa={lic.placa} size="sm" highlightLastDigits />
                        <div>
                          <div className="font-bold text-slate-900">{vehicle?.modelo || lic.placa}</div>
                          <div className="text-[11px] text-slate-500">
                            Final <strong>{lic.finalPlaca || lic.finalSimples}</strong> [{lic.grupoFinal || `01-31`}] • Licenciamento: {lic.dataLimiteLicenciamento.split('-').reverse().join('/')}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-extrabold text-slate-900 font-mono">
                          R$ {lic.valorTotalEstimado.toFixed(2)}
                        </div>
                        <span className={`text-[10px] font-semibold ${lic.pago ? 'text-emerald-700' : 'text-sky-700'}`}>
                          {lic.pago ? `Quitado (${lic.dataPagamento ? lic.dataPagamento.split('-').reverse().join('/') : 'Baixado'})` : `Vence em ${lic.diasRestantes}d`}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Live Telemetry Feed & Fast Commands */}
        <div className="lg:col-span-5 space-y-5">
          {/* Live Fleet Locations in Pará */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-cyan-600" />
                <h3 className="font-bold text-sm text-[#00375a]">
                  Posicionamento ao Vivo (Pará)
                </h3>
              </div>
              <button
                onClick={() => setCurrentTab('tracking')}
                className="text-xs text-sky-600 hover:text-sky-800 font-semibold flex items-center gap-0.5"
              >
                <span>Mapa Geral</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {vehicles.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  Nenhum veículo em monitoramento. Conecte a API Selsyn ou cadastre um veículo na frota.
                </div>
              ) : (
                vehicles.slice(0, 4).map(v => (
                  <div
                    key={v.id}
                    onClick={() => setCurrentTab('tracking')}
                    className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 hover:bg-sky-50/50 cursor-pointer transition-colors text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{v.modelo}</span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                          v.bloqueado
                            ? 'bg-red-500 text-white'
                            : v.ignicao
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-500 text-white'
                        }`}
                      >
                        {v.bloqueado ? 'BLOQUEADO' : v.ignicao ? `${v.velocidade} km/h` : 'PARADO'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                      <LicensePlateBadge placa={v.placa} size="sm" />
                      <span>{v.odometroAtual.toLocaleString()} km</span>
                    </div>

                    <div className="text-[11px] text-slate-600 flex items-center gap-1 truncate pt-0.5">
                      <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                      <span>
                        {v.localizacao.cidade} - PA: {v.localizacao.endereco}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick WhatsApp Dispatch Banner */}
          <div className="bg-slate-900 text-white p-5 rounded-xl shadow-md border border-slate-700 space-y-3">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-cyan-400" />
              <h4 className="font-bold text-xs uppercase tracking-wider text-cyan-300">
                Lembretes pelo WhatsApp
              </h4>
            </div>
            <p className="text-xs text-slate-300">
              Dispare comunicados e relatórios de vencimento para motoristas e gerentes via canais omnichannel.
            </p>
            <button
              onClick={() => setCurrentTab('alerts')}
              className="w-full py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Acessar Painel de Mensagens</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

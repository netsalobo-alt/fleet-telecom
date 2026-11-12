import React, { useState, useEffect } from 'react';
import {
  Settings,
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Edit2,
  Send,
  RefreshCw,
  ExternalLink,
  Save,
  Radio,
  FileCode,
  Play,
  Bot,
  Cpu,
  Sparkles,
  Terminal,
  Activity,
  Database,
  Clock,
  ChevronDown,
  ChevronUp,
  Server,
  Layers,
  ArrowRight,
  Calendar,
  Upload,
  FileUp,
  FileText,
  Info,
  Check,
  X,
  Copy,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  FolderArchive,
  ArrowUpRight,
} from 'lucide-react';
import { SystemSettings, SystemUser, IntegrationLog, DetranCalendarEntry } from '../types';
import { getDefaultDetranCalendar } from '../utils/detranPA';
import { storage } from '../services/storage';
import { UserManagementModal } from './UserManagementModal';

interface ConfigViewProps {
  settings: SystemSettings;
  users: SystemUser[];
  onSettingsUpdated: (newSettings: SystemSettings) => void;
  onUsersUpdated: () => void;
  onSendWhatsAppAlert: (message: string, placa: string) => Promise<boolean>;
}

export const ConfigView: React.FC<ConfigViewProps> = ({
  settings,
  users,
  onSettingsUpdated,
  onUsersUpdated,
  onSendWhatsAppAlert,
}) => {
  const [activeTab, setActiveTab] = useState<'tokens' | 'logs' | 'detran' | 'openapi'>('tokens');
  const [showUserMgmtModal, setShowUserMgmtModal] = useState(false);

  // Tokens Form State
  const [wahaUrl, setWahaUrl] = useState(settings.waha.baseUrl);
  const [wahaApiKey, setWahaApiKey] = useState(settings.waha.apiKey);
  const [wahaSession, setWahaSession] = useState(settings.waha.session || 'default');
  const [wahaDestinos, setWahaDestinos] = useState(settings.waha.destinos);
  const [notifyMaintenance, setNotifyMaintenance] = useState(settings.waha.notifyOnMaintenance);
  const [notifyDetran, setNotifyDetran] = useState(settings.waha.notifyOnDetran);
  const [notifyTelemetry, setNotifyTelemetry] = useState(settings.waha.notifyOnTelemetryAlert);

  // Selsyn Official Configuration (URL: https://api.appselsyn.com.br/)
  const [selsynUrl, setSelsynUrl] = useState(settings.tracking.baseUrl || 'https://api.appselsyn.com.br/');
  const [selsynApiKey, setSelsynApiKey] = useState(settings.tracking.xApiKey);
  const [selsynToken, setSelsynToken] = useState(settings.tracking.token);
  const [selsynOperador, setSelsynOperador] = useState(settings.tracking.operadorKey);
  const [selsynClienteId, setSelsynClienteId] = useState(settings.tracking.clienteId || 1042);
  const [selsynInterval, setSelsynInterval] = useState(settings.tracking.autoSyncInterval);
  const [selsynSimulacao, setSelsynSimulacao] = useState(settings.tracking.modoSimulacao);

  // OpenAI Settings
  const [openaiApiKey, setOpenaiApiKey] = useState(settings.openai?.apiKey || '');
  const [openaiModel, setOpenaiModel] = useState<'gpt-4o' | 'gpt-4o-mini' | 'gpt-4-turbo'>(settings.openai?.model || 'gpt-4o');
  const [openaiProvider, setOpenaiProvider] = useState<'openai' | 'gemini'>(settings.openai?.preferredProvider || 'openai');


  // Test states for each integration
  const [testSelsynLoading, setTestSelsynLoading] = useState(false);
  const [testSelsynResult, setTestSelsynResult] = useState<{
    success: boolean;
    statusCode: number;
    latencyMs: number;
    urlCalled: string;
    message: string;
    data?: any;
  } | null>(null);

  const [testWahaLoading, setTestWahaLoading] = useState(false);
  const [testWahaResult, setTestWahaResult] = useState<{
    success: boolean;
    statusCode: number;
    latencyMs: number;
    urlCalled?: string;
    message: string;
    data?: any;
  } | null>(null);

  const [testOpenAiLoading, setTestOpenAiLoading] = useState(false);
  const [testOpenAiResult, setTestOpenAiResult] = useState<{
    success: boolean;
    statusCode: number;
    latencyMs: number;
    message: string;
    data?: any;
  } | null>(null);

  // DETRAN-PA Settings & Official Calendar State
  const [detranExercicio, setDetranExercicio] = useState(settings.detran.exercicio);
  const [detranTaxa, setDetranTaxa] = useState(settings.detran.taxaLicenciamento);
  const [detranPasseio, setDetranPasseio] = useState(settings.detran.aliquotaPasseio);
  const [detranUtilitario, setDetranUtilitario] = useState(settings.detran.aliquotaUtilitario);

  const [calendarEntries, setCalendarEntries] = useState<DetranCalendarEntry[]>(
    () => settings.detran.calendarioOficial && settings.detran.calendarioOficial.length > 0
      ? settings.detran.calendarioOficial
      : getDefaultDetranCalendar(settings.detran.exercicio)
  );
  const [configCalFilter, setConfigCalFilter] = useState<string>('ALL');

  // AI Calendar Upload & Parsing States
  const [aiCalendarFile, setAiCalendarFile] = useState<{ base64: string; name: string; type: string } | null>(null);
  const [aiCalendarText, setAiCalendarText] = useState('');
  const [aiCalendarLoading, setAiCalendarLoading] = useState(false);
  const [aiCalendarError, setAiCalendarError] = useState<string | null>(null);

  // Mandatory Review & Confirmation Modal States
  const [showConfirmCalendarModal, setShowConfirmCalendarModal] = useState(false);
  const [draftCalendarEntries, setDraftCalendarEntries] = useState<DetranCalendarEntry[]>([]);
  const [draftCalendarFonte, setDraftCalendarFonte] = useState('');
  const [draftCalendarExercicio, setDraftCalendarExercicio] = useState(settings.detran.exercicio);
  const [calendarUpdatedMsg, setCalendarUpdatedMsg] = useState<string | null>(null);

  // Success Feedback
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Integration Logs State
  const [integrationLogs, setIntegrationLogs] = useState<IntegrationLog[]>(() => storage.getIntegrationLogs());
  const [logFilter, setLogFilter] = useState<'all' | 'selsyn' | 'waha' | 'openai'>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Users Form Modal State

  // OpenAPI Tester State
  const [selectedEndpoint, setSelectedEndpoint] = useState('/keek/rest/v1/integracao/operador/posicao');
  const [endpointParam, setEndpointParam] = useState('');
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [apiLoading, setApiLoading] = useState(false);

  const refreshLogs = () => {
    setIntegrationLogs(storage.getIntegrationLogs());
  };

  useEffect(() => {
    refreshLogs();
  }, [activeTab]);

  // Save All Settings
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSelsynUrl = (selsynUrl.trim() || 'https://api.appselsyn.com.br/').replace(/\/+$/, '') + '/';

    const updated: SystemSettings = {
      tracking: {
        baseUrl: cleanSelsynUrl,
        xApiKey: selsynApiKey.trim(),
        token: selsynToken.trim(),
        operadorKey: selsynOperador.trim(),
        clienteId: Number(selsynClienteId),
        autoSyncInterval: Number(selsynInterval),
        modoSimulacao: selsynSimulacao,
      },
      waha: {
        baseUrl: wahaUrl.trim(),
        apiKey: wahaApiKey.trim(),
        session: wahaSession.trim() || 'default',
        destinos: wahaDestinos.trim(),
        autoAlertsEnabled: true,
        notifyOnMaintenance: notifyMaintenance,
        notifyOnDetran: notifyDetran,
        notifyOnTelemetryAlert: notifyTelemetry,
      },
      detran: {
        exercicio: Number(detranExercicio),
        taxaLicenciamento: Number(detranTaxa),
        aliquotaPasseio: Number(detranPasseio),
        aliquotaUtilitario: Number(detranUtilitario),
        calendarioOficial: calendarEntries,
      },
      openai: {
        apiKey: openaiApiKey.trim(),
        model: openaiModel,
        preferredProvider: openaiProvider,
      },
    };

    storage.saveSettings(updated);
    onSettingsUpdated(updated);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  // Selsyn test plate
  const [selsynTestPlaca, setSelsynTestPlaca] = useState('');

  // Selsyn API Live Connection Tester
  const handleTestSelsyn = async () => {
    setTestSelsynLoading(true);
    setTestSelsynResult(null);

    const tokenUsed = selsynOperador.trim() || selsynApiKey.trim();
    const urlTarget = selsynUrl.trim() || 'https://api.appselsyn.com.br/';
    const cleanTestPlaca = selsynTestPlaca.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

    try {
      const response = await fetch('/api/selsyn/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: urlTarget,
          endpoint: '/keek/rest/v1/integracao/operador/posicao',
          operadorKey: selsynOperador.trim(),
          xApiKey: selsynApiKey.trim(),
          identificador: cleanTestPlaca || undefined,
        }),
      });

      const data = await response.json();
      setTestSelsynResult(data);

      storage.addIntegrationLog({
        integration: 'selsyn',
        endpoint: data.urlCalled || `${urlTarget}keek/rest/v1/integracao/operador/posicao`,
        method: 'GET',
        status: data.success ? 'SUCCESS' : 'ERROR',
        statusCode: data.statusCode || response.status,
        latencyMs: data.latencyMs,
        message: data.message || (data.success ? 'Comunicação Selsyn estabelecida com sucesso' : 'Falha na comunicação Selsyn'),
        details: data.data,
      });
      refreshLogs();
    } catch (err: any) {
      const errorData = {
        success: false,
        statusCode: 0,
        latencyMs: 0,
        urlCalled: urlTarget,
        message: `Falha na requisição local: ${err.message}`,
      };
      setTestSelsynResult(errorData);

      storage.addIntegrationLog({
        integration: 'selsyn',
        endpoint: urlTarget,
        method: 'GET',
        status: 'ERROR',
        message: `Erro de rede/proxy: ${err.message}`,
      });
      refreshLogs();
    } finally {
      setTestSelsynLoading(false);
    }
  };

  // Teste da sessão do WhatsApp na WAHA
  const handleTestWaha = async () => {
    setTestWahaLoading(true);
    setTestWahaResult(null);

    try {
      const response = await fetch('/api/waha/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: wahaUrl.trim(),
          apiKey: wahaApiKey.trim(),
          session: wahaSession.trim() || 'default',
        }),
      });

      const data = await response.json();
      setTestWahaResult(data);

      storage.addIntegrationLog({
        integration: 'waha',
        endpoint: data.urlCalled || `${wahaUrl}/api/sessions/${wahaSession || 'default'}`,
        method: 'GET',
        status: data.success ? 'SUCCESS' : 'ERROR',
        statusCode: data.statusCode || response.status,
        latencyMs: data.latencyMs,
        message: data.message || (data.success ? 'Sessão WAHA conectada' : 'Falha ao consultar a WAHA'),
        details: data.data,
      });
      refreshLogs();
    } catch (err: any) {
      const errRes = {
        success: false,
        statusCode: 0,
        latencyMs: 0,
        message: `Erro de requisição: ${err.message}`,
      };
      setTestWahaResult(errRes);

      storage.addIntegrationLog({
        integration: 'waha',
        endpoint: wahaUrl,
        method: 'GET',
        status: 'ERROR',
        message: `Falha ao conectar na WAHA: ${err.message}`,
      });
      refreshLogs();
    } finally {
      setTestWahaLoading(false);
    }
  };

  // OpenAI API Token Tester
  const handleTestOpenAi = async () => {
    setTestOpenAiLoading(true);
    setTestOpenAiResult(null);

    try {
      const response = await fetch('/api/openai/test-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: openaiApiKey.trim(),
          model: openaiModel,
        }),
      });

      const data = await response.json();
      const isOk = response.ok && data.success;

      setTestOpenAiResult({
        success: isOk,
        statusCode: data.statusCode || response.status,
        latencyMs: data.latencyMs || 0,
        message: isOk
          ? `${data.message} (${data.modelsCount} modelos disponíveis)`
          : data.error || 'Falha ao autenticar token da OpenAI',
        data,
      });

      storage.addIntegrationLog({
        integration: 'openai',
        endpoint: 'https://api.openai.com/v1/models',
        method: 'GET',
        status: isOk ? 'SUCCESS' : 'ERROR',
        statusCode: data.statusCode || response.status,
        latencyMs: data.latencyMs,
        message: isOk ? 'Token OpenAI validado com sucesso' : (data.error || 'Erro no token OpenAI'),
        details: data,
      });
      refreshLogs();
    } catch (err: any) {
      const errObj = {
        success: false,
        statusCode: 0,
        latencyMs: 0,
        message: `Erro de conexão: ${err.message}`,
      };
      setTestOpenAiResult(errObj);

      storage.addIntegrationLog({
        integration: 'openai',
        endpoint: 'https://api.openai.com/v1/models',
        method: 'GET',
        status: 'ERROR',
        message: `Falha na requisição OpenAI: ${err.message}`,
      });
      refreshLogs();
    } finally {
      setTestOpenAiLoading(false);
    }
  };

  // DETRAN-PA Calendar Management Handlers
  const handleCalendarFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setAiCalendarFile({
        base64: reader.result as string,
        name: file.name,
        type: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
      });
      setAiCalendarError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleProcessCalendarAI = async () => {
    if (!aiCalendarFile && !aiCalendarText.trim()) {
      setAiCalendarError('Selecione um arquivo (PDF ou Imagem) ou cole o texto da portaria oficial do DETRAN-PA.');
      return;
    }

    setAiCalendarLoading(true);
    setAiCalendarError(null);

    try {
      const res = await fetch('/api/detran/parse-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: aiCalendarText.trim() || undefined,
          file: aiCalendarFile || undefined,
          exercicio: detranExercicio,
        }),
      });

      const data = await res.json();

      if (data.success && data.data?.entries && data.data.entries.length > 0) {
        setDraftCalendarEntries(data.data.entries);
        setDraftCalendarFonte(data.data.fonte || 'Documento Oficial DETRAN-PA');
        setDraftCalendarExercicio(data.data.exercicio || detranExercicio);
        // Show mandatory confirmation modal so user confirms/adjusts before applying
        setShowConfirmCalendarModal(true);
      } else {
        setAiCalendarError(data.error || 'Não foi possível extrair a tabela de datas do documento.');
      }
    } catch (err: any) {
      setAiCalendarError(`Falha na requisição com a IA: ${err.message}`);
    } finally {
      setAiCalendarLoading(false);
    }
  };

  const handleConfirmAndApplyCalendar = () => {
    setCalendarEntries(draftCalendarEntries);
    setDetranExercicio(draftCalendarExercicio);

    const updated: SystemSettings = {
      ...settings,
      detran: {
        ...settings.detran,
        exercicio: Number(draftCalendarExercicio),
        calendarioOficial: draftCalendarEntries,
      },
    };

    storage.saveSettings(updated);
    onSettingsUpdated(updated);
    setShowConfirmCalendarModal(false);
    setAiCalendarFile(null);
    setAiCalendarText('');
    setCalendarUpdatedMsg('Calendário Oficial do DETRAN-PA revisado, confirmado e aplicado com sucesso à frota!');
    setTimeout(() => setCalendarUpdatedMsg(null), 5000);
  };

  const handleResetDefaultCalendar = () => {
    if (confirm('Deseja restaurar a escala padrão oficial do DETRAN-PA para o exercício fiscal atual?')) {
      const defaultEntries = getDefaultDetranCalendar(detranExercicio);
      setCalendarEntries(defaultEntries);
      const updated: SystemSettings = {
        ...settings,
        detran: {
          ...settings.detran,
          calendarioOficial: defaultEntries,
        },
      };
      storage.saveSettings(updated);
      onSettingsUpdated(updated);
      setCalendarUpdatedMsg('Escala padrão do DETRAN-PA restaurada com sucesso!');
      setTimeout(() => setCalendarUpdatedMsg(null), 4000);
    }
  };

  const handleUpdateCalendarEntry = (id: string, field: keyof DetranCalendarEntry, value: string) => {
    setCalendarEntries(prev =>
      prev.map(item => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleUpdateDraftEntry = (id: string, field: keyof DetranCalendarEntry, value: string) => {
    setDraftCalendarEntries(prev =>
      prev.map(item => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleAddCalendarEntry = () => {
    const newEntry: DetranCalendarEntry = {
      id: `cal-custom-${Date.now()}`,
      finalPlaca: configCalFilter !== 'ALL' ? configCalFilter : '1',
      grupoFinal: '01 - 31',
      descricaoFinais: 'Finais Personalizados',
      mesReferencia: 'Dezembro',
      dataLimite: `${detranExercicio}-12-20`,
      dataLicenciamento: `${detranExercicio}-12-20`,
      dataCotaUnica: `${detranExercicio}-11-20`,
      data15Desc: `${detranExercicio}-11-20`,
      data10Desc: `${detranExercicio}-12-05`,
      cota1Parcelamento: `${detranExercicio}-11-20`,
      cota2Parcelamento: `${detranExercicio}-12-05`,
      cota3Parcelamento: `${detranExercicio}-12-20`,
      observacoes: 'Grupo personalizado',
    };
    setCalendarEntries(prev => [...prev, newEntry]);
  };

  const handleDeleteCalendarEntry = (id: string) => {
    setCalendarEntries(prev => prev.filter(c => c.id !== id));
  };

  // Test Selsyn Keek OpenAPI Explorer
  const handleTestOpenApi = async () => {
    setApiLoading(true);
    setApiResponse(null);

    const targetUrl = selsynUrl.trim() || 'https://api.appselsyn.com.br/';
    const opKey = selsynOperador.trim() || selsynApiKey.trim();

    try {
      let finalEndpoint = selectedEndpoint;
      if (selectedEndpoint === '/keek/rest/v1/integracao/operador/posicao') {
        if (endpointParam.trim()) {
          finalEndpoint += `?identificador=${endpointParam.replace(/[^A-Za-z0-9]/g, '')}`;
        }
      } else if (selectedEndpoint === '/v1/integracao/posicao') {
        finalEndpoint += `?identificador=${endpointParam.replace(/[^A-Za-z0-9]/g, '')}`;
      } else if (selectedEndpoint === '/v1/integracao/operador/rastreavel/identificador/{identificador}') {
        finalEndpoint = `/v1/integracao/operador/rastreavel/identificador/${endpointParam.replace(/[^A-Za-z0-9]/g, '')}`;
      }

      const response = await fetch('/api/tracking/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: targetUrl,
          endpoint: finalEndpoint,
          method: 'GET',
          headers: {
            'x-api-key': opKey,
            'api-key-operador': opKey,
            'x-r2f-auth': selsynToken.trim(),
          },
        }),
      });

      const data = await response.json();
      setApiResponse(data);

      storage.addIntegrationLog({
        integration: 'selsyn',
        endpoint: `${targetUrl.replace(/\/+$/, '')}${finalEndpoint.startsWith('/') ? finalEndpoint : `/${finalEndpoint}`}`,
        method: 'GET',
        status: response.ok ? 'SUCCESS' : 'ERROR',
        statusCode: response.status,
        message: `Chamada via OpenAPI Explorer (${finalEndpoint})`,
        details: data,
      });
      refreshLogs();
    } catch (err: any) {
      setApiResponse({ error: err.message || 'Erro de conexão' });
    } finally {
      setApiLoading(false);
    }
  };

  const filteredLogs = integrationLogs.filter(l => {
    if (logFilter === 'all') return true;
    return l.integration === logFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#00375a] flex items-center justify-center text-white">
              <Settings className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-[#00375a]">
              Painel de Configurações, Integrações &amp; Logs
            </h1>
          </div>
          <p className="text-slate-600 text-xs sm:text-sm mt-1">
            Gestão de credenciais (Selsyn Keek, WhatsApp/WAHA, OpenAI), monitoramento de logs em tempo real e administração da base de dados da frota.
          </p>
        </div>

        {savedSuccess && (
          <span className="bg-emerald-100 text-emerald-800 text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 border border-emerald-300 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Configurações salvas!
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-2 text-xs font-semibold overflow-x-auto">
        {[
          { id: 'tokens', label: 'Tokens de Integração', icon: Key },
          { id: 'logs', label: `Logs das Integrações (${integrationLogs.length})`, icon: Activity },
            { id: 'detran', label: 'Parâmetros DETRAN-PA', icon: ShieldCheck },
          { id: 'openapi', label: 'OpenAPI Selsyn Keek', icon: FileCode },
        ].map(t => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all whitespace-nowrap ${
                isActive
                  ? 'border-sky-600 text-sky-800 bg-sky-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: TOKENS DE INTEGRAÇÃO */}
      {activeTab === 'tokens' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* Selsyn Rastreamento Box (Official URL: https://api.appselsyn.com.br/) */}
          <div className="bg-white rounded-xl border border-sky-300 shadow-sm p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-sky-100 flex items-center justify-center text-sky-700">
                  <Server className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-[#00375a]">
                      Integração Selsyn Tecnologia (Rastreamento &amp; Telemetria)
                    </h3>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full border border-emerald-300">
                      Homologado n8n
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    URL oficial para consultas e ações operacionais com Token de Operador: <strong>https://api.appselsyn.com.br/</strong>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={selsynTestPlaca}
                  onChange={e => setSelsynTestPlaca(e.target.value.toUpperCase())}
                  placeholder="Placa teste (ex: AAA1234)"
                  maxLength={8}
                  className="w-36 px-2.5 py-1.5 text-xs font-mono font-bold uppercase rounded-lg border border-sky-300 bg-white placeholder:text-slate-400 placeholder:font-normal placeholder:normal-case"
                  title="Opcional: insira a placa no formato AAA1234 para testar ?identificador={PLACA}"
                />
                <button
                  type="button"
                  onClick={handleTestSelsyn}
                  disabled={testSelsynLoading}
                  className="bg-brand-navy hover:bg-navy-deep text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
                >
                  {testSelsynLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Testando Conexão...</span>
                    </>
                  ) : (
                    <>
                      <Activity className="w-3.5 h-3.5" />
                      <span>Testar Comunicação Selsyn</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Selsyn Test Result Alert */}
            {testSelsynResult && (
              <div
                className={`p-3 rounded-lg text-xs border space-y-1.5 animate-in fade-in ${
                  testSelsynResult.success
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    : testSelsynResult.statusCode === 401 || testSelsynResult.statusCode === 403
                    ? 'bg-amber-50 border-amber-300 text-amber-950'
                    : 'bg-red-50 border-red-300 text-red-950'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <div className="flex items-center gap-2">
                    {testSelsynResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    <span>{testSelsynResult.message}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="bg-white/80 px-2 py-0.5 rounded border border-slate-300">
                      HTTP {testSelsynResult.statusCode || 0}
                    </span>
                    <span className="bg-white/80 px-2 py-0.5 rounded border border-slate-300">
                      {testSelsynResult.latencyMs} ms
                    </span>
                  </div>
                </div>
                <div className="text-[11px] text-slate-600 font-mono truncate">
                  Endpoint testado: {testSelsynResult.urlCalled}
                </div>
                {testSelsynResult.data && (
                  <details className="text-[11px] pt-1">
                    <summary className="cursor-pointer text-sky-700 hover:underline font-semibold">
                      Ver Resposta Bruta do Servidor Selsyn
                    </summary>
                    <pre className="mt-1 p-2 bg-slate-900 text-emerald-300 rounded overflow-x-auto text-[10px] max-h-36 font-mono">
                      {JSON.stringify(testSelsynResult.data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  URL da API Selsyn:
                </label>
                <input
                  type="url"
                  value={selsynUrl}
                  onChange={e => setSelsynUrl(e.target.value)}
                  placeholder="https://api.appselsyn.com.br/"
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-mono text-slate-800 bg-sky-50/30"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  URL correta testada no n8n para comunicação direta.
                </span>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1 flex items-center justify-between">
                  <span>API Key de Operador (Nível Operador - V1):</span>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                    Chave Funcional n8n
                  </span>
                </label>
                <input
                  type="password"
                  value={selsynOperador}
                  onChange={e => setSelsynOperador(e.target.value)}
                  placeholder="Insira sua chave de operador Selsyn..."
                  className="w-full border border-emerald-400 focus:border-emerald-600 rounded-lg p-2.5 font-mono text-slate-800 bg-emerald-50/20"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Enviada no header <code>x-api-key</code> para consultas de clientes, dispositivos e telemetria.
                </span>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  API Key Cliente (Opcional - Header: x-api-key):
                </label>
                <input
                  type="text"
                  value={selsynApiKey}
                  onChange={e => setSelsynApiKey(e.target.value)}
                  placeholder="Chave de cliente (opcional se possuir a de operador)"
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Token Adicional de Acesso (Header: x-r2f-auth):
                </label>
                <input
                  type="password"
                  value={selsynToken}
                  onChange={e => setSelsynToken(e.target.value)}
                  placeholder="Token de sessão (se aplicável)"
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Intervalo de Atualização da Telemetria:
                </label>
                <select
                  value={selsynInterval}
                  onChange={e => setSelsynInterval(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-medium"
                >
                  <option value={10}>A cada 10 segundos</option>
                  <option value={30}>A cada 30 segundos (Recomendado)</option>
                  <option value={60}>A cada 1 minuto</option>
                  <option value={300}>A cada 5 minutos</option>
                </select>
              </div>

              <div className="flex items-center pt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selsynSimulacao}
                    onChange={e => setSelsynSimulacao(e.target.checked)}
                    className="rounded text-sky-600 w-4 h-4"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block">
                      Modo Simulação Ativo
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Desmarque para usar exclusivamente a API real da Selsyn.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* WAHA (WhatsApp) Configuration Box */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-cyan-600" />
                <div>
                  <h3 className="font-bold text-sm text-[#00375a]">
                    WhatsApp pela WAHA (Lembretes &amp; Alertas)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Envio de lembretes de revisão, licenciamento e alertas operacionais direto no WhatsApp
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleTestWaha}
                disabled={testWahaLoading}
                className="bg-cyan-50 hover:bg-cyan-100 text-cyan-800 text-xs font-semibold px-3 py-1.5 rounded-lg border border-cyan-300 flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {testWahaLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Verificando...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Testar sessão</span>
                  </>
                )}
              </button>
            </div>

            {testWahaResult && (
              <div
                className={`p-3 rounded-lg text-xs border space-y-1 animate-in fade-in ${
                  testWahaResult.success
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    : 'bg-red-50 border-red-300 text-red-950'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <div className="flex items-center gap-2">
                    {testWahaResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    )}
                    <span>{testWahaResult.message}</span>
                  </div>
                  <span className="font-mono text-[11px] bg-white/80 px-2 py-0.5 rounded border border-slate-300">
                    {testWahaResult.latencyMs} ms
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label htmlFor="waha-url" className="font-bold text-slate-700 block mb-1">
                  URL do servidor WAHA:
                </label>
                <input
                  id="waha-url"
                  type="url"
                  value={wahaUrl}
                  onChange={e => setWahaUrl(e.target.value)}
                  placeholder="https://waha.nortetelecom.net.br"
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-mono text-slate-800"
                />
              </div>

              <div>
                <label htmlFor="waha-key" className="font-bold text-slate-700 block mb-1">
                  API key (X-Api-Key):
                </label>
                <input
                  id="waha-key"
                  type="password"
                  value={wahaApiKey}
                  onChange={e => setWahaApiKey(e.target.value)}
                  placeholder="Chave definida em WAHA_API_KEY"
                  autoComplete="off"
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-mono text-slate-800"
                />
              </div>

              <div>
                <label htmlFor="waha-session" className="font-bold text-slate-700 block mb-1">
                  Sessão do WhatsApp:
                </label>
                <input
                  id="waha-session"
                  type="text"
                  value={wahaSession}
                  onChange={e => setWahaSession(e.target.value)}
                  placeholder="default"
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-mono text-slate-800"
                />
                <p className="text-[11px] text-slate-500 mt-1">Nome da sessão já conectada (QR code lido) na WAHA.</p>
              </div>

              <div>
                <label htmlFor="waha-destinos" className="font-bold text-slate-700 block mb-1">
                  Quem recebe os lembretes:
                </label>
                <textarea
                  id="waha-destinos"
                  rows={3}
                  value={wahaDestinos}
                  onChange={e => setWahaDestinos(e.target.value)}
                  placeholder={'91988887777\n120363012345678901@g.us'}
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-mono text-slate-800 resize-y"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Um por linha (ou separados por vírgula): número com DDD ou ID de grupo terminado em @g.us.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-6 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyMaintenance}
                  onChange={e => setNotifyMaintenance(e.target.checked)}
                  className="rounded text-sky-600 w-4 h-4"
                />
                <span className="font-medium text-slate-700">Notificar Revisões Próximas/Vencidas</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyDetran}
                  onChange={e => setNotifyDetran(e.target.checked)}
                  className="rounded text-sky-600 w-4 h-4"
                />
                <span className="font-medium text-slate-700">Notificar Licenciamento DETRAN-PA</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyTelemetry}
                  onChange={e => setNotifyTelemetry(e.target.checked)}
                  className="rounded text-sky-600 w-4 h-4"
                />
                <span className="font-medium text-slate-700">Alertas Críticos de Telemetria</span>
              </label>
            </div>
          </div>

          {/* OpenAI Configuration Box */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#00375a]">
                    Integração com OpenAI (Lançamento com IA, Fotos &amp; PDFs)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Utilize seu token da OpenAI para leitura óptica e extração de ordens de serviço
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleTestOpenAi}
                disabled={testOpenAiLoading || !openaiApiKey.trim()}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold px-3 py-1.5 rounded-lg border border-emerald-300 flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {testOpenAiLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Verificando Token...</span>
                  </>
                ) : (
                  <>
                    <Cpu className="w-3.5 h-3.5" />
                    <span>Testar Token OpenAI</span>
                  </>
                )}
              </button>
            </div>

            {testOpenAiResult && (
              <div
                className={`p-3 rounded-lg text-xs border space-y-1 animate-in fade-in ${
                  testOpenAiResult.success
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    : 'bg-red-50 border-red-300 text-red-950'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <div className="flex items-center gap-2">
                    {testOpenAiResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    )}
                    <span>{testOpenAiResult.message}</span>
                  </div>
                  <span className="font-mono text-[11px] bg-white/80 px-2 py-0.5 rounded border border-slate-300">
                    {testOpenAiResult.latencyMs} ms
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="md:col-span-2">
                <label className="font-bold text-slate-700 block mb-1">
                  Token da OpenAI (API Key):
                </label>
                <input
                  type="password"
                  value={openaiApiKey}
                  onChange={e => setOpenaiApiKey(e.target.value)}
                  placeholder="sk-proj-... ou sk-..."
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Modelo OpenAI para Visão &amp; PDF:
                </label>
                <select
                  value={openaiModel}
                  onChange={e => setOpenaiModel(e.target.value as any)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-medium"
                >
                  <option value="gpt-4o">GPT-4o (Recomendado - Alta Precisão)</option>
                  <option value="gpt-4o-mini">GPT-4o-mini (Econômico e Rápido)</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                </select>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <span className="font-bold text-slate-700">Provedor Principal:</span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="preferredProvider"
                    value="openai"
                    checked={openaiProvider === 'openai'}
                    onChange={() => setOpenaiProvider('openai')}
                    className="text-emerald-600"
                  />
                  <span className="font-medium text-slate-800">OpenAI ({openaiModel})</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="preferredProvider"
                    value="gemini"
                    checked={openaiProvider === 'gemini'}
                    onChange={() => setOpenaiProvider('gemini')}
                    className="text-sky-600"
                  />
                  <span className="font-medium text-slate-800">Google Gemini Flash</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="submit"
              className="bg-[#00375a] hover:bg-[#1d5277] text-white px-5 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Todos os Tokens &amp; Parâmetros</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: HISTÓRICO DE LOGS DAS INTEGRAÇÕES */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-600" />
                <h3 className="font-bold text-sm text-[#00375a]">
                  Histórico de Comunicação das Integrações
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Monitoramento detalhado de requisições, status HTTP e tempos de resposta para Selsyn Keek, WhatsApp (WAHA) e OpenAI.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  storage.clearIntegrationLogs(logFilter === 'all' ? undefined : logFilter);
                  refreshLogs();
                }}
                className="text-xs bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-700 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpar Logs</span>
              </button>

              <button
                type="button"
                onClick={refreshLogs}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Atualizar</span>
              </button>
            </div>
          </div>

          {/* Integration Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            {[
              { id: 'all', label: 'Todas as Integrações' },
              { id: 'selsyn', label: 'Selsyn API (Rastreamento)' },
              { id: 'waha', label: 'WhatsApp (WAHA)' },
              { id: 'openai', label: 'OpenAI (Visão & IA)' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setLogFilter(f.id as any)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  logFilter === f.id
                    ? 'bg-[#00375a] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Logs List */}
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500 text-xs space-y-2">
              <Terminal className="w-8 h-8 mx-auto text-slate-400" />
              <p className="font-semibold">Nenhum log registrado para este filtro.</p>
              <p className="text-[11px] text-slate-400">
                Execute um teste de conexão ou realize ações operacionais na frota para visualizar os eventos de telemetria e mensageria aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredLogs.map(log => {
                const isExpanded = expandedLogId === log.id;
                const isSuccess = log.status === 'SUCCESS' || (log.statusCode && log.statusCode >= 200 && log.statusCode < 300);

                return (
                  <div
                    key={log.id}
                    className={`rounded-xl border p-3.5 text-xs transition-all ${
                      isSuccess
                        ? 'border-emerald-200 bg-emerald-50/20'
                        : 'border-red-200 bg-red-50/20'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        {/* Status Badge */}
                        <span
                          className={`font-mono text-[10px] font-extrabold px-2 py-0.5 rounded uppercase ${
                            isSuccess
                              ? 'bg-emerald-600 text-white'
                              : 'bg-red-600 text-white'
                          }`}
                        >
                          {log.statusCode ? `HTTP ${log.statusCode}` : log.status}
                        </span>

                        {/* Integration Label */}
                        <span className="font-bold text-slate-800 uppercase text-[10px] bg-slate-200 px-2 py-0.5 rounded">
                          {log.integration}
                        </span>

                        {/* Method & URL */}
                        <span className="font-mono text-[11px] text-slate-700 truncate max-w-xs md:max-w-md">
                          <strong>{log.method}</strong> {log.endpoint}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-slate-500 text-[11px]">
                        {log.latencyMs !== undefined && (
                          <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 font-semibold text-slate-700">
                            {log.latencyMs} ms
                          </span>
                        )}
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <button
                          type="button"
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          className="text-slate-500 hover:text-slate-800 p-1"
                        >
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 text-slate-800 font-medium">
                      {log.message}
                    </div>

                    {isExpanded && log.details && (
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <span className="text-[10px] text-slate-500 font-bold block mb-1">
                          Dados da Resposta / Payload:
                        </span>
                        <pre className="p-3 bg-slate-900 text-emerald-300 rounded-lg overflow-x-auto text-[11px] max-h-48 font-mono">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: PARÂMETROS E CALENDÁRIO OFICIAL DETRAN-PA */}
      {activeTab === 'detran' && (
        <div className="space-y-6">
          {/* Calendar Updated Toast */}
          {calendarUpdatedMsg && (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-4 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{calendarUpdatedMsg}</span>
            </div>
          )}

          {/* General Fiscal Parameters */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="border-b pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-sm text-[#00375a]">
                  Regras Gerais e Alíquotas Oficiais do Estado do Pará (SEFA &amp; DETRAN-PA)
                </h3>
                <p className="text-xs text-slate-500">
                  Escalonamento anual conforme Lei Estadual nº 6.010/1996 e Instrução Normativa SEFA-PA
                </p>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href="https://www.detran.pa.gov.br"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors border border-slate-300"
                >
                  <span>Portal DETRAN-PA</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Ano de Exercício Fiscal:
                </label>
                <input
                  type="number"
                  value={detranExercicio}
                  onChange={e => setDetranExercicio(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Taxa de Licenciamento Anual (R$):
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={detranTaxa}
                  onChange={e => setDetranTaxa(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Alíquota IPVA Passeio (%):
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={detranPasseio}
                  onChange={e => setDetranPasseio(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-mono text-slate-800"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Padrão PA: 2,5% sobre FIPE
                </span>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Alíquota IPVA Utilitários (%):
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={detranUtilitario}
                  onChange={e => setDetranUtilitario(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-mono text-slate-800"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Padrão PA: 1,0% sobre FIPE
                </span>
              </div>
            </div>
          </div>

          {/* AI Upload and Import Section */}
          <div className="bg-sky-50 rounded-xl border border-sky-200 shadow-sm p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-sky-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-brand-navy flex items-center justify-center text-white">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-[#00375a]">
                      Importar Calendário Oficial via Inteligência Artificial
                    </h3>
                    <span className="bg-sky-200/80 text-sky-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                      Gemini Multimodal
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Faça upload da portaria oficial em PDF ou imagem/foto da tabela, ou cole o texto para a IA estruturar as datas com precisão.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-[11px] text-slate-500 font-medium">
                  Confirmação obrigatória antes de aplicar
                </span>
              </div>
            </div>

            {aiCalendarError && (
              <div className="p-3 bg-red-50 border border-red-300 text-red-900 rounded-lg text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{aiCalendarError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* File Upload Box */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  1. Upload do Arquivo (PDF da Portaria ou Imagem/Foto da Tabela):
                </label>
                <div className="border-2 border-dashed border-sky-300 hover:border-sky-500 rounded-xl p-4 text-center bg-white transition-colors relative">
                  <input
                    type="file"
                    accept=".pdf,image/png,image/jpeg,image/webp"
                    onChange={handleCalendarFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  {aiCalendarFile ? (
                    <div className="space-y-1">
                      <div className="w-8 h-8 mx-auto rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                        <FileText className="w-4 h-4" />
                      </div>
                      <p className="font-bold text-slate-800 text-xs truncate max-w-xs mx-auto">
                        {aiCalendarFile.name}
                      </p>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          setAiCalendarFile(null);
                        }}
                        className="text-[10px] text-red-600 hover:underline font-semibold"
                      >
                        Remover arquivo
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Upload className="w-6 h-6 mx-auto text-sky-500" />
                      <p className="font-bold text-slate-700 text-xs">
                        Clique ou arraste o arquivo da portaria aqui
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Suporta PDF, PNG, JPG (Diário Oficial ou comunicado do DETRAN-PA)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Text Input Box */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  2. Ou Cole o Texto Oficial / Notícia do Calendário:
                </label>
                <textarea
                  rows={4}
                  value={aiCalendarText}
                  onChange={e => setAiCalendarText(e.target.value)}
                  placeholder="Exemplo: Portaria DETRAN-PA nº 104/2026. Finais 01 a 31 vencimento em 04/04; Finais 41 a 61 em 09/05; Finais 71 a 91 em 13/06..."
                  className="w-full border border-sky-300 rounded-xl p-2.5 text-xs text-slate-800 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none font-mono"
                />
              </div>
            </div>

            {/* AI Action Button */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                Após o processamento pela IA, uma tela de confirmação será aberta para você revisar todas as datas antes de salvar.
              </span>

              <button
                type="button"
                onClick={handleProcessCalendarAI}
                disabled={aiCalendarLoading || (!aiCalendarFile && !aiCalendarText.trim())}
                className="w-full sm:w-auto bg-[#00375a] hover:bg-slate-800 active:scale-95 text-white font-bold text-xs px-5 py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {aiCalendarLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
                    <span>Processando Calendário com IA...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Analisar e Estruturar com IA</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Active DETRAN-PA Calendar Table */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-sky-600" />
                  <h3 className="font-bold text-sm text-[#00375a]">
                    Tabela Oficial Ativa de Licenciamento Anual (Exercício {detranExercicio})
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Escalonamento oficial de vencimentos e prazos de desconto de Bom Condutor da SEFA-PA.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddCalendarEntry}
                  className="bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors border border-sky-200 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar Grupo</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetDefaultCalendar}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors border border-slate-300 cursor-pointer"
                  title="Restaurar a escala oficial padrão do Pará"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Restaurar Padrão DETRAN-PA</span>
                </button>
              </div>
            </div>

            {/* Filter by Final de Placa */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <span className="font-bold text-slate-600 text-[11px] uppercase tracking-wider mr-1">
                Filtrar por Final:
              </span>
              <button
                type="button"
                onClick={() => setConfigCalFilter('ALL')}
                className={`px-2.5 py-1 rounded font-bold transition-all cursor-pointer ${
                  configCalFilter === 'ALL'
                    ? 'bg-[#00375a] text-white shadow-2xs'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
                }`}
              >
                Todos ({calendarEntries.length})
              </button>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map(digito => (
                <button
                  key={digito}
                  type="button"
                  onClick={() => setConfigCalFilter(digito)}
                  className={`w-7 h-7 rounded flex items-center justify-center font-bold font-mono transition-all cursor-pointer ${
                    configCalFilter === digito
                      ? 'bg-brand-navy text-white shadow-2xs'
                      : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
                  }`}
                >
                  {digito}
                </button>
              ))}
            </div>

            {/* Editable Calendar Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2.5 text-center">Final</th>
                    <th className="px-3 py-2.5">Grupo / Finais de Placa</th>
                    <th className="px-3 py-2.5">Mês Referência</th>
                    <th className="px-3 py-2.5">Licenciamento (3ª Cota)</th>
                    <th className="px-3 py-2.5">Cota Única IPVA</th>
                    <th className="px-3 py-2.5 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {calendarEntries
                    .filter(entry => configCalFilter === 'ALL' || entry.finalPlaca === configCalFilter)
                    .map(entry => (
                    <tr key={entry.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-3 py-2 text-center">
                        <span className="font-mono font-extrabold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {entry.finalPlaca || '-'}
                        </span>
                      </td>

                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={entry.descricaoFinais}
                          onChange={e => handleUpdateCalendarEntry(entry.id, 'descricaoFinais', e.target.value)}
                          className="w-full border border-slate-200 rounded px-2 py-1 font-bold text-slate-800 text-xs focus:ring-1 focus:ring-sky-500"
                        />
                      </td>

                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={entry.mesReferencia}
                          onChange={e => handleUpdateCalendarEntry(entry.id, 'mesReferencia', e.target.value)}
                          className="w-full border border-slate-200 rounded px-2 py-1 text-slate-700 text-xs focus:ring-1 focus:ring-sky-500"
                        />
                      </td>

                      <td className="px-3 py-2">
                        <input
                          type="date"
                          value={entry.dataLimite || entry.dataLicenciamento || ''}
                          onChange={e => handleUpdateCalendarEntry(entry.id, 'dataLimite', e.target.value)}
                          className="border border-sky-300 bg-sky-50/30 rounded px-2 py-1 font-mono font-bold text-slate-900 text-xs focus:ring-1 focus:ring-sky-500"
                        />
                      </td>

                      <td className="px-3 py-2">
                        <input
                          type="date"
                          value={entry.dataCotaUnica || entry.data15Desc || ''}
                          onChange={e => handleUpdateCalendarEntry(entry.id, 'data15Desc', e.target.value)}
                          className="border border-emerald-300 bg-emerald-50/30 rounded px-2 py-1 font-mono text-emerald-900 text-xs focus:ring-1 focus:ring-sky-500"
                        />
                      </td>

                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteCalendarEntry(entry.id)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                          title="Remover grupo de final"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={handleSaveSettings}
                className="bg-emerald-600 hover:bg-emerald-600 active:scale-95 text-white text-xs font-bold px-5 py-2.5 rounded-lg flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Salvar Todas as Configurações &amp; Calendário</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: OPENAPI SELSYN KEEK EXPLORER */}
      {activeTab === 'openapi' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 text-xs">
          <div className="border-b pb-3">
            <h3 className="font-bold text-sm text-[#00375a]">
              Explorador OpenAPI 3.0.0 (Selsyn Tecnologia)
            </h3>
            <p className="text-slate-500 text-xs mt-0.5">
              Execute requisições diretas de teste utilizando a especificação do arquivo anexado <code>openapi (1).json</code>.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="font-bold text-slate-700 block mb-1">
                Endpoint da Especificação:
              </label>
              <select
                value={selectedEndpoint}
                onChange={e => setSelectedEndpoint(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2.5 font-mono"
              >
                <option value="/keek/rest/v1/integracao/operador/posicao">
                  GET /keek/rest/v1/integracao/operador/posicao (Oficial - Buscar Posições Ao Vivo)
                </option>
                <option value="/keek/rest/v1/integracao/operador/cliente">
                  GET /keek/rest/v1/integracao/operador/cliente (Operador - Buscar Clientes)
                </option>
                <option value="/keek/rest/v1/integracao/operador/dispositivo/modelos">
                  GET /keek/rest/v1/integracao/operador/dispositivo/modelos (Operador - Modelos Homologados)
                </option>
                <option value="/v1/integracao/posicao">
                  GET /v1/integracao/posicao (Última Posição por Placa)
                </option>
                <option value="/v1/integracao/operador/rastreavel/identificador/{identificador}">
                  GET /v1/integracao/operador/rastreavel/identificador (Rastreável por Placa)
                </option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Identificador / Placa de Teste:
              </label>
              <input
                type="text"
                value={endpointParam}
                onChange={e => setEndpointParam(e.target.value)}
                placeholder="Ex: QEN4521"
                className="w-full border border-slate-300 rounded-lg p-2.5 font-mono"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleTestOpenApi}
            disabled={apiLoading}
            className="bg-[#00375a] hover:bg-[#1d5277] text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {apiLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            <span>Executar Requisição de Teste</span>
          </button>

          {apiResponse && (
            <div className="mt-3">
              <span className="font-bold text-slate-700 block mb-1">Resposta Retornada:</span>
              <pre className="p-3 bg-slate-900 text-emerald-400 rounded-lg overflow-x-auto text-[11px] max-h-56 font-mono">
                {JSON.stringify(apiResponse, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}


      {/* MODAL DE CONFIRMAÇÃO OBRIGATÓRIA DO CALENDÁRIO EXTRAÍDO PELA IA */}
      {showConfirmCalendarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-amber-300">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-amber-700 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shadow-xs">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-base sm:text-lg">
                      Revisão Obrigatória: Calendário DETRAN-PA Extraído pela IA
                    </h3>
                    <span className="text-[10px] bg-white/25 uppercase tracking-wider font-black px-2 py-0.5 rounded-full">
                      Exercício {draftCalendarExercicio}
                    </span>
                  </div>
                  <p className="text-amber-100 text-xs mt-0.5">
                    Fonte identificada: <strong>{draftCalendarFonte}</strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowConfirmCalendarModal(false)}
                className="w-8 h-8 rounded-lg bg-black/20 hover:bg-black/30 flex items-center justify-center text-white transition-colors"
                title="Fechar sem salvar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Instruction Warning Callout */}
            <div className="p-4 bg-amber-50/80 border-b border-amber-200 text-xs text-amber-950 flex items-start gap-3 shrink-0">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">
                  A IA organizou as datas a partir do documento ou texto enviado.
                </p>
                <p className="text-amber-800 text-[11px] leading-relaxed">
                  Confira atentamente cada data e grupo de final de placa abaixo. Você pode editar qualquer valor diretamente nos campos antes de aprovar. Nenhum ajuste de data na frota é gravado sem sua confirmação explícita.
                </p>
              </div>
            </div>

            {/* Editable Draft Entries Table */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">
                  Grupos de Placas e Prazos ({draftCalendarEntries.length} registros identificados):
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const newEntry: DetranCalendarEntry = {
                      id: `draft-custom-${Date.now()}`,
                      finalPlaca: '1',
                      grupoFinal: 'novo',
                      descricaoFinais: 'Finais...',
                      mesReferencia: 'Mês',
                      dataLimite: `${draftCalendarExercicio}-12-20`,
                      dataLicenciamento: `${draftCalendarExercicio}-12-20`,
                      data15Desc: `${draftCalendarExercicio}-11-20`,
                      data10Desc: `${draftCalendarExercicio}-12-05`,
                    };
                    setDraftCalendarEntries(prev => [...prev, newEntry]);
                  }}
                  className="text-xs font-semibold text-sky-700 hover:text-sky-900 flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar mais uma linha</span>
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5">Finais de Placa</th>
                      <th className="px-3 py-2.5">Mês Referência</th>
                      <th className="px-3 py-2.5">Data Limite (Sem Multa)</th>
                      <th className="px-3 py-2.5">15% Desc. (Bom Condutor)</th>
                      <th className="px-3 py-2.5">10% Desc. (Bom Condutor)</th>
                      <th className="px-2 py-2.5 text-center">Excluir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800">
                    {draftCalendarEntries.map(entry => (
                      <tr key={entry.id} className="hover:bg-amber-50/40 transition-colors">
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={entry.descricaoFinais}
                            onChange={e => handleUpdateDraftEntry(entry.id, 'descricaoFinais', e.target.value)}
                            className="w-full border border-slate-300 rounded px-2 py-1 font-bold text-slate-800 text-xs focus:ring-1 focus:ring-amber-500"
                            placeholder="Ex: Finais 01 a 31"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={entry.mesReferencia}
                            onChange={e => handleUpdateDraftEntry(entry.id, 'mesReferencia', e.target.value)}
                            className="w-full border border-slate-300 rounded px-2 py-1 text-slate-700 text-xs focus:ring-1 focus:ring-amber-500"
                            placeholder="Ex: Abril"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="date"
                            value={entry.dataLimite}
                            onChange={e => handleUpdateDraftEntry(entry.id, 'dataLimite', e.target.value)}
                            className="border border-amber-300 bg-amber-50/30 rounded px-2 py-1 font-mono font-bold text-slate-900 text-xs focus:ring-1 focus:ring-amber-500"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="date"
                            value={entry.data15Desc || ''}
                            onChange={e => handleUpdateDraftEntry(entry.id, 'data15Desc', e.target.value)}
                            className="border border-emerald-300 bg-emerald-50/30 rounded px-2 py-1 font-mono text-emerald-900 text-xs focus:ring-1 focus:ring-amber-500"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="date"
                            value={entry.data10Desc || ''}
                            onChange={e => handleUpdateDraftEntry(entry.id, 'data10Desc', e.target.value)}
                            className="border border-slate-300 rounded px-2 py-1 font-mono text-slate-700 text-xs focus:ring-1 focus:ring-amber-500"
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => setDraftCalendarEntries(prev => prev.filter(e => e.id !== entry.id))}
                            className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                            title="Remover linha"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                Ao confirmar, todos os veículos da frota terão os prazos de licenciamento recalculados automaticamente.
              </span>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setShowConfirmCalendarModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Cancelar e Descartar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAndApplyCalendar}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirmar e Salvar Calendário Oficial DETRAN-PA</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Sidebar, TabType } from './components/Sidebar';
import { UserManagementModal } from './components/UserManagementModal';
import { DashboardView } from './components/DashboardView';
import { VehiclesView } from './components/VehiclesView';
import { AIMaintenanceView } from './components/AIMaintenanceView';
import { ReportsView } from './components/ReportsView';
import { RevisionsMonitorView } from './components/RevisionsMonitorView';
import { LicenciamentoPAView } from './components/LicenciamentoPAView';
import { TrackingMapView } from './components/TrackingMapView';
import { AlertsWhatsAppView } from './components/AlertsWhatsAppView';
import { ConfigView } from './components/ConfigView';
import { SuppliersView } from './components/SuppliersView';
import { FleetCalendarView } from './components/FleetCalendarView';
import { DriversView } from './components/DriversView';
import { sync } from './services/sync';
import { LocalImportBanner } from './components/LocalImportBanner';
import { canAccessTab } from './services/permissions';
import { storage } from './services/storage';
import { Vehicle, ServiceLog, RevisionPlan, LicenciamentoPA, TelemetryAlert, SystemUser, SystemSettings, AlertDispatchLog, Supplier, Driver, USER_ROLE_SHORT } from './types';
import { CheckCircle2, AlertTriangle, Info, Menu, Shield, User } from 'lucide-react';

interface AppProps {
  /** Sai da conta (encerra a sessão no servidor). */
  onLogout: () => void;
}

export default function App({ onLogout }: AppProps) {
  const [currentTab, setCurrentTab] = useState<TabType>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [showGlobalUserModal, setShowGlobalUserModal] = useState<boolean>(false);

  // Core App State from Storage
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => storage.getVehicles());
  const [services, setServices] = useState<ServiceLog[]>(() => storage.getServices());
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => storage.getSuppliers());
  const [revisions, setRevisions] = useState<RevisionPlan[]>(() => storage.getRevisions());
  const [licensingList, setLicensingList] = useState<LicenciamentoPA[]>(() => storage.getLicensing());
  const [alerts, setAlerts] = useState<TelemetryAlert[]>(() => storage.getAlerts());
  const [users, setUsers] = useState<SystemUser[]>(() => storage.getUsers());
  const [currentUser, setCurrentUser] = useState<SystemUser | null>(() => storage.getSessionUser());
  const [drivers, setDrivers] = useState<Driver[]>(() => storage.getDrivers());
  const [settings, setSettings] = useState<SystemSettings>(() => storage.getSettings());
  const [dispatchLogs, setAlertDispatchLogs] = useState<AlertDispatchLog[]>(() => storage.getAlertDispatchLogs());

  // Global Toast State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'warning' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // State sync helpers
  const refreshVehicles = () => setVehicles(storage.getVehicles());
  const refreshServices = () => setServices(storage.getServices());
  const refreshSuppliers = () => setSuppliers(storage.getSuppliers());
  const refreshRevisions = () => setRevisions(storage.getRevisions());
  const refreshLicensing = () => setLicensingList(storage.getLicensing());
  const refreshAlerts = () => setAlerts(storage.getAlerts());
  const refreshUsers = () => setUsers(storage.getUsers());
  const refreshDrivers = () => setDrivers(storage.getDrivers());

  const handleLogout = () => {
    setShowGlobalUserModal(false);
    setMobileMenuOpen(false);
    onLogout();
  };

  // Outra pessoa alterou dados (ou uma gravação foi recusada): recarrega tudo da memória
  const [syncStatus, setSyncStatus] = useState(sync.getStatus());
  useEffect(() => {
    const onChanged = () => {
      setVehicles(storage.getVehicles());
      setServices(storage.getServices());
      setSuppliers(storage.getSuppliers());
      setRevisions(storage.getRevisions());
      setLicensingList(storage.getLicensing());
      setAlerts(storage.getAlerts());
      setUsers(storage.getUsers());
      setDrivers(storage.getDrivers());
      setSettings(storage.getSettings());
      setAlertDispatchLogs(storage.getAlertDispatchLogs());
      setCurrentUser(storage.getSessionUser());
    };
    const onStatus = (e: Event) => setSyncStatus((e as CustomEvent).detail.status);
    const onDenied = (e: Event) => showToast((e as CustomEvent).detail.message, 'warning');
    window.addEventListener('fleet:data-changed', onChanged);
    window.addEventListener('fleet:sync-status', onStatus);
    window.addEventListener('fleet:sync-denied', onDenied);
    return () => {
      window.removeEventListener('fleet:data-changed', onChanged);
      window.removeEventListener('fleet:sync-status', onStatus);
      window.removeEventListener('fleet:sync-denied', onDenied);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Perfil desativado ou excluído por um gestor: encerra a sessão
  useEffect(() => {
    if (!currentUser) onLogout();
  }, [currentUser, onLogout]);
  const refreshSettings = (newSettings?: SystemSettings) => {
    if (newSettings) setSettings(newSettings);
    else setSettings(storage.getSettings());
    refreshLicensing();
  };

  // Envio global de lembretes/alertas pelo WhatsApp (WAHA)
  const handleSendWhatsAppAlert = async (message: string, placa: string, alertaId?: string): Promise<boolean> => {
    const log = (status: AlertDispatchLog['status'], detalhe: string) => {
      storage.addAlertDispatchLog({
        id: 'log-' + Date.now(),
        timestamp: new Date().toISOString(),
        alertaId,
        placa,
        tipo: 'LEMBRETE WHATSAPP',
        mensagem: message,
        status,
        detalhe,
      });
      setAlertDispatchLogs(storage.getAlertDispatchLogs());
    };

    try {
      const response = await fetch('/api/waha/send-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: settings.waha.baseUrl,
          apiKey: settings.waha.apiKey,
          session: settings.waha.session,
          destinos: settings.waha.destinos,
          message,
        }),
      });
      const result = await response.json();

      if (result.sentToWhatsApp) {
        const falhas = result.falhas ? ` · ${result.falhas} falha(s)` : '';
        log('ENVIADO', `WhatsApp (WAHA): ${result.enviados} destinatário(s)${falhas}`);
        showToast(`Lembrete enviado pelo WhatsApp (${placa})${falhas}.`, result.falhas ? 'warning' : 'success');
        return true;
      }
      if (result.simulated) {
        log('SIMULADO', 'Só registrado: configure a WAHA em Configurações');
        showToast(`Lembrete registrado (${placa}). Configure a WAHA para enviar pelo WhatsApp.`, 'info');
        return true;
      }
      log('FALHA', result.error || 'A WAHA recusou o envio');
      showToast(`Falha ao enviar pelo WhatsApp: ${result.error || 'erro desconhecido'}`, 'warning');
      return false;
    } catch (e: any) {
      console.error('Falha no envio pela WAHA:', e);
      log('FALHA', e?.message || 'Servidor indisponível');
      showToast('Erro ao comunicar com o servidor de alertas.', 'warning');
      return false;
    }
  };

  const handleServiceAdded = (newService: ServiceLog) => {
    refreshServices();
    refreshVehicles();
    refreshRevisions();
    showToast(`Serviço cadastrado com sucesso para a placa ${newService.placa}!`, 'success');
  };

  // Real Selsyn Telemetry Background Polling (Zero Simulated Data)
  useEffect(() => {
    const token =
      settings.tracking.operadorKey ||
      settings.tracking.xApiKey ||
      settings.tracking.token;
    if (!token) return;

    const syncLivePositions = async () => {
      try {
        const currentVehs = storage.getVehicles();
        const plates = currentVehs.map(v => v.placa);
        const res = await fetch('/api/selsyn/sync-positions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            baseUrl: settings.tracking.baseUrl || 'https://api.appselsyn.com.br/',
            endpoint: '/keek/rest/v1/integracao/operador/posicao',
            operadorKey: token,
            xApiKey: token,
            clienteId: settings.tracking.clienteId,
            placas: plates,
          }),
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.positions) && data.positions.length > 0) {
          const current = storage.getVehicles();
          let changed = false;

          for (const pos of data.positions) {
            const rawId = String(pos.identificador || pos.rastreavel || '').toUpperCase();
            const cleanId = rawId.replace(/[^A-Z0-9]/g, '');
            if (!cleanId) continue;

            const idx = current.findIndex(
              v => v.placa.toUpperCase().replace(/[^A-Z0-9]/g, '') === cleanId
            );
            if (idx !== -1) {
              current[idx].localizacao.lat =
                pos.latitude || current[idx].localizacao.lat;
              current[idx].localizacao.lng =
                pos.longitude || current[idx].localizacao.lng;
              current[idx].velocidade = pos.velocidade ?? current[idx].velocidade;
              current[idx].ignicao = Boolean(pos.ignicao);
              current[idx].ultimaComunicacao =
                pos.dataComunicacao || pos.dataHora || new Date().toISOString();
              if (pos.fonteEnergia) current[idx].bateriaVolts = pos.fonteEnergia;
              if (pos.odometro !== undefined && pos.odometro !== null) {
                // Selsyn importa em METROS -> converter para KM:
                const rawOdo = Number(pos.odometro);
                const km = rawOdo > 500000 ? Math.round(rawOdo / 1000) : Math.round(rawOdo);
                if (km > 0) {
                  current[idx].odometroRastreador = km;
                  current[idx].dataUltimoOdometroRastreador =
                    pos.dataComunicacao || pos.dataHora || new Date().toISOString();
                  if (km > (current[idx].odometroAtual || 0)) {
                    current[idx].odometroAtual = km;
                  }
                }
              }
              changed = true;
            } else if (current.length === 0) {
              // Auto-seed real vehicle if fleet is empty
              const rawOdo = Number(pos.odometro || 0);
              const initialKm = rawOdo > 500000 ? Math.round(rawOdo / 1000) : (rawOdo > 0 ? Math.round(rawOdo) : 15000);
              current.push({
                id: 'veh-selsyn-' + cleanId.toLowerCase(),
                placa: pos.identificador || cleanId,
                modelo: pos.rastreavel && pos.rastreavel !== pos.identificador ? String(pos.rastreavel) : `Veículo Selsyn ${cleanId}`,
                marca: 'Frota Telecom',
                ano: new Date().getFullYear(),
                cor: 'Branco',
                categoria: 'UTILITARIO',
                chassi: '9BD' + cleanId + '00000',
                renavam: '00' + Date.now().toString().slice(-9),
                status: pos.ignicao ? 'OPERANDO' : 'PARADO',
                combustivel: 'FLEX',
                velocidade: Number(pos.velocidade || 0),
                ignicao: Boolean(pos.ignicao),
                bloqueado: false,
                odometroAtual: initialKm,
                odometroEstimado: initialKm,
                odometroRastreador: initialKm,
                horimetro: 120,
                bateriaVolts: Number(pos.fonteEnergia || 12.6),
                nivelTanque: 85,
                valorVenalFipe: 75000,
                tempoSemMultasAnos: 2,
                localizacao: {
                  lat: Number(pos.latitude) || -1.4558,
                  lng: Number(pos.longitude) || -48.4902,
                  cidade: 'Belém',
                  uf: 'PA',
                  endereco: 'Coordenada GPS Selsyn Keek',
                },
                ultimaComunicacao: pos.dataComunicacao || pos.dataHora || new Date().toISOString(),
              });
              changed = true;
            }
          }

          if (changed) {
            storage.saveVehicles(current);
            refreshVehicles();
          }
        }
      } catch {
        // Silent background polling
      }
    };

    // Run initial sync on load
    syncLivePositions();

    const intervalSec = Math.max(15, settings.tracking.autoSyncInterval || 30);
    const timer = setInterval(syncLivePositions, intervalSec * 1000);
    return () => clearInterval(timer);
  }, [
    settings.tracking.operadorKey,
    settings.tracking.xApiKey,
    settings.tracking.baseUrl,
    settings.tracking.autoSyncInterval,
    settings.tracking.clienteId,
  ]);

  if (!currentUser) return null;

  // Tela fora do perfil de acesso (ex.: link antigo) volta para a visão geral
  const tabAllowed = canAccessTab(currentUser, currentTab);

  return (
    <div className="min-h-screen bg-surface-100 text-ink font-sans flex flex-col md:flex-row">
      {/* Aviso flutuante (vidro fosco, estilo Apple) */}
      <div role="status" aria-live="polite" className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] pointer-events-none">
        {toast && (
          <div className="glass pointer-events-auto px-4 py-3 rounded-2xl shadow-lg border border-white/70 text-sm font-medium text-ink flex items-center gap-2.5 max-w-[min(28rem,calc(100vw-2rem))]">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-green-text shrink-0" />
            ) : toast.type === 'warning' ? (
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
            ) : (
              <Info className="w-5 h-5 text-info shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        )}
      </div>

      {/* Modern Collapsible & Mobile Responsive Left Sidebar */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        vehicles={vehicles}
        alerts={alerts}
        revisions={revisions}
        currentUser={currentUser}
        onLogout={handleLogout}
        syncStatus={syncStatus}
        onOpenUserManagement={
          currentUser.cargo === 'GESTOR' || currentUser.permissoes?.podeGerenciarUsuarios
            ? () => setShowGlobalUserModal(true)
            : undefined
        }
        whatsappConnected={Boolean(settings.waha?.baseUrl && settings.waha?.destinos)}
        trackingConnected={Boolean(
          settings.tracking.operadorKey || settings.tracking.xApiKey || settings.tracking.token
        )}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        mobileOpen={mobileMenuOpen}
        setMobileOpen={setMobileMenuOpen}
      />

      {/* Main Content Column with dynamic left margin for Sidebar */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64'
        }`}
      >
        {/* Barra superior no celular (vidro fosco) */}
        <header className="md:hidden glass flex items-center justify-between gap-3 px-4 h-14 sticky top-0 z-30 border-b border-line">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="w-10 h-10 -ml-2 rounded-[10px] flex items-center justify-center text-brand-navy hover:bg-surface-200 transition-colors"
            aria-label="Abrir menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-[17px] tracking-[-0.01em] text-navy-deep">
            <span className="font-medium">Fleet</span>
            <span className="font-extrabold">Telecom</span>
          </span>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center text-navy-deep hover:bg-surface-200"
            aria-label={`Conta de ${currentUser.nome}`}
          >
            <span className="w-8 h-8 rounded-full bg-cyan-200 flex items-center justify-center">
              {currentUser.cargo === 'GESTOR' ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
            </span>
          </button>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        {currentUser.cargo === 'GESTOR' && (
          <LocalImportBanner
            onImported={() => {
              window.dispatchEvent(new CustomEvent('fleet:data-changed'));
              showToast('Dados importados para o servidor.', 'success');
            }}
          />
        )}

        {!tabAllowed && (
          <div className="bg-white rounded-2xl border border-line p-8 text-center">
            <h1 className="text-[20px] font-bold text-navy-deep">Sem acesso a esta tela</h1>
            <p className="text-[14px] text-ink-muted mt-1">
              O seu perfil ({USER_ROLE_SHORT[currentUser.cargo]}) não inclui este módulo. Fale com um gestor.
            </p>
            <button
              type="button"
              onClick={() => setCurrentTab('dashboard')}
              className="mt-4 h-10 px-4 rounded-[10px] bg-brand-navy text-white text-[14px] font-semibold"
            >
              Ir para a visão geral
            </button>
          </div>
        )}

        {tabAllowed && currentTab === 'drivers' && (
          <DriversView
            drivers={drivers}
            vehicles={vehicles}
            users={users}
            canManage={currentUser.cargo === 'GESTOR' || Boolean(currentUser.permissoes?.podeGerenciarVeiculos)}
            onChanged={() => {
              refreshDrivers();
              refreshVehicles();
            }}
            showToast={showToast}
          />
        )}

        {tabAllowed && currentTab === 'dashboard' && (
          <DashboardView
            vehicles={vehicles}
            services={services}
            revisions={revisions}
            licensingList={licensingList}
            alerts={alerts}
            setCurrentTab={(tab) => setCurrentTab(canAccessTab(currentUser, tab) ? tab : 'dashboard')}
            canLaunch={canAccessTab(currentUser, 'maintenance')}
            onSendWhatsAppAlert={handleSendWhatsAppAlert}
          />
        )}

        {tabAllowed && currentTab === 'vehicles' && (
          <VehiclesView
            vehicles={vehicles}
            services={services}
            drivers={drivers}
            onVehiclesUpdated={refreshVehicles}
            onServiceAdded={handleServiceAdded}
            onNavigateToAI={(placa) => {
              setCurrentTab('maintenance');
            }}
            onNavigateToTracking={(veiculoId) => {
              setCurrentTab('tracking');
            }}
            onSendWhatsAppAlert={handleSendWhatsAppAlert}
          />
        )}

        {tabAllowed && currentTab === 'suppliers' && (
          <SuppliersView
            suppliers={suppliers}
            services={services}
            vehicles={vehicles}
            currentUser={currentUser}
            onSuppliersUpdated={refreshSuppliers}
            onNavigateToMaintenance={(fornecedorId) => {
              setCurrentTab('maintenance');
            }}
          />
        )}

        {tabAllowed && currentTab === 'maintenance' && (
          <AIMaintenanceView
            vehicles={vehicles}
            services={services}
            suppliers={suppliers}
            onSuppliersUpdated={refreshSuppliers}
            currentUser={currentUser}
            onUpdateCurrentUser={(user) => {
              setCurrentUser(user);
              storage.setActiveUser(user);
            }}
            users={users}
            onServiceAdded={handleServiceAdded}
            onServiceUpdated={(updated) => {
              refreshServices();
              refreshVehicles();
              refreshRevisions();
              showToast(`Lançamento do veículo ${updated.placa} atualizado com sucesso!`, 'success');
            }}
            onSendWhatsAppAlert={handleSendWhatsAppAlert}
          />
        )}

        {tabAllowed && currentTab === 'reports' && (
          <ReportsView
            vehicles={vehicles}
            services={services}
            suppliers={suppliers}
          />
        )}

        {tabAllowed && currentTab === 'revisions' && (
          <RevisionsMonitorView
            vehicles={vehicles}
            revisions={revisions}
            currentUser={currentUser}
            onRevisionsUpdated={refreshRevisions}
            onSendWhatsAppAlert={handleSendWhatsAppAlert}
          />
        )}

        {tabAllowed && currentTab === 'calendar' && (
          <FleetCalendarView
            vehicles={vehicles}
            revisions={revisions}
            services={services}
            onScheduleRevision={() => setCurrentTab('revisions')}
          />
        )}

        {tabAllowed && currentTab === 'detran' && (
          <LicenciamentoPAView
            vehicles={vehicles}
            licensingList={licensingList}
            onLicensingUpdated={refreshLicensing}
            onSendWhatsAppAlert={handleSendWhatsAppAlert}
          />
        )}

        {tabAllowed && currentTab === 'tracking' && (
          <TrackingMapView
            vehicles={vehicles}
            onVehiclesUpdated={refreshVehicles}
            onSendWhatsAppAlert={handleSendWhatsAppAlert}
          />
        )}

        {tabAllowed && currentTab === 'alerts' && (
          <AlertsWhatsAppView
            alerts={alerts}
            vehicles={vehicles}
            settings={settings}
            dispatchLogs={dispatchLogs}
            onAlertsUpdated={refreshAlerts}
            onSendWhatsAppAlert={handleSendWhatsAppAlert}
          />
        )}

        {tabAllowed && currentTab === 'config' && (
          <ConfigView
            settings={settings}
            users={users}
            onSettingsUpdated={refreshSettings}
            onUsersUpdated={refreshUsers}
            onSendWhatsAppAlert={handleSendWhatsAppAlert}
          />
        )}
      </main>

      <footer className="border-t border-line mt-12 py-6 text-[13px] text-ink-muted">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>
            <span className="font-semibold text-navy-deep">Fleet Telecom</span> · gestão de frota por Norte Telecom
          </span>
          {import.meta.env.DEV && currentUser.cargo === 'GESTOR' && (
          <button
            type="button"
            onClick={() => {
              if (confirm('Restaurar os dados de demonstração? Os dados atuais da frota serão substituídos.')) {
                storage.resetAllToDefaults();
                storage.loadDemoPreset();
                refreshVehicles();
                refreshServices();
                refreshSuppliers();
                refreshRevisions();
                refreshLicensing();
                refreshAlerts();
                refreshUsers();
                refreshSettings();
                showToast('Dados de demonstração restaurados.', 'info');
              }
            }}
            className="min-h-10 px-3 rounded-[10px] text-info font-medium hover:bg-surface-200"
          >
            Restaurar dados de demonstração
          </button>
          )}
        </div>
      </footer>

      {/* Global User & Privilege Management Modal */}
      <UserManagementModal
        isOpen={showGlobalUserModal}
        onClose={() => setShowGlobalUserModal(false)}
        currentUser={currentUser}
        onUserChanged={(updatedUser) => {
          setCurrentUser(updatedUser);
          refreshUsers();
        }}
        onUsersListUpdated={() => {
          refreshUsers();
          refreshDrivers();
          // Se o próprio usuário foi desativado ou excluído, a sessão termina
          setCurrentUser(storage.getSessionUser());
        }}
      />
    </div>
  </div>
);
}

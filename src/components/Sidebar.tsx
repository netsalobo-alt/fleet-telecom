import React from 'react';
import {
  Car,
  LayoutGrid,
  Wrench,
  CalendarCheck2,
  CalendarDays,
  FileText,
  MapPin,
  Bell,
  Settings,
  BarChart3,
  User,
  Shield,
  Building2,
  ChevronLeft,
  ChevronRight,
  X,
  Plus,
  Key,
} from 'lucide-react';
import { TelemetryAlert, Vehicle, SystemUser, RevisionPlan } from '../types';

export type TabType =
  | 'dashboard'
  | 'vehicles'
  | 'suppliers'
  | 'maintenance'
  | 'reports'
  | 'revisions'
  | 'calendar'
  | 'detran'
  | 'tracking'
  | 'alerts'
  | 'config';

interface SidebarProps {
  currentTab: TabType;
  setCurrentTab: (tab: TabType) => void;
  vehicles: Vehicle[];
  alerts: TelemetryAlert[];
  revisions?: RevisionPlan[];
  currentUser?: SystemUser;
  onSwitchUser?: (user: SystemUser) => void;
  onOpenUserManagement?: () => void;
  users?: SystemUser[];
  chatwootConnected: boolean;
  trackingConnected: boolean;
  isCollapsed: boolean;
  setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

type NavItem = {
  id: TabType;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  badge?: number;
  badgeTone?: 'accent' | 'danger' | 'warning';
  section: string;
};

/** Marca Fleet Telecom: as três ondas de sinal da Norte em navy sobre o verde. */
const BrandMark: React.FC = () => (
  <span
    aria-hidden="true"
    className="w-9 h-9 rounded-[10px] bg-brand-green flex items-center justify-center shrink-0"
  >
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#002946" strokeWidth="2.2" strokeLinecap="round">
      <path d="M4 13a8 8 0 0 1 16 0M7.5 13a4.5 4.5 0 0 1 9 0M12 13v.01" />
    </svg>
  </span>
);

const badgeClass: Record<NonNullable<NavItem['badgeTone']>, string> = {
  accent: 'bg-brand-green text-navy-deep',
  warning: 'bg-amber-300 text-navy-deep',
  danger: 'bg-red-300 text-navy-deep',
};

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  vehicles,
  alerts,
  revisions = [],
  currentUser,
  onSwitchUser,
  onOpenUserManagement,
  users = [],
  chatwootConnected,
  trackingConnected,
  isCollapsed,
  setIsCollapsed,
  mobileOpen,
  setMobileOpen,
}) => {
  const unresolvedAlerts = alerts.filter(a => !a.resolvido).length;
  const criticalAlerts = alerts.filter(a => !a.resolvido && a.nivel === 'CRITICO').length;
  const overdueRevisions = revisions.filter(r => r.status === 'VENCIDO').length;
  const warningRevisions = revisions.filter(r => r.status === 'PROXIMO').length;
  const activeVehicles = vehicles.filter(v => v.status === 'OPERANDO').length;

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Visão geral', icon: LayoutGrid, section: 'Principal' },
    { id: 'vehicles', label: 'Frota', icon: Car, badge: vehicles.length, badgeTone: 'accent', section: 'Cadastros' },
    { id: 'suppliers', label: 'Fornecedores', icon: Building2, section: 'Cadastros' },
    {
      id: 'revisions',
      label: 'Revisões',
      icon: CalendarCheck2,
      badge: overdueRevisions || warningRevisions,
      badgeTone: overdueRevisions > 0 ? 'danger' : 'warning',
      section: 'Operação',
    },
    { id: 'calendar', label: 'Calendário', icon: CalendarDays, section: 'Operação' },
    { id: 'maintenance', label: 'Lançar serviços', icon: Wrench, section: 'Operação' },
    { id: 'tracking', label: 'Rastreamento', icon: MapPin, section: 'Operação' },
    { id: 'detran', label: 'IPVA e licenciamento', icon: FileText, section: 'Fiscal e relatórios' },
    { id: 'reports', label: 'Gastos', icon: BarChart3, section: 'Fiscal e relatórios' },
    {
      id: 'alerts',
      label: 'Alertas',
      icon: Bell,
      badge: unresolvedAlerts,
      badgeTone: criticalAlerts > 0 ? 'danger' : 'accent',
      section: 'Sistema',
    },
    { id: 'config', label: 'Configurações', icon: Settings, section: 'Sistema' },
  ];

  const handleSelectTab = (id: TabType) => {
    setCurrentTab(id);
    if (mobileOpen) setMobileOpen(false);
  };

  const navContent = (
    <nav aria-label="Navegação principal" className="flex flex-col h-full bg-brand-navy text-white select-none">
      {/* Marca */}
      <div className={`px-4 pt-5 pb-3 flex items-center gap-2 ${isCollapsed ? 'justify-center px-2' : 'justify-between'}`}>
        <button
          type="button"
          onClick={() => handleSelectTab('dashboard')}
          className="flex items-center gap-2.5 min-w-0 rounded-[10px]"
          aria-label="Fleet Telecom, ir para a visão geral"
        >
          <BrandMark />
          {!isCollapsed && (
            <span className="text-[17px] leading-tight tracking-[-0.01em] truncate">
              <span className="font-medium">Fleet</span>
              <span className="font-extrabold">Telecom</span>
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setIsCollapsed(prev => !prev)}
          className={`hidden md:flex items-center justify-center w-8 h-8 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors ${isCollapsed ? 'hidden!' : ''}`}
          aria-label={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg text-white/70 hover:text-white hover:bg-white/10"
          aria-label="Fechar menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Ação principal */}
      <div className={`px-3 pb-2 ${isCollapsed ? 'flex justify-center px-2' : ''}`}>
        <button
          type="button"
          onClick={() => handleSelectTab('maintenance')}
          className={`h-10 rounded-[10px] bg-brand-green text-navy-deep text-sm font-semibold flex items-center justify-center gap-2 hover:brightness-105 active:scale-[0.98] transition ${
            isCollapsed ? 'w-10' : 'w-full'
          }`}
          aria-label="Lançar serviço"
          title={isCollapsed ? 'Lançar serviço' : undefined}
        >
          <Plus className="w-4 h-4" strokeWidth={2.25} />
          {!isCollapsed && <span>Lançar serviço</span>}
        </button>
      </div>

      {/* Navegação */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-3 py-2">
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          const prevItem = navItems[index - 1];
          const showSection = !isCollapsed && (!prevItem || prevItem.section !== item.section);
          const hasBadge = item.badge !== undefined && item.badge > 0;

          return (
            <React.Fragment key={item.id}>
              {showSection && (
                <div className="pt-4 pb-1.5 px-2.5 text-[11px] font-semibold tracking-[0.06em] uppercase text-[#9fb0bf]">
                  {item.section}
                </div>
              )}
              <button
                type="button"
                onClick={() => handleSelectTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center gap-2.5 min-h-10 px-2.5 rounded-[10px] text-sm font-medium transition-colors ${
                  isActive ? 'bg-white/15 text-white' : 'text-white/80 hover:text-white hover:bg-white/8'
                } ${isCollapsed ? 'justify-center px-0 my-0.5' : ''}`}
              >
                <span className="relative shrink-0">
                  <Icon className="w-[18px] h-[18px]" strokeWidth={1.75} />
                  {isCollapsed && hasBadge && (
                    <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-brand-green ring-2 ring-brand-navy" />
                  )}
                </span>
                {!isCollapsed && (
                  <>
                    <span className="flex-1 text-left truncate">{item.label}</span>
                    {hasBadge && (
                      <span
                        className={`min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold inline-flex items-center justify-center tabular-nums ${
                          badgeClass[item.badgeTone || 'accent']
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* Estado das integrações (real, não fixo) */}
      {!isCollapsed && (
        <div className="mx-3 mb-2 p-3 rounded-xl bg-white/6 text-xs space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-white/80">
              <span
                aria-hidden="true"
                className={`w-2 h-2 rounded-full ${trackingConnected ? 'bg-brand-green' : 'bg-amber-400'}`}
              />
              Rastreador Selsyn
            </span>
            <span className={`font-semibold ${trackingConnected ? 'text-brand-green' : 'text-amber-300'}`}>
              {trackingConnected ? 'Conectado' : 'Não configurado'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-white/80">
              <span
                aria-hidden="true"
                className={`w-2 h-2 rounded-full ${chatwootConnected ? 'bg-brand-green' : 'bg-amber-400'}`}
              />
              Chatwoot
            </span>
            <span className={`font-semibold ${chatwootConnected ? 'text-brand-green' : 'text-amber-300'}`}>
              {chatwootConnected ? 'Conectado' : 'Não configurado'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 text-white/80">
            <span>Em operação</span>
            <span className="font-semibold text-white tabular-nums">
              {activeVehicles} de {vehicles.length}
            </span>
          </div>
        </div>
      )}

      {isCollapsed && (
        <div className="hidden md:flex justify-center pb-2">
          <button
            type="button"
            onClick={() => setIsCollapsed(false)}
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10"
            aria-label="Expandir menu"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Usuário */}
      <div className={`border-t border-white/12 p-3 ${isCollapsed ? 'flex justify-center p-2' : ''}`}>
        {currentUser && (
          <div className={`flex items-center gap-2.5 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
            <div className="flex items-center gap-2.5 min-w-0" title={`${currentUser.nome} (${currentUser.cargo})`}>
              <span
                aria-hidden="true"
                className="w-8 h-8 rounded-full bg-cyan-200 text-navy-deep flex items-center justify-center shrink-0"
              >
                {currentUser.cargo === 'GESTOR' ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </span>
              {!isCollapsed && (
                <span className="min-w-0 flex flex-col">
                  <span className="text-[13px] font-semibold text-white truncate">{currentUser.nome}</span>
                  <span className="text-[11px] text-[#9fb0bf]">
                    {currentUser.cargo === 'GESTOR' ? 'Gestor' : 'Operador'}
                  </span>
                </span>
              )}
            </div>

            {!isCollapsed && (
              <div className="flex items-center gap-1">
                {onSwitchUser && users.length > 1 && (
                  <select
                    aria-label="Trocar perfil de demonstração"
                    value={currentUser.id}
                    onChange={e => {
                      const selected = users.find(u => u.id === e.target.value);
                      if (selected) onSwitchUser(selected);
                    }}
                    className="max-w-24 bg-white/10 text-[11px] text-white rounded-lg px-1.5 h-8 cursor-pointer"
                  >
                    {users.map(u => (
                      <option key={u.id} value={u.id} className="text-navy-deep">
                        {u.nome.split(' ')[0]} ({u.cargo === 'GESTOR' ? 'Gestor' : 'Oper.'})
                      </option>
                    ))}
                  </select>
                )}
                {onOpenUserManagement && (
                  <button
                    type="button"
                    onClick={onOpenUserManagement}
                    className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    aria-label="Usuários, senhas e permissões"
                  >
                    <Key className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );

  return (
    <>
      <aside
        className={`hidden md:flex flex-col fixed top-0 left-0 bottom-0 z-40 transition-[width] duration-300 ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {navContent}
      </aside>

      {mobileOpen && (
        <div
          aria-hidden="true"
          onClick={() => setMobileOpen(false)}
          className="md:hidden fixed inset-0 z-50 bg-navy-deep/50 backdrop-blur-sm"
        />
      )}

      <aside
        className={`md:hidden fixed top-0 left-0 bottom-0 z-50 w-72 max-w-[85vw] transform transition-transform duration-300 ease-out shadow-xl ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {navContent}
      </aside>
    </>
  );
};

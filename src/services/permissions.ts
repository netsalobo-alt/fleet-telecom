import { SystemUser, UserPermissions, UserRole } from '../types';

/**
 * Telas novas herdam a permissão de um módulo existente, para não sumirem
 * de quem já tinha o acesso equivalente salvo no perfil.
 */
const MODULE_ALIAS: Record<string, string> = {
  calendar: 'revisions',
  drivers: 'vehicles',
};

/** O usuário pode abrir esta tela? Gestor vê tudo; os demais seguem os módulos do perfil. */
export function canAccessTab(user: SystemUser, tab: string): boolean {
  if (user.cargo === 'GESTOR') return true;
  if (tab === 'dashboard') return true;
  const modulos = user.permissoes?.modulosPermitidos;
  if (!modulos || modulos.length === 0) return true;
  return modulos.includes(tab) || (MODULE_ALIAS[tab] ? modulos.includes(MODULE_ALIAS[tab]) : false);
}

export function getDefaultPermissionsByRole(role: UserRole): UserPermissions {
  if (role === 'GESTOR') {
    return {
      modulosPermitidos: [
        'dashboard',
        'vehicles',
        'suppliers',
        'revisions',
        'maintenance',
        'tracking',
        'detran',
        'reports',
        'alerts',
        'config',
      ],
      podeLancarNotas: true,
      podeEditarNotasProprias: true,
      limiteHorasEdicaoPropria: 0, // ilimitado para gestor
      podeEditarQualquerNota: true, // gestor edita qualquer nota
      podeExcluirNotas: true,
      podeGerenciarVeiculos: true,
      podeGerenciarFornecedores: true,
      podeGerenciarUsuarios: true,
      podeExportarRelatorios: true,
    };
  }

  if (role === 'OPERADOR') {
    return {
      modulosPermitidos: [
        'dashboard',
        'vehicles',
        'suppliers',
        'revisions',
        'maintenance',
        'detran',
      ],
      podeLancarNotas: true,
      podeEditarNotasProprias: true,
      limiteHorasEdicaoPropria: 24, // regra de 24 horas
      podeEditarQualquerNota: false,
      podeExcluirNotas: false,
      podeGerenciarVeiculos: false,
      podeGerenciarFornecedores: false,
      podeGerenciarUsuarios: false,
      podeExportarRelatorios: false,
    };
  }

  if (role === 'MOTORISTA') {
    return {
      // Motorista com acesso lança as notas dos serviços que fez e edita as próprias por 24h
      modulosPermitidos: ['dashboard', 'vehicles', 'revisions', 'maintenance'],
      podeLancarNotas: true,
      podeEditarNotasProprias: true,
      limiteHorasEdicaoPropria: 24,
      podeEditarQualquerNota: false,
      podeExcluirNotas: false,
      podeGerenciarVeiculos: false,
      podeGerenciarFornecedores: false,
      podeGerenciarUsuarios: false,
      podeExportarRelatorios: false,
    };
  }

  // VISUALIZADOR / AUDITOR
  return {
    modulosPermitidos: ['dashboard', 'vehicles', 'suppliers', 'revisions', 'reports', 'detran'],
    podeLancarNotas: false,
    podeEditarNotasProprias: false,
    limiteHorasEdicaoPropria: 0,
    podeEditarQualquerNota: false,
    podeExcluirNotas: false,
    podeGerenciarVeiculos: false,
    podeGerenciarFornecedores: false,
    podeGerenciarUsuarios: false,
    podeExportarRelatorios: true,
  };
}


// Default system users with credentials and granular permissions
/** Usuários de demonstração (só no modo de desenvolvimento; a senha de todos é 123). */
export const DEFAULT_SYSTEM_USERS: SystemUser[] = [
  {
    id: 'usr-admin-1',
    nome: 'Carlos Henrique',
    login: 'carlos.gestao',
    senha: '123',
    email: 'gestao@fleet-telecom.com.br',
    cpf: '123.456.789-00',
    cargo: 'GESTOR', // Administrador
    status: 'ATIVO',
    telefone: '(91) 98123-4567',
    dataCriacao: '2026-01-10T08:00:00.000Z',
    permissoes: getDefaultPermissionsByRole('GESTOR'),
  },
  {
    id: 'usr-op-1',
    nome: 'Marcos Pereira',
    login: 'marcos.notas',
    senha: '123',
    email: 'marcos.operador@fleet-telecom.com.br',
    cpf: '234.567.890-11',
    cargo: 'OPERADOR', // Usuário responsável pelo lançamento de notas
    status: 'ATIVO',
    telefone: '(91) 98234-5678',
    dataCriacao: '2026-01-15T09:30:00.000Z',
    permissoes: getDefaultPermissionsByRole('OPERADOR'),
  },
  {
    id: 'usr-op-2',
    nome: 'Ana Beatriz',
    login: 'ana.lancamento',
    senha: '123',
    email: 'ana.operadora@fleet-telecom.com.br',
    cpf: '345.678.901-22',
    cargo: 'OPERADOR',
    status: 'ATIVO',
    telefone: '(91) 98345-6789',
    dataCriacao: '2026-02-01T10:00:00.000Z',
    permissoes: getDefaultPermissionsByRole('OPERADOR'),
  },
  {
    id: 'usr-mot-1',
    nome: 'Roberto Lima',
    login: 'roberto.motorista',
    senha: '123',
    email: 'roberto.motorista@fleet-telecom.com.br',
    cpf: '456.789.012-33',
    cargo: 'MOTORISTA',
    status: 'ATIVO',
    telefone: '(91) 98456-7890',
    cnh: '05432198760',
    cnhCategoria: 'AD',
    cnhValidade: '2027-05-20',
    dataCriacao: '2026-02-10T11:00:00.000Z',
    permissoes: getDefaultPermissionsByRole('MOTORISTA'),
  },
];



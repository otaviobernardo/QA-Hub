import type { Severity, Priority, BugStatus, Environment } from '../types';

export const SEVERITIES: Severity[] = ['Crítico', 'Alto', 'Médio', 'Baixo'];
export const PRIORITIES: Priority[] = ['Alta', 'Média', 'Baixa'];
export const STATUSES: BugStatus[] = [
  'Aberto',
  'Em andamento',
  'Resolvido',
  'Fechado',
];
export const ENVIRONMENTS: Environment[] = ['Dev', 'Homologação', 'Produção'];

/** Classes Tailwind para o badge de severidade. */
export const severityBadge: Record<Severity, string> = {
  'Crítico': 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  'Alto': 'bg-selbetti-orange/15 text-selbetti-orange',
  'Médio': 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  'Baixo': 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

/** Classes Tailwind para o badge de status. */
export const statusBadge: Record<BugStatus, string> = {
  'Aberto': 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  'Em andamento': 'bg-selbetti-purple/15 text-selbetti-purple',
  'Resolvido': 'bg-selbetti-green/15 text-selbetti-green',
  'Fechado': 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

/** Classes Tailwind para o badge de prioridade. */
export const priorityBadge: Record<Priority, string> = {
  'Alta': 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  'Média': 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  'Baixa': 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

import type { TestCase, SavedCaseStatus } from '../types';

type Tipo = TestCase['tipo'];

export const TIPO_OPTIONS: { value: Tipo; label: string }[] = [
  { value: 'positivo', label: 'Positivo' },
  { value: 'negativo', label: 'Negativo' },
  { value: 'edge', label: 'Edge case' },
  { value: 'regressao', label: 'Regressão' },
  { value: 'integracao', label: 'Integração' },
  { value: 'api', label: 'API' },
  { value: 'exploratorio', label: 'Exploratório' },
  { value: 'aceitacao', label: 'Aceitação (UAT)' },
  { value: 'smoke', label: 'Smoke' },
  { value: 'seguranca', label: 'Segurança' },
  { value: 'usabilidade', label: 'Usabilidade' },
  { value: 'compatibilidade', label: 'Compatibilidade' },
  { value: 'acessibilidade', label: 'Acessibilidade' },
  { value: 'performance', label: 'Performance' },
];

export const tipoLabel: Record<Tipo, string> = {
  positivo: 'Positivo',
  negativo: 'Negativo',
  edge: 'Edge case',
  regressao: 'Regressão',
  acessibilidade: 'Acessibilidade',
  performance: 'Performance',
  seguranca: 'Segurança',
  usabilidade: 'Usabilidade',
  integracao: 'Integração',
  compatibilidade: 'Compatibilidade',
  aceitacao: 'Aceitação (UAT)',
  smoke: 'Smoke',
  api: 'API',
  exploratorio: 'Exploratório',
};

export const tipoBadge: Record<Tipo, string> = {
  positivo: 'bg-selbetti-green/15 text-selbetti-green',
  negativo: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  edge: 'bg-selbetti-orange/15 text-selbetti-orange',
  regressao: 'bg-selbetti-purple/15 text-selbetti-purple',
  acessibilidade: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  performance:
    'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  seguranca: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  usabilidade: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
  integracao:
    'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  compatibilidade:
    'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300',
  aceitacao:
    'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  smoke: 'bg-slate-100 text-slate-700 dark:bg-slate-600/30 dark:text-slate-300',
  api: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  exploratorio:
    'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300',
};

export const SAVED_STATUS_LABEL: Record<SavedCaseStatus, string> = {
  pendente: 'Pendente',
  pass: 'Passou',
  fail: 'Falhou',
};

export const savedStatusBadge: Record<SavedCaseStatus, string> = {
  pendente: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  pass: 'bg-selbetti-green/15 text-selbetti-green dark:bg-green-500/20 dark:text-green-300',
  fail: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
};

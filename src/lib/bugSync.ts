/**
 * Sincronização de bugs com o Azure DevOps.
 * - push: cria/atualiza uma Task "BUG | título" (filha de um PBI) no Azure.
 * - pull: lê o estado do work item e traduz de volta para o status do bug.
 *
 * O Firestore é a fonte da verdade do app; o Azure é best-effort. Falhas de
 * push/pull não devem impedir o salvamento local — o chamador trata o erro.
 */
import type { Bug, BugStatus } from '../types';
import {
  createWorkItem,
  readWorkItem,
  updateState,
  field,
  apiWorkItemUrl,
  webWorkItemUrl,
  REL_PARENT,
} from './azure';
import { ENV_DETAIL_META } from './bugOptions';

/** Status do bug → estado do work item no Azure (processo Scrum custom). */
export const STATUS_TO_STATE: Record<BugStatus, string> = {
  Aberto: 'New',
  'Em andamento': 'Committed',
  Resolvido: 'Done',
  Fechado: 'Done',
};

/**
 * Estado do Azure → status do bug. "Done" é ambíguo (Resolvido vs. Fechado, que
 * ambos viram Done no push): se o bug local já está Fechado, mantém Fechado.
 */
export function stateToStatus(state: string, current: BugStatus): BugStatus {
  switch (state) {
    case 'New':
      return 'Aberto';
    case 'Committed':
      return 'Em andamento';
    case 'Done':
      return current === 'Fechado' ? 'Fechado' : 'Resolvido';
    case 'Removed':
      return 'Fechado';
    default:
      return current; // estado desconhecido: não altera
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Monta a descrição (HTML) do work item a partir dos campos do bug. */
function buildDescription(bug: Bug): string {
  const detailLabel = ENV_DETAIL_META[bug.environment].label;
  const linhas = [
    `<b>Módulo:</b> ${escapeHtml(bug.module)}`,
    `<b>Sprint:</b> ${escapeHtml(bug.sprint)}`,
    `<b>Severidade:</b> ${escapeHtml(bug.severity)} · <b>Prioridade:</b> ${escapeHtml(bug.priority)}`,
    `<b>Ambiente:</b> ${escapeHtml(bug.environment)}${
      bug.environmentDetail ? ` (${detailLabel}: ${escapeHtml(bug.environmentDetail)})` : ''
    }`,
    `<b>Responsável:</b> ${escapeHtml(bug.assignee)}`,
    '<hr/>',
    escapeHtml(bug.description).replace(/\n/g, '<br/>'),
  ];
  if (bug.evidence.trim()) {
    linhas.push('<hr/>', `<b>Evidência:</b><br/>${escapeHtml(bug.evidence).replace(/\n/g, '<br/>')}`);
  }
  return linhas.join('<br/>');
}

export interface AzureLink {
  azureWorkItemId: number;
  azureUrl: string;
  azureSyncedAt: Date;
}

/**
 * Cria a Task "BUG | título" no Azure. Se o bug tiver azureParentId, vincula
 * como filha do PBI. Devolve os dados para gravar o vínculo no bug.
 */
export async function pushNewBug(pat: string, bug: Bug): Promise<AzureLink> {
  const item = await createWorkItem(pat, {
    type: 'Task',
    title: `BUG | ${bug.title}`,
    description: buildDescription(bug),
    extraFields: { 'System.State': STATUS_TO_STATE[bug.status] },
    relations: bug.azureParentId
      ? [{ rel: REL_PARENT, url: apiWorkItemUrl(bug.azureParentId) }]
      : undefined,
  });
  return {
    azureWorkItemId: item.id,
    azureUrl: webWorkItemUrl(item.id),
    azureSyncedAt: new Date(),
  };
}

/** Atualiza o estado do work item a partir do status do bug. */
export async function pushBugStatus(
  pat: string,
  workItemId: number,
  status: BugStatus,
): Promise<void> {
  await updateState(pat, workItemId, STATUS_TO_STATE[status]);
}

/**
 * Lê o work item e, se o estado no Azure traduzir para um status diferente do
 * local, devolve o novo status. Caso contrário, devolve null (nada a fazer).
 */
export async function pullBugStatus(
  pat: string,
  bug: Bug,
): Promise<BugStatus | null> {
  if (!bug.azureWorkItemId) return null;
  const item = await readWorkItem(pat, bug.azureWorkItemId);
  const state = field(item, 'System.State');
  const next = stateToStatus(state, bug.status);
  return next === bug.status ? null : next;
}

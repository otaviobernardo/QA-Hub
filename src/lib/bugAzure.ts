/**
 * Criação dos cards de um bug no Azure DevOps.
 * Ao registrar um bug, abrimos 3 work items filhos da US (PBI) informada, cada
 * um do seu tipo e com o prefixo no título:
 *   - tipo "Bug"          → "BUG | <título>"
 *   - tipo "Code Review"  → "CR | <título>"
 *   - tipo "Teste"        → "Teste | <título>"
 * Todos SEM dono e no estado inicial do processo (New). Best-effort: o chamador
 * trata falhas sem perder o bug já salvo.
 */
import { createWorkItem, apiWorkItemUrl, REL_PARENT } from './azure';

/** Os 3 cards a criar: prefixo do título + tipo do work item no Azure. */
const CARDS: { prefixo: string; type: string }[] = [
  { prefixo: 'BUG', type: 'Bug' },
  { prefixo: 'CR', type: 'Code Review' },
  { prefixo: 'Teste', type: 'Teste' },
];

export interface BugTasksResult {
  bugId: number;
  crId: number;
  testeId: number;
}

export async function createBugTasks(
  pat: string,
  parentId: number,
  bugTitle: string,
): Promise<BugTasksResult> {
  const parentRel = [{ rel: REL_PARENT, url: apiWorkItemUrl(parentId) }];

  // Sequencial para respeitar limites e manter a ordem BUG → CR → Teste.
  const ids: number[] = [];
  for (const c of CARDS) {
    const wi = await createWorkItem(pat, {
      type: c.type,
      title: `${c.prefixo} | ${bugTitle}`,
      relations: parentRel,
      // Sem dono e no estado inicial do processo (não força o estado).
    });
    ids.push(wi.id);
  }
  return { bugId: ids[0], crId: ids[1], testeId: ids[2] };
}

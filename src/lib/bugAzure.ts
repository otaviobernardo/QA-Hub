/**
 * Criação dos cards de um bug no Azure DevOps.
 * Ao registrar um bug, abrimos 3 Tasks filhas da US (PBI) informada:
 *   - "BUG | <título>"   (o defeito)
 *   - "CR | <título>"    (code review da correção)
 *   - "Teste | <título>" (re-teste)
 * Todas em NEW e SEM dono. Best-effort: o chamador trata falhas sem perder o bug.
 */
import { createWorkItem, apiWorkItemUrl, REL_PARENT } from './azure';

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
  const criar = (prefixo: string) =>
    createWorkItem(pat, {
      type: 'Task',
      title: `${prefixo} | ${bugTitle}`,
      relations: parentRel,
      // NEW e sem dono: não define AssignedTo.
      extraFields: { 'System.State': 'New' },
    });

  // Sequencial para respeitar limites e manter a ordem BUG → CR → Teste.
  const bug = await criar('BUG');
  const cr = await criar('CR');
  const teste = await criar('Teste');
  return { bugId: bug.id, crId: cr.id, testeId: teste.id };
}

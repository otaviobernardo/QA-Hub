/**
 * Importa User Story, Critérios de Aceite e Análise do Dev a partir de um card
 * do Azure DevOps, dado o ID do PBI.
 * - User Story        → campo System.Description do PBI
 * - Critérios de Aceite → campo Microsoft.VSTS.Common.AcceptanceCriteria do PBI
 * - Análise do Dev    → System.Description da Task filha intitulada "Análise"
 */
import { readWorkItem, updateFields, field, type WorkItem } from './azure';

const REL_CHILD = 'System.LinkTypes.Hierarchy-Forward';

/** Converte o HTML rico do Azure em texto legível (quebras e bullets). */
export function htmlToText(html: string): string {
  if (!html) return '';
  let s = html;
  // Quebras de bloco viram nova linha.
  s = s.replace(/<\s*(br|\/p|\/div|\/h[1-6]|\/tr)\s*\/?>/gi, '\n');
  // Itens de lista viram bullets.
  s = s.replace(/<\s*li[^>]*>/gi, '• ');
  s = s.replace(/<\s*\/\s*li\s*>/gi, '\n');
  // Remove o restante das tags.
  s = s.replace(/<[^>]+>/g, '');
  // Decodifica entidades HTML (&amp;, &nbsp;, etc.) usando o próprio DOM.
  const ta = document.createElement('textarea');
  ta.innerHTML = s;
  s = ta.value;
  // Normaliza espaços e quebras excessivas.
  s = s.replace(/ /g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

/** Extrai o id numérico de uma URL de work item (…/workItems/153110). */
function idFromUrl(url: string): number | null {
  const m = url.match(/(\d+)\s*$/);
  return m ? Number(m[1]) : null;
}

/** Acha a Task filha de Análise (ignora "Análise Review"). */
function isAnalise(item: WorkItem): boolean {
  const t = field(item, 'System.Title').trim().toLowerCase();
  return t === 'análise' || t === 'analise' || (t.startsWith('análise') && !t.includes('review'));
}

/** Acha a Task filha de "Mapa de testes". */
function isMapaDeTestes(item: WorkItem): boolean {
  const t = field(item, 'System.Title').trim().toLowerCase();
  return t.includes('mapa de teste');
}

/** Lê os ids dos filhos (Hierarchy-Forward) de um work item. */
function childIdsOf(item: WorkItem): number[] {
  return (item.relations ?? [])
    .filter((r) => r.rel === REL_CHILD)
    .map((r) => idFromUrl(r.url))
    .filter((x): x is number => x !== null);
}

export interface MapaTask {
  id: number;
  /** Descrição atual (HTML) da task — para decidir sobre sobrescrever. */
  currentHtml: string;
  /** Estado atual no Azure (ex.: New | Committed | Done). */
  state: string;
}

/**
 * Localiza a Task filha "Mapa de testes" do card e devolve id + descrição atual
 * + estado. Havendo mais de uma, prefere a que NÃO está finalizada (Done), para
 * não escrever numa task já encerrada. Retorna null se não achar.
 */
export async function findMapaDeTestes(
  pat: string,
  cardId: number | string,
): Promise<MapaTask | null> {
  const pbi = await readWorkItem(pat, cardId);
  const ids = childIdsOf(pbi);
  if (ids.length === 0) return null;
  const children = await Promise.all(ids.map((id) => readWorkItem(pat, id)));
  const matches = children.filter(isMapaDeTestes);
  if (matches.length === 0) return null;
  const active =
    matches.find((m) => field(m, 'System.State') !== 'Done') ?? matches[0];
  return {
    id: active.id,
    currentHtml: field(active, 'System.Description'),
    state: field(active, 'System.State'),
  };
}

/** Escreve o HTML na descrição da task "Mapa de testes". */
export async function writeMapaDeTestes(
  pat: string,
  id: number,
  html: string,
): Promise<void> {
  await updateFields(pat, id, { 'System.Description': html });
}

export interface CardImport {
  title: string;
  userStory: string;
  criteria: string;
  devAnalysis: string;
  foundAnalise: boolean;
}

export async function importFromCard(
  pat: string,
  cardId: number | string,
): Promise<CardImport> {
  const pbi = await readWorkItem(pat, cardId);

  const userStory = htmlToText(field(pbi, 'System.Description'));
  const criteria = htmlToText(
    field(pbi, 'Microsoft.VSTS.Common.AcceptanceCriteria'),
  );

  // Busca a Análise entre os filhos do PBI.
  const childIds = childIdsOf(pbi);

  let devAnalysis = '';
  let foundAnalise = false;
  if (childIds.length > 0) {
    const children = await Promise.all(
      childIds.map((id) => readWorkItem(pat, id)),
    );
    const analise = children.find(isAnalise);
    if (analise) {
      devAnalysis = htmlToText(field(analise, 'System.Description'));
      foundAnalise = true;
    }
  }

  return {
    title: field(pbi, 'System.Title'),
    userStory,
    criteria,
    devAnalysis,
    foundAnalise,
  };
}

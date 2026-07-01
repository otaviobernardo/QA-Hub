/**
 * Cliente do Azure DevOps via proxy (Cloudflare Worker).
 * O navegador não chama dev.azure.com direto (CORS) — manda para o Worker,
 * que repassa usando o PAT enviado no header. O PAT é do próprio QA.
 */

const PROXY_URL = import.meta.env.VITE_ADO_PROXY_URL as string | undefined;
const ORG = (import.meta.env.VITE_ADO_ORG as string) || 'selbettidev';
const PROJECT = (import.meta.env.VITE_ADO_PROJECT as string) || 'SHARE-4';
const API_VERSION = '7.1';

export type AzureErrorKind = 'config' | 'network' | 'auth' | 'http';

export class AzureError extends Error {
  readonly kind: AzureErrorKind;
  constructor(kind: AzureErrorKind, message: string) {
    super(message);
    this.kind = kind;
    this.name = 'AzureError';
  }
}

interface ProxyRequest {
  method: 'GET' | 'POST' | 'PATCH';
  path: string;
  query?: string;
  contentType?: string;
  body?: unknown;
}

async function callProxy<T = unknown>(pat: string, req: ProxyRequest): Promise<T> {
  if (!PROXY_URL) {
    throw new AzureError(
      'config',
      'Proxy do Azure DevOps não configurado (defina VITE_ADO_PROXY_URL no .env).',
    );
  }
  if (!pat) {
    throw new AzureError('auth', 'Configure seu PAT do Azure DevOps em Configurações.');
  }

  let response: Response;
  try {
    response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-ADO-PAT': pat },
      body: JSON.stringify(req),
    });
  } catch {
    throw new AzureError('network', 'Não foi possível conectar ao proxy do Azure DevOps.');
  }

  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 203) {
      // 203 = Azure devolve a página de login quando o PAT é inválido/expirado.
      throw new AzureError(
        'auth',
        'PAT inválido, expirado ou sem permissão (Work Items – Read & write).',
      );
    }
    const msg =
      (data as { message?: string; error?: string })?.message ||
      (data as { error?: string })?.error ||
      `Erro ${response.status} ao falar com o Azure DevOps.`;
    throw new AzureError('http', msg);
  }

  return data as T;
}

/* ------------------------------------------------------------------ */
/* Operações                                                          */
/* ------------------------------------------------------------------ */

export interface WorkItem {
  id: number;
  fields: Record<string, unknown>;
  relations?: { rel: string; url: string }[];
}

/** Lê um work item com todos os campos. */
export function readWorkItem(pat: string, id: number | string): Promise<WorkItem> {
  return callProxy<WorkItem>(pat, {
    method: 'GET',
    // Sem o projeto: o ID do work item é único na organização, então ler/editar
    // por ID funciona para qualquer projeto da org (ex.: QAs em outro projeto).
    path: `/${ORG}/_apis/wit/workitems/${id}`,
    query: `$expand=all&api-version=${API_VERSION}`,
  });
}

/** Atualiza o estado (mover: New → Committed → Done). */
export function updateState(
  pat: string,
  id: number | string,
  state: string,
): Promise<WorkItem> {
  return callProxy<WorkItem>(pat, {
    method: 'PATCH',
    // Sem o projeto: o ID do work item é único na organização, então ler/editar
    // por ID funciona para qualquer projeto da org (ex.: QAs em outro projeto).
    path: `/${ORG}/_apis/wit/workitems/${id}`,
    query: `api-version=${API_VERSION}`,
    contentType: 'application/json-patch+json',
    body: [{ op: 'add', path: '/fields/System.State', value: state }],
  });
}

/** Atualiza um ou mais campos do work item (ex.: System.Description). */
export function updateFields(
  pat: string,
  id: number | string,
  fields: Record<string, string | number>,
): Promise<WorkItem> {
  const ops = Object.entries(fields).map(([f, v]) => ({
    op: 'add',
    path: `/fields/${f}`,
    value: v,
  }));
  return callProxy<WorkItem>(pat, {
    method: 'PATCH',
    // Sem o projeto: o ID do work item é único na organização, então ler/editar
    // por ID funciona para qualquer projeto da org (ex.: QAs em outro projeto).
    path: `/${ORG}/_apis/wit/workitems/${id}`,
    query: `api-version=${API_VERSION}`,
    contentType: 'application/json-patch+json',
    body: ops,
  });
}

/** Adiciona um comentário (via campo System.History, vai para a discussão). */
export function addComment(
  pat: string,
  id: number | string,
  text: string,
): Promise<WorkItem> {
  return callProxy<WorkItem>(pat, {
    method: 'PATCH',
    // Sem o projeto: o ID do work item é único na organização, então ler/editar
    // por ID funciona para qualquer projeto da org (ex.: QAs em outro projeto).
    path: `/${ORG}/_apis/wit/workitems/${id}`,
    query: `api-version=${API_VERSION}`,
    contentType: 'application/json-patch+json',
    body: [{ op: 'add', path: '/fields/System.History', value: text }],
  });
}

export interface CreateWorkItemInput {
  type: string; // 'Bug' | 'Task' | ...
  title: string;
  areaPath?: string;
  iterationPath?: string;
  description?: string;
  /** Relações (ex.: filho de um PBI, ou relacionado a um bug). */
  relations?: { rel: string; url: string }[];
  /** Campos extras crus, se precisar. */
  extraFields?: Record<string, string | number>;
}

/** Cria um work item (ex.: Bug "BUG | ..." ou Task "Teste | ..."). */
export function createWorkItem(
  pat: string,
  input: CreateWorkItemInput,
): Promise<WorkItem> {
  const ops: { op: string; path: string; value: unknown }[] = [
    { op: 'add', path: '/fields/System.Title', value: input.title },
  ];
  if (input.areaPath)
    ops.push({ op: 'add', path: '/fields/System.AreaPath', value: input.areaPath });
  if (input.iterationPath)
    ops.push({
      op: 'add',
      path: '/fields/System.IterationPath',
      value: input.iterationPath,
    });
  if (input.description)
    ops.push({
      op: 'add',
      path: '/fields/System.Description',
      value: input.description,
    });
  for (const [field, value] of Object.entries(input.extraFields ?? {})) {
    ops.push({ op: 'add', path: `/fields/${field}`, value });
  }
  for (const rel of input.relations ?? []) {
    ops.push({ op: 'add', path: '/relations/-', value: { rel: rel.rel, url: rel.url } });
  }

  return callProxy<WorkItem>(pat, {
    method: 'POST',
    // O `$` antes do tipo é exigido pela API de criação.
    path: `/${ORG}/${PROJECT}/_apis/wit/workitems/$${input.type}`,
    query: `api-version=${API_VERSION}`,
    contentType: 'application/json-patch+json',
    body: ops,
  });
}

/** Lê os estados válidos de um tipo de work item (não chumbar no código). */
export interface WorkItemState {
  name: string;
  color?: string;
  category?: string;
}
export async function getStates(
  pat: string,
  type: string,
): Promise<WorkItemState[]> {
  const data = await callProxy<{ value: WorkItemState[] }>(pat, {
    method: 'GET',
    path: `/${ORG}/${PROJECT}/_apis/wit/workitemtypes/${type}/states`,
    query: `api-version=${API_VERSION}`,
  });
  return data.value ?? [];
}

/** Atalhos de leitura de campos comuns. */
export function field(item: WorkItem, name: string): string {
  const v = item.fields?.[name];
  return v == null ? '' : String(v);
}

/** URL de API de um work item — usada para montar relações (ex.: filho de um PBI). */
export function apiWorkItemUrl(id: number | string): string {
  return `https://dev.azure.com/${ORG}/_apis/wit/workItems/${id}`;
}

/** Relação "filho de": liga a Task criada ao PBI/US pai. */
export const REL_PARENT = 'System.LinkTypes.Hierarchy-Reverse';

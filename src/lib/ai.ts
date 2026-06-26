import type { TestCase } from '../types';
import { PROVIDER_MAP, type ProviderDef, type ProviderId } from './providers';

const ANTHROPIC_VERSION = '2023-06-01';

const VALID_TIPOS: TestCase['tipo'][] = [
  'positivo',
  'negativo',
  'edge',
  'regressao',
  'acessibilidade',
  'performance',
  'seguranca',
  'usabilidade',
  'integracao',
  'compatibilidade',
  'aceitacao',
  'smoke',
  'api',
  'exploratorio',
];

const PARSE_MSG =
  'A resposta da IA veio em um formato inválido. Tente gerar novamente.';
const NETWORK_MSG =
  'Não foi possível conectar à API. Verifique sua conexão e tente novamente.';

/** Categorias de erro do gerador, para mensagens específicas na UI. */
export type GenErrorKind =
  | 'invalid-key'
  | 'rate-limit'
  | 'network'
  | 'parse'
  | 'unknown';

export class TestCaseGenError extends Error {
  readonly kind: GenErrorKind;
  constructor(kind: GenErrorKind, message: string) {
    super(message);
    this.kind = kind;
    this.name = 'TestCaseGenError';
  }
}

export interface GenerateParams {
  provider: ProviderId;
  model: string;
  apiKey: string;
  userStory: string;
  acceptanceCriteria: string;
  devAnalysis?: string;
  tipos: TestCase['tipo'][];
}

/* ------------------------------------------------------------------ */
/* Prompt                                                             */
/* ------------------------------------------------------------------ */

function buildSystemPrompt(tipos: TestCase['tipo'][]): string {
  const lista = tipos.join(', ');
  const lines = [
    'Você é um QA sênior especializado em derivar casos de teste a partir de',
    'User Stories e Critérios de Aceite.',
    '',
    `Gere casos de teste cobrindo os tipos: ${lista}.`,
    '',
    'Responda APENAS com um array JSON válido. Sem markdown, sem cercas de',
    'código (```), sem texto antes ou depois. Cada item do array deve ter',
    'estes campos:',
    `- "tipo": um destes valores exatos: ${lista}`,
    '- "titulo": string curta e objetiva',
    '- "descricao": string descrevendo o objetivo do teste',
    '- "passos": array de strings, cada string é um passo',
    '- "resultado_esperado": string',
    '- "ca_coberto": string referenciando o critério de aceite coberto',
  ];

  if (tipos.includes('exploratorio')) {
    lines.push(
      '',
      'Para itens com "tipo" igual a "exploratorio", NÃO use passos roteirizados.',
      'Descreva uma sessão exploratória (charter) no formato Explore/Com/Para',
      'validar/E, preenchendo também estes campos:',
      '- "explore": o que será explorado (área, fluxo ou funcionalidade)',
      '- "com": recursos, dados, perfis ou ferramentas usados na exploração',
      '- "para_validar": o objetivo — que tipo de problema ou informação buscar',
      '- "e": observações adicionais ou pontos de atenção',
      'Nesses itens, "passos" deve ser um array vazio e "resultado_esperado" pode',
      'descrever o critério de sucesso geral da sessão.',
    );
  }

  lines.push('', 'Não use comentários no JSON.');
  return lines.join('\n');
}

function buildUserContent(
  userStory: string,
  criteria: string,
  devAnalysis?: string,
): string {
  const parts = ['User Story:', userStory, '', 'Critérios de Aceite:', criteria];
  if (devAnalysis && devAnalysis.trim()) {
    parts.push('', 'Análise do Dev:', devAnalysis.trim());
  }
  return parts.join('\n');
}

/* ------------------------------------------------------------------ */
/* Parsing                                                            */
/* ------------------------------------------------------------------ */

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (typeof value === 'string' && value.trim()) return [value];
  return [];
}

function normalizeCase(raw: unknown): TestCase | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const tipo = VALID_TIPOS.includes(o.tipo as TestCase['tipo'])
    ? (o.tipo as TestCase['tipo'])
    : 'positivo';
  const optStr = (v: unknown): string | undefined =>
    typeof v === 'string' && v.trim() ? v : undefined;
  return {
    tipo,
    titulo: typeof o.titulo === 'string' ? o.titulo : '',
    descricao: typeof o.descricao === 'string' ? o.descricao : '',
    passos: asStringArray(o.passos),
    resultado_esperado:
      typeof o.resultado_esperado === 'string' ? o.resultado_esperado : '',
    ca_coberto: typeof o.ca_coberto === 'string' ? o.ca_coberto : '',
    explore: optStr(o.explore),
    com: optStr(o.com),
    para_validar: optStr(o.para_validar),
    e: optStr(o.e),
  };
}

/** Faz o parse seguro do JSON retornado pela IA (tolerante a markdown/prosa). */
function safeParse(text: string): TestCase[] {
  let cleaned = text.trim();

  if (cleaned.startsWith('```')) {
    cleaned = cleaned
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/, '')
      .trim();
  }

  // Alguns modelos retornam { "casos": [...] } — extrai o primeiro array.
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new TestCaseGenError('parse', PARSE_MSG);
  }

  if (!Array.isArray(parsed)) {
    throw new TestCaseGenError('parse', PARSE_MSG);
  }

  const cases = parsed
    .map(normalizeCase)
    .filter((c): c is TestCase => c !== null);

  if (cases.length === 0) {
    throw new TestCaseGenError('parse', PARSE_MSG);
  }

  return cases;
}

/* ------------------------------------------------------------------ */
/* HTTP helpers (compartilhados entre provedores)                     */
/* ------------------------------------------------------------------ */

async function doFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new TestCaseGenError('network', NETWORK_MSG);
  }
}

/** Lança erro tipado a partir de uma resposta HTTP não-ok (formato comum a todos). */
async function throwForStatus(response: Response): Promise<never> {
  if (response.status === 401 || response.status === 403) {
    throw new TestCaseGenError(
      'invalid-key',
      'Chave de API inválida. Verifique em Configurações se ela foi copiada corretamente.',
    );
  }
  if (response.status === 429) {
    throw new TestCaseGenError(
      'rate-limit',
      'Você atingiu o limite de uso da sua chave. Aguarde alguns instantes ou verifique seu plano no provedor.',
    );
  }
  let detail = '';
  try {
    const body = await response.json();
    const msg = (body as { error?: { message?: unknown } })?.error?.message;
    if (typeof msg === 'string') detail = msg;
  } catch {
    // corpo não-JSON
  }
  throw new TestCaseGenError(
    'unknown',
    detail
      ? `Erro da API (${response.status}): ${detail}`
      : 'Erro inesperado ao gerar casos de teste. Tente novamente.',
  );
}

/* ------------------------------------------------------------------ */
/* Adaptadores por provedor                                           */
/* ------------------------------------------------------------------ */

async function callAnthropic(
  apiKey: string,
  model: string,
  system: string,
  userContent: string,
): Promise<string> {
  const response = await doFetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8000,
      system,
      messages: [{ role: 'user', content: userContent }],
    }),
  });
  if (!response.ok) await throwForStatus(response);

  const data = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  return (data.content ?? [])
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text as string)
    .join('');
}

async function callOpenAICompatible(
  def: ProviderDef,
  apiKey: string,
  model: string,
  system: string,
  userContent: string,
): Promise<string> {
  const response = await doFetch(`${def.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 8000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userContent },
      ],
    }),
  });
  if (!response.ok) await throwForStatus(response);

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? '';
}

async function callGemini(
  apiKey: string,
  model: string,
  system: string,
  userContent: string,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await doFetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: userContent }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: 8000,
      },
    }),
  });
  if (!response.ok) await throwForStatus(response);

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? '')
    .join('');
}

/* ------------------------------------------------------------------ */
/* Entrada pública                                                    */
/* ------------------------------------------------------------------ */

/**
 * Gera casos de teste chamando o provedor de IA escolhido, direto do navegador.
 * A chave nunca é logada. Lança TestCaseGenError com kind específico em falhas.
 */
export async function generateTestCases(
  params: GenerateParams,
): Promise<TestCase[]> {
  const { provider, model, apiKey, userStory, acceptanceCriteria, devAnalysis, tipos } =
    params;

  const def = PROVIDER_MAP[provider];
  if (!def) {
    throw new TestCaseGenError('unknown', 'Provedor de IA desconhecido.');
  }

  const system = buildSystemPrompt(tipos);
  const userContent = buildUserContent(userStory, acceptanceCriteria, devAnalysis);

  let text: string;
  switch (def.kind) {
    case 'anthropic':
      text = await callAnthropic(apiKey, model, system, userContent);
      break;
    case 'gemini':
      text = await callGemini(apiKey, model, system, userContent);
      break;
    case 'openai':
      text = await callOpenAICompatible(def, apiKey, model, system, userContent);
      break;
  }

  return safeParse(text);
}

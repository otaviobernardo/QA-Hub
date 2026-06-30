/**
 * QA Hub — proxy de relay para o Azure DevOps.
 *
 * Resolve o CORS: o navegador não consegue chamar dev.azure.com diretamente.
 * O Worker NÃO guarda nada — apenas repassa a requisição para o Azure DevOps
 * usando o PAT que o app envia no header `X-ADO-PAT` (o QA usa o próprio PAT).
 *
 * Segurança:
 * - O host de destino é fixo (dev.azure.com) → sem risco de SSRF.
 * - Só aceita chamadas das origens listadas em ALLOWED_ORIGINS.
 * - Sem um PAT válido, o Azure recusa — o Worker não dá acesso a nada por si só.
 */

export interface Env {
  /** Origens permitidas, separadas por vírgula (ex.: dev local + Vercel). */
  ALLOWED_ORIGINS: string;
}

const ADO_BASE = 'https://dev.azure.com';

interface ProxyPayload {
  method?: string;
  path?: string; // ex.: /selbettidev/SHARE-4/_apis/wit/workitems/153148
  query?: string; // ex.: api-version=7.1
  contentType?: string; // ex.: application/json-patch+json
  body?: unknown;
}

function cors(origin: string, allowed: string[]): Record<string, string> {
  const ok = allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-ADO-PAT',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(
  data: unknown,
  status: number,
  headers: Record<string, string>,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const allowed = (env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const origin = request.headers.get('Origin') ?? '';
    const headers = cors(origin, allowed);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }
    if (!allowed.includes(origin)) {
      return json({ error: 'Origem não permitida.' }, 403, headers);
    }
    if (request.method !== 'POST') {
      return json({ error: 'Método não permitido.' }, 405, headers);
    }

    const pat = request.headers.get('X-ADO-PAT');
    if (!pat) {
      return json({ error: 'PAT do Azure DevOps ausente.' }, 401, headers);
    }

    let payload: ProxyPayload;
    try {
      payload = (await request.json()) as ProxyPayload;
    } catch {
      return json({ error: 'Corpo JSON inválido.' }, 400, headers);
    }

    const method = (payload.method ?? 'GET').toUpperCase();
    const path = payload.path ?? '';
    if (!path.startsWith('/')) {
      return json({ error: 'path inválido (deve começar com /).' }, 400, headers);
    }

    const url = `${ADO_BASE}${path}${payload.query ? `?${payload.query}` : ''}`;
    const init: RequestInit = {
      method,
      headers: {
        Authorization: 'Basic ' + btoa(':' + pat),
        Accept: 'application/json',
        ...(payload.contentType ? { 'Content-Type': payload.contentType } : {}),
      },
    };
    if (payload.body !== undefined && method !== 'GET') {
      init.body = JSON.stringify(payload.body);
    }

    let adoRes: Response;
    try {
      adoRes = await fetch(url, init);
    } catch {
      return json({ error: 'Falha ao conectar ao Azure DevOps.' }, 502, headers);
    }

    const text = await adoRes.text();
    return new Response(text, {
      status: adoRes.status,
      headers: {
        ...headers,
        'Content-Type':
          adoRes.headers.get('Content-Type') ?? 'application/json',
      },
    });
  },
};

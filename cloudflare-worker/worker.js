// QA Hub — proxy de relay para o Azure DevOps.
// Formato Service Worker, JavaScript puro — cole ESTE arquivo inteiro no editor
// do Cloudflare Worker (funciona no editor padrão do painel).
//
// 1) Edite a lista ALLOWED_ORIGINS abaixo com a URL do seu app na Vercel.
// 2) Deploy.

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'https://SEU-APP.vercel.app',
];

const ADO_BASE = 'https://dev.azure.com';

addEventListener('fetch', (event) => {
  event.respondWith(handle(event.request));
});

function cors(origin) {
  const ok = ALLOWED_ORIGINS.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-ADO-PAT',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status: status,
    headers: Object.assign({}, headers, { 'Content-Type': 'application/json' }),
  });
}

async function handle(request) {
  const origin = request.headers.get('Origin') || '';
  const headers = cors(origin);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: headers });
  }
  if (!ALLOWED_ORIGINS.includes(origin)) {
    return json({ error: 'Origem não permitida.' }, 403, headers);
  }
  if (request.method !== 'POST') {
    return json({ error: 'Método não permitido.' }, 405, headers);
  }

  const pat = request.headers.get('X-ADO-PAT');
  if (!pat) {
    return json({ error: 'PAT do Azure DevOps ausente.' }, 401, headers);
  }

  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return json({ error: 'Corpo JSON inválido.' }, 400, headers);
  }

  const method = (payload.method || 'GET').toUpperCase();
  const path = payload.path || '';
  if (path.charAt(0) !== '/') {
    return json({ error: 'path inválido (deve começar com /).' }, 400, headers);
  }

  const url = ADO_BASE + path + (payload.query ? '?' + payload.query : '');
  const init = {
    method: method,
    headers: {
      Authorization: 'Basic ' + btoa(':' + pat),
      Accept: 'application/json',
    },
  };
  if (payload.contentType) {
    init.headers['Content-Type'] = payload.contentType;
  }
  if (payload.body !== undefined && method !== 'GET') {
    init.body = JSON.stringify(payload.body);
  }

  let adoRes;
  try {
    adoRes = await fetch(url, init);
  } catch (e) {
    return json({ error: 'Falha ao conectar ao Azure DevOps.' }, 502, headers);
  }

  const text = await adoRes.text();
  return new Response(text, {
    status: adoRes.status,
    headers: Object.assign({}, headers, {
      'Content-Type': adoRes.headers.get('Content-Type') || 'application/json',
    }),
  });
}

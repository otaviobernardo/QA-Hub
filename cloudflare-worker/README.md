# QA Hub — Proxy Azure DevOps (Cloudflare Worker)

Proxy de relay que resolve o CORS entre o QA Hub (navegador) e o Azure DevOps.
Ele **não guarda nada**: repassa a requisição usando o PAT que o app envia no
header `X-ADO-PAT`.

## O que ele faz

`POST` para a URL do Worker com este corpo JSON:

```json
{
  "method": "GET" | "POST" | "PATCH",
  "path": "/selbettidev/SHARE-4/_apis/wit/workitems/153148",
  "query": "api-version=7.1",
  "contentType": "application/json-patch+json",
  "body": [ { "op": "add", "path": "/fields/System.State", "value": "Committed" } ]
}
```

Headers: `X-ADO-PAT: <pat-do-qa>`. O Worker chama
`https://dev.azure.com{path}?{query}` com `Authorization: Basic base64(":"+PAT)`
e devolve a resposta do Azure (com os headers de CORS).

---

## Deploy — Opção A: pelo painel (sem instalar nada) ✅ recomendado p/ começar

1. Crie conta grátis em **https://dash.cloudflare.com** (não pede cartão).
2. Menu lateral → **Workers & Pages** → **Create** → **Create Worker**.
3. Dê um nome (ex.: `qa-hub-ado-proxy`) → **Deploy** (cria um "hello world").
4. **Edit code** → apague tudo → cole o conteúdo de [`src/index.ts`](src/index.ts) →
   **Deploy**.
5. Aba **Settings** → **Variables and Secrets** → adicione a variável:
   - Nome: `ALLOWED_ORIGINS`
   - Valor: `http://localhost:5173,https://SEU-APP.vercel.app`
   - **Deploy** de novo.
6. A URL do Worker fica algo como
   `https://qa-hub-ado-proxy.SEU-SUBDOMINIO.workers.dev` — copie. É ela que o
   app vai usar (variável `VITE_ADO_PROXY_URL` no `.env`).

> O editor do painel aceita TypeScript, mas se reclamar, cole a versão `.js`
> (é o mesmo arquivo sem as anotações de tipo — peça que eu gero).

## Deploy — Opção B: Wrangler CLI (para quem prefere terminal)

```bash
npm install -g wrangler      # ou: npx wrangler ...
cd cloudflare-worker
wrangler login               # abre o navegador para autorizar
# ajuste ALLOWED_ORIGINS no wrangler.toml
wrangler deploy
```

A URL publicada aparece no final do `wrangler deploy`.

---

## Limites do plano grátis

- **100.000 requisições/dia** e 10ms de CPU por requisição — muito acima do uso
  de um time de QA. **Sem cartão, permite uso comercial.**

## Segurança

- Host de destino fixo (`dev.azure.com`) → sem SSRF.
- Só aceita as origens em `ALLOWED_ORIGINS`.
- Sem PAT válido, o Azure recusa — o proxy não concede acesso por si só.
- Hardening futuro (opcional): validar o token do Firebase Auth no Worker.

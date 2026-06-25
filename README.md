# QA Hub — Selbetti

Ferramenta interna do time de QA da Selbetti. Reúne três funcionalidades:

1. **Gerador de casos de teste com IA** — cole a User Story, os Critérios de Aceite e a Análise do Dev, escolha os tipos de teste e o provedor de IA, e os casos são gerados em formato estruturado.
2. **Dashboard de bugs** — registro, filtros, métricas, observações de sprint e export CSV.
3. **Base de conhecimento** — referência rápida de tipos de teste, conceitos, boas práticas e metodologias de QA.

Tema claro/escuro incluído.

## Stack

React 18 + TypeScript + Vite · Tailwind CSS · Firebase (Auth + Firestore) · múltiplos provedores de IA (Anthropic, Google Gemini, OpenAI, Groq, Mistral, DeepSeek, xAI, OpenRouter).

## Rodando localmente

Requer **Node 18+**.

```bash
npm install
cp .env.example .env   # preencha com as credenciais do Firebase
npm run dev
```

A app sobe em `http://localhost:5173`.

### Configuração necessária

- **`.env`** — copie de `.env.example` e preencha com as credenciais de um projeto Firebase (Authentication com e-mail/senha + Firestore habilitados). Sem isso, login e dados não funcionam.
- **Regras do Firestore** — aplique o conteúdo de `firestore.rules` no projeto Firebase.
- **Conta de QA** — criada manualmente no Firebase Console (não há cadastro público).
- **Chave de IA** — cada QA configura a sua em **Configurações**, no provedor que preferir (Gemini e Groq têm tier gratuito). A chave fica só no perfil do usuário no Firestore.

## Scripts

| Comando | Ação |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run preview` | Servir o build localmente |

## Status

Em desenvolvimento — versão para avaliação interna. Veja `PLAN.md` para o plano completo de implementação.

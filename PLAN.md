# QA Hub — Selbetti Tecnologia
## Plano de implementação

---

## O que é

Ferramenta interna para o time de QA da Selbetti. Centraliza três funcionalidades:

1. **Gerador de casos de teste com IA** — o QA cola a User Story e os Critérios de Aceite, escolhe os tipos de teste e a IA gera os casos estruturados
2. **Dashboard de bugs** — registro, acompanhamento e visualização de bugs por sprint, módulo, severidade e responsável
3. **Base de conhecimento** — referência rápida sobre tipos de teste, conceitos de QA, boas práticas e metodologias

Há também uma seção de **observações de sprint** dentro do Dashboard, para registrar alinhamentos com PM e DEV que fujam do que está descrito nas USs (ex: "Alinhado com PM que critério X da US Y não será implementado da forma descrita porque...").

---

## Para quem

Time de QA da Selbetti — entre 4 e 10 pessoas. Cada QA tem seu próprio login. Os bugs são visíveis para todos os QAs autenticados, mas cada um pode filtrar para ver apenas os seus. A chave de API da Anthropic é individual — cada QA configura a sua própria no perfil.

---

## Decisões já tomadas

- **Sem cadastro público** — contas criadas manualmente pelo admin no Firebase Console
- **Bugs visíveis para todos** os QAs autenticados, com toggle "ver apenas os meus / ver todos"
- **Chave Anthropic por usuário** — salva no Firestore em `users/{uid}/apiKey`, não compartilhada
- **Export CSV** é para apresentação em retro, daily e refinamento — não precisa seguir formato do Azure DevOps
- **IDs de bugs** gerados com UUID, não índice sequencial
- **Sem integração direta com Azure DevOps** por enquanto

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Estilo | Tailwind CSS |
| Auth | Firebase Authentication (e-mail + senha) |
| Banco de dados | Firestore (Firebase) |
| Deploy | Vercel |
| IA | Anthropic API — `claude-sonnet-4-6` |

---

## Estrutura de pastas

```
qa-hub/
├── public/
├── src/
│   ├── components/
│   │   ├── BugModal.tsx          # modal criar/editar/visualizar bug
│   │   ├── BugTable.tsx          # tabela de bugs com filtros e paginação
│   │   ├── Dashboard.tsx         # aba dashboard — métricas + gráficos + sprint notes
│   │   ├── KnowledgeBase.tsx     # aba base de conhecimento
│   │   ├── TestCaseGenerator.tsx # aba gerador de casos de teste
│   │   ├── SprintNotes.tsx       # seção de observações de sprint (dentro do Dashboard)
│   │   ├── Header.tsx            # header com nome do usuário, settings e logout
│   │   └── ProtectedRoute.tsx    # redireciona para login se não autenticado
│   ├── pages/
│   │   ├── Login.tsx             # tela de login
│   │   └── Settings.tsx          # tela de configurações — chave de API + perfil
│   ├── lib/
│   │   ├── firebase.ts           # inicialização do Firebase
│   │   ├── auth.ts               # funções de autenticação
│   │   └── db.ts                 # funções de acesso ao Firestore
│   ├── types/
│   │   └── index.ts              # tipos TypeScript globais
│   ├── App.tsx
│   └── main.tsx
├── .env                          # variáveis de ambiente Firebase (não commitar)
├── .env.example                  # template das variáveis sem os valores
├── firebase.json
├── firestore.rules
└── vite.config.ts
```

---

## Tipos TypeScript (`src/types/index.ts`)

```typescript
export type Severity = 'Crítico' | 'Alto' | 'Médio' | 'Baixo';
export type Priority = 'Alta' | 'Média' | 'Baixa';
export type BugStatus = 'Aberto' | 'Em andamento' | 'Resolvido' | 'Fechado';
export type Environment = 'Dev' | 'Homologação' | 'Produção';

export interface Bug {
  id: string;                  // UUID gerado no cliente
  title: string;
  module: string;
  sprint: string;
  severity: Severity;
  priority: Priority;
  environment: Environment;
  status: BugStatus;
  description: string;
  evidence: string;
  assignee: string;            // nome ou uid do QA responsável
  createdBy: string;           // uid do usuário que criou
  createdAt: Date;
  updatedAt: Date;
}

export interface SprintNote {
  id: string;
  sprint: string;
  content: string;             // texto livre do alinhamento
  createdBy: string;           // uid do QA que registrou
  createdByName: string;       // nome para exibição
  createdAt: Date;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  apiKey?: string;             // chave Anthropic — salva criptografada
}

export interface TestCase {
  tipo: 'positivo' | 'negativo' | 'edge' | 'regressao' | 'acessibilidade' | 'performance';
  titulo: string;
  descricao: string;
  passos: string[];
  resultado_esperado: string;
  ca_coberto: string;
}
```

---

## Regras do Firestore (`firestore.rules`)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Perfil do usuário — só o próprio usuário lê e escreve
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    // Bugs — qualquer QA autenticado lê; só o criador edita e deleta
    match /bugs/{bugId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null
        && request.auth.uid == resource.data.createdBy;
    }

    // Observações de sprint — qualquer QA autenticado lê; só o criador edita e deleta
    match /sprintNotes/{noteId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null
        && request.auth.uid == resource.data.createdBy;
    }
  }
}
```

---

## Variáveis de ambiente (`.env.example`)

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

---

## Fases de implementação

### Fase 1 — Setup do projeto e infraestrutura
**Estimativa: ~3–4h | Pré-requisito: nenhum**

- [ ] Criar projeto com `npm create vite@latest` — React + TypeScript
- [ ] Instalar dependências: `firebase`, `react-router-dom`, `tailwindcss`, `uuid`
- [ ] Configurar Tailwind CSS
- [ ] Criar projeto no Firebase Console (ativar Authentication com e-mail/senha e Firestore)
- [ ] Criar `src/lib/firebase.ts` com variáveis de ambiente
- [ ] Criar `src/types/index.ts` com todos os tipos definidos acima
- [ ] Criar `.env` local e `.env.example` no repositório
- [ ] Criar `firestore.rules` conforme definido acima
- [ ] Deploy inicial no Vercel (projeto vazio) para validar o pipeline

**Entrega:** app rodando no ar com Firebase conectado, sem nenhuma feature ainda.

---

### Fase 2 — Autenticação e perfil do usuário
**Estimativa: ~4–6h | Pré-requisito: fase 1 concluída**

- [ ] `pages/Login.tsx` — tela de login com e-mail e senha (Firebase Auth)
- [ ] `ProtectedRoute.tsx` — redireciona para `/login` se não autenticado
- [ ] `Header.tsx` — nome do usuário logado, ícone de settings, botão logout
- [ ] `pages/Settings.tsx` — campo para inserir/atualizar chave Anthropic, salva em `users/{uid}/apiKey` no Firestore
- [ ] Indicador visual no header se a chave de API não estiver configurada (ex: ícone de aviso com tooltip "Configure sua chave Anthropic em Configurações")
- [ ] `src/lib/auth.ts` — funções: `signIn`, `signOut`, `getCurrentUser`
- [ ] `src/lib/db.ts` — funções: `getUserProfile`, `updateApiKey`
- [ ] Configurar React Router com rotas `/login`, `/settings` e `/*` (protegida)

**Entrega:** QA consegue fazer login, ver seu nome no header, configurar chave de API e fazer logout.

---

### Fase 3 — Dashboard de bugs e observações de sprint
**Estimativa: ~8–10h | Pré-requisito: fase 2 concluída**

> Referência visual: usar o arquivo `qa-hub-selbetti.html` como base para manter o estilo atual do dashboard.

- [ ] `Dashboard.tsx` — estrutura principal com sub-abas "Visão geral" e "Lista de bugs"
- [ ] Migrar bugs de exemplo do HTML original para Firestore como seed inicial
- [ ] `db.ts` — funções: `getBugs`, `createBug`, `updateBug`, `deleteBug`, `getSprintNotes`, `createSprintNote`, `deleteSprintNote`
- [ ] `BugTable.tsx` — tabela com filtros (status, prioridade, busca), toggle "ver apenas os meus / ver todos", paginação (20 por página)
- [ ] `BugModal.tsx` — três modos: visualização (leitura), criação e edição. Campo `assignee` adicionado. Validação visual nos campos obrigatórios (highlight vermelho, sem alert())
- [ ] Correção de IDs: usar `uuid` para gerar IDs únicos ao criar bug
- [ ] Métricas e gráficos da visão geral — manter lógica atual, adaptar para dados do Firestore
- [ ] Filtros globais (sprint, severidade, módulo, ambiente) funcionando com dados reais
- [ ] `SprintNotes.tsx` — seção dentro da aba Dashboard para registrar observações por sprint. Cada nota tem: sprint selecionada, texto livre, nome do QA e data. Qualquer QA pode ler todas as notas; só o criador pode editar ou deletar a sua.
- [ ] Export CSV funcionando — colunas: ID, Título, Módulo, Severidade, Prioridade, Ambiente, Status, Sprint, Responsável, Descrição, Evidência

**Entrega:** hub utilizável pelo time no dia a dia — bugs persistidos, visíveis entre QAs, observações de sprint registradas.

---

### Fase 4 — Gerador de IA e base de conhecimento
**Estimativa: ~4–5h | Pré-requisito: fase 2 concluída (precisa da chave de API do usuário)**

- [ ] `TestCaseGenerator.tsx` — busca a chave Anthropic do usuário logado no Firestore antes de cada chamada
- [ ] Mensagens de erro específicas para cada cenário:
  - Chave não configurada → "Você ainda não configurou sua chave Anthropic. Acesse Configurações para adicioná-la."
  - Chave inválida (401) → "Chave de API inválida. Verifique em Configurações se ela foi copiada corretamente."
  - Limite de tokens (429) → "Você atingiu o limite de uso da sua chave. Aguarde alguns instantes ou verifique seu plano na Anthropic."
  - Erro de rede → "Não foi possível conectar à API. Verifique sua conexão e tente novamente."
- [ ] `copiarCasos()` — copia todos os casos gerados para o clipboard, com feedback visual (botão muda para "Copiado!" por 2 segundos)
- [ ] Botão "Exportar CSV" nos casos gerados — colunas: Tipo, Título, Descrição, Passos, Resultado esperado, CA coberto
- [ ] `KnowledgeBase.tsx` — migrar conteúdo atual do HTML, manter filtro por categoria e busca
- [ ] Revisão geral de dark mode e responsividade mobile

**Entrega:** hub completo. Gerador funcionando com chave individual, erros claros, base de conhecimento funcional.

---

## Referência visual

O arquivo `qa-hub-selbetti.html` na raiz do projeto é a referência visual de todas as telas. Manter:
- Paleta de cores (verde `#3CB54A`, laranja `#F47920`, roxo `#534AB7`)
- Tipagem e espaçamentos gerais
- Estrutura de navegação com 3 abas principais

Não é necessário replicar pixel a pixel — o objetivo é manter a identidade visual reconhecível para os QAs que já usam o HTML atual.

---

## Prompts para o Claude Code (ordem de uso)

**Fase 1:**
```
Leia o PLAN.md. Configure o projeto conforme a fase 1:
Vite + React + TypeScript + TailwindCSS + Firebase SDK.
Crie a estrutura de pastas definida no plano, o arquivo
firebase.ts com variáveis de ambiente, e os tipos TypeScript
em src/types/index.ts. Não implemente nenhuma feature ainda.
```

**Fase 2:**
```
Leia o PLAN.md. Implemente a fase 2 completa: tela de login
com e-mail e senha usando Firebase Auth, proteção de rotas,
Header com nome do usuário e logout, tela de configurações
com campo para chave Anthropic salva no Firestore em
users/{uid}/apiKey, e indicador visual se a chave não estiver
configurada.
```

**Fase 3:**
```
Leia o PLAN.md. Implemente a fase 3: dashboard de bugs com
Firestore, usando o arquivo qa-hub-selbetti.html como referência
visual. Inclua campo assignee, toggle meus/todos, modal com
modo de visualização separado da edição, validação visual nos
campos obrigatórios, IDs com UUID, paginação de 20 por página,
seção de observações de sprint e export CSV.
```

**Fase 4:**
```
Leia o PLAN.md. Implemente a fase 4: gerador de casos de teste
buscando a chave Anthropic do usuário logado no Firestore,
mensagens de erro específicas para cada falha da API conforme
descrito no plano, função copiarCasos() com feedback visual,
export CSV dos casos gerados, e migração da base de conhecimento
do qa-hub-selbetti.html.
```

---

## Observações para manutenção futura

- Para adicionar um novo QA: criar conta no Firebase Console > Authentication > Add user
- Para remover um QA: desativar ou deletar a conta no Firebase Console
- A chave Anthropic de cada usuário fica em `Firestore > users > {uid} > apiKey`
- Os bugs ficam na coleção `bugs` e as notas de sprint em `sprintNotes`
- O free tier do Firebase (Spark plan) suporta tranquilamente o volume desse time. Monitorar em Firebase Console > Usage se o time crescer muito.

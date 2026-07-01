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
  vm?: string;                 // VM usada (somente quando environment === 'Homologação')
  // Origem: quando o bug nasce de um caso de teste que falhou na execução.
  linkedCaseId?: string;       // id do SavedTestCase de origem
  linkedCaseTitulo?: string;   // título do caso (para exibição)
  azureCardId?: string;        // ID da US (PBI) de origem
  createdBy: string;           // uid do usuário que criou
  createdByName: string;       // nome de exibição do criador
  createdAt: Date;
  updatedAt: Date;
}

export type NoteVisibility = 'public' | 'private';

export type TeamNoteCategory = 'modulo' | 'sistema' | 'processo' | 'outro';

/** Conhecimento operacional compartilhado entre os QAs (como testar X, configurar Y). */
export interface TeamNote {
  id: string;
  title: string;
  category: TeamNoteCategory;
  content: string;
  createdBy: string;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SprintNote {
  id: string;
  sprint: string;
  content: string;             // texto livre do alinhamento
  visibility: NoteVisibility;  // 'public' = todos os QAs | 'private' = só o criador
  createdBy: string;           // uid do QA que registrou
  createdByName: string;       // nome para exibição
  createdAt: Date;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  apiKey?: string;             // legado: chave Anthropic única (mantido por compat.)
  apiKeys?: Record<string, string>; // chaves por provedor de IA (anthropic, openai, gemini, ...)
  azurePat?: string;           // Personal Access Token do Azure DevOps (Work Items R/W)
}

export type SavedCaseStatus = 'pendente' | 'pass' | 'fail';

/** Caso de teste salvo no repositório (com metadados de execução). */
export interface SavedTestCase extends TestCase {
  id: string;
  squad: string;               // Squad/time (nó do Area Path do Azure) — nível mais alto
  sprint: string;              // Sprint (Iteration Path do Azure)
  grupo: string;               // Feature: título do conjunto (ID + PBI) sob o qual foi salvo
  modulo: string;
  status: SavedCaseStatus;
  tempoMs: number;             // tempo de execução registrado (cronômetro)
  azureCardId?: string;        // ID do PBI de origem (quando importado do Azure)
  bugId?: string;              // bug aberto a partir deste caso (quando falhou)
  createdBy: string;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestCase {
  tipo:
    | 'positivo'
    | 'negativo'
    | 'edge'
    | 'regressao'
    | 'acessibilidade'
    | 'performance'
    | 'seguranca'
    | 'usabilidade'
    | 'integracao'
    | 'compatibilidade'
    | 'aceitacao'
    | 'smoke'
    | 'api'
    | 'exploratorio';
  titulo: string;
  descricao: string;
  passos: string[];
  resultado_esperado: string;
  ca_coberto: string;
  // Charter de teste exploratório — preenchido quando tipo === 'exploratorio'.
  explore?: string;       // o que explorar
  com?: string;           // recursos, dados, ferramentas
  para_validar?: string;  // objetivo / o que descobrir
  e?: string;             // observações adicionais
}

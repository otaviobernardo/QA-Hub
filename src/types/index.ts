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

/** Provedores de IA suportados pelo gerador de casos de teste. */

export type ProviderKind = 'anthropic' | 'openai' | 'gemini';

export type ProviderId =
  | 'anthropic'
  | 'openai'
  | 'gemini'
  | 'groq'
  | 'mistral'
  | 'deepseek'
  | 'xai'
  | 'openrouter';

export interface ModelOption {
  id: string;
  label: string;
}

export interface ProviderDef {
  id: ProviderId;
  label: string;
  /** Formato da API: define qual adaptador é usado. */
  kind: ProviderKind;
  /** Base URL — apenas para provedores compatíveis com a API da OpenAI. */
  baseUrl?: string;
  models: ModelOption[];
  /** Possui tier gratuito relevante (exibido como dica na UI). */
  freeTier?: boolean;
  /** Onde obter a chave. */
  keysUrl: string;
  /** Dica do formato da chave (placeholder do input). */
  keyHint: string;
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    kind: 'anthropic',
    models: [
      { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
      { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 (mais barato)' },
      { id: 'claude-opus-4-8', label: 'Claude Opus 4.8 (mais capaz)' },
    ],
    keysUrl: 'https://console.anthropic.com/settings/keys',
    keyHint: 'sk-ant-...',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    kind: 'gemini',
    freeTier: true,
    models: [
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (gratuito)' },
      { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
      { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    ],
    keysUrl: 'https://aistudio.google.com/apikey',
    keyHint: 'AIza...',
  },
  {
    id: 'openai',
    label: 'OpenAI (GPT)',
    kind: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-4o-mini', label: 'GPT-4o mini (barato)' },
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
    ],
    keysUrl: 'https://platform.openai.com/api-keys',
    keyHint: 'sk-...',
  },
  {
    id: 'groq',
    label: 'Groq',
    kind: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    freeTier: true,
    models: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (gratuito)' },
      { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (rápido)' },
    ],
    keysUrl: 'https://console.groq.com/keys',
    keyHint: 'gsk_...',
  },
  {
    id: 'mistral',
    label: 'Mistral',
    kind: 'openai',
    baseUrl: 'https://api.mistral.ai/v1',
    freeTier: true,
    models: [
      { id: 'mistral-small-latest', label: 'Mistral Small (gratuito)' },
      { id: 'mistral-large-latest', label: 'Mistral Large' },
    ],
    keysUrl: 'https://console.mistral.ai/api-keys',
    keyHint: '...',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    kind: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    models: [{ id: 'deepseek-chat', label: 'DeepSeek Chat (barato)' }],
    keysUrl: 'https://platform.deepseek.com/api_keys',
    keyHint: 'sk-...',
  },
  {
    id: 'xai',
    label: 'xAI (Grok)',
    kind: 'openai',
    baseUrl: 'https://api.x.ai/v1',
    models: [
      { id: 'grok-2-latest', label: 'Grok 2' },
      { id: 'grok-beta', label: 'Grok Beta' },
    ],
    keysUrl: 'https://console.x.ai',
    keyHint: 'xai-...',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter (vários modelos)',
    kind: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    freeTier: true,
    models: [
      {
        id: 'meta-llama/llama-3.3-70b-instruct:free',
        label: 'Llama 3.3 70B (gratuito)',
      },
      {
        id: 'google/gemini-2.0-flash-exp:free',
        label: 'Gemini 2.0 Flash (gratuito)',
      },
      { id: 'deepseek/deepseek-chat', label: 'DeepSeek Chat' },
    ],
    keysUrl: 'https://openrouter.ai/keys',
    keyHint: 'sk-or-...',
  },
];

export const PROVIDER_MAP: Record<ProviderId, ProviderDef> = Object.fromEntries(
  PROVIDERS.map((p) => [p.id, p]),
) as Record<ProviderId, ProviderDef>;

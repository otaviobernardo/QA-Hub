import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { TestCase } from '../types';
import type { ProviderId } from '../lib/providers';

export type CaseStatus = 'pass' | 'fail';
type Tipo = TestCase['tipo'];

const STORAGE_KEY = 'qa-hub-generator';

interface PersistedState {
  userStory: string;
  criteria: string;
  devAnalysis: string;
  tipos: Tipo[];
  provider: ProviderId | '';
  model: string;
  cases: TestCase[] | null;
  statuses: Record<number, CaseStatus>;
}

const INITIAL: PersistedState = {
  userStory: '',
  criteria: '',
  devAnalysis: '',
  tipos: ['positivo', 'negativo'],
  provider: '',
  model: '',
  cases: null,
  statuses: {},
};

function loadState(): PersistedState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      return { ...INITIAL, ...parsed };
    }
  } catch {
    // sessionStorage indisponível ou JSON inválido — usa o estado inicial.
  }
  return INITIAL;
}

interface GeneratorContextValue {
  userStory: string;
  setUserStory: (v: string) => void;
  criteria: string;
  setCriteria: (v: string) => void;
  devAnalysis: string;
  setDevAnalysis: (v: string) => void;
  tipos: Tipo[];
  toggleTipo: (t: Tipo) => void;
  provider: ProviderId | '';
  setProvider: (v: ProviderId | '') => void;
  model: string;
  setModel: (v: string) => void;
  cases: TestCase[] | null;
  /** Define os casos gerados e zera os status (cada geração começa "pendente"). */
  setCases: (cases: TestCase[] | null) => void;
  statuses: Record<number, CaseStatus>;
  /** Marca/desmarca o status de um caso (null = volta para pendente). */
  setStatus: (index: number, status: CaseStatus | null) => void;
}

const GeneratorContext = createContext<GeneratorContextValue | undefined>(
  undefined,
);

export function GeneratorProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>(loadState);

  // Persiste o estado para sobreviver a recarregamentos durante a sessão.
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Sem sessionStorage (modo privado): o estado segue vivo em memória
      // entre as abas, apenas não persiste num reload.
    }
  }, [state]);

  const patch = (p: Partial<PersistedState>) =>
    setState((s) => ({ ...s, ...p }));

  const value: GeneratorContextValue = {
    userStory: state.userStory,
    setUserStory: (v) => patch({ userStory: v }),
    criteria: state.criteria,
    setCriteria: (v) => patch({ criteria: v }),
    devAnalysis: state.devAnalysis,
    setDevAnalysis: (v) => patch({ devAnalysis: v }),
    tipos: state.tipos,
    toggleTipo: (t) =>
      setState((s) => ({
        ...s,
        tipos: s.tipos.includes(t)
          ? s.tipos.filter((x) => x !== t)
          : [...s.tipos, t],
      })),
    provider: state.provider,
    setProvider: (v) => patch({ provider: v }),
    model: state.model,
    setModel: (v) => patch({ model: v }),
    cases: state.cases,
    setCases: (cases) => patch({ cases, statuses: {} }),
    statuses: state.statuses,
    setStatus: (index, status) =>
      setState((s) => {
        const next = { ...s.statuses };
        if (status === null) delete next[index];
        else next[index] = status;
        return { ...s, statuses: next };
      }),
  };

  return (
    <GeneratorContext.Provider value={value}>
      {children}
    </GeneratorContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGenerator(): GeneratorContextValue {
  const context = useContext(GeneratorContext);
  if (context === undefined) {
    throw new Error('useGenerator deve ser usado dentro de <GeneratorProvider>.');
  }
  return context;
}

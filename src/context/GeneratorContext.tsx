import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { TestCase } from '../types';
import type { ProviderId } from '../lib/providers';

export type CaseStatus = 'pass' | 'fail';
type Tipo = TestCase['tipo'];

/** Cronômetro de um caso: tempo acumulado + instante de início (null = parado). */
export interface TimerState {
  elapsedMs: number;
  startedAt: number | null;
}

/** Tempo decorrido (ms) considerando um cronômetro possivelmente em andamento. */
export function timerElapsed(t: TimerState | undefined, now: number): number {
  if (!t) return 0;
  return t.elapsedMs + (t.startedAt !== null ? now - t.startedAt : 0);
}

const STORAGE_KEY = 'qa-hub-generator';

interface PersistedState {
  titulo: string;
  squad: string;
  sprint: string;
  cardId: string;
  userStory: string;
  criteria: string;
  devAnalysis: string;
  tipos: Tipo[];
  casosPorTipo: number;
  provider: ProviderId | '';
  model: string;
  cases: TestCase[] | null;
  /** IDs estáveis por caso (mesmo índice de `cases`) para upsert no repositório. */
  caseIds: string[];
  statuses: Record<number, CaseStatus>;
  timers: Record<number, TimerState>;
}

const INITIAL: PersistedState = {
  titulo: '',
  squad: '',
  sprint: '',
  cardId: '',
  userStory: '',
  criteria: '',
  devAnalysis: '',
  tipos: ['positivo', 'negativo'],
  casosPorTipo: 3,
  provider: '',
  model: '',
  cases: null,
  caseIds: [],
  statuses: {},
  timers: {},
};

function loadState(): PersistedState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      const merged = { ...INITIAL, ...parsed };
      // Garante caseIds alinhado com cases (migração de estados antigos).
      const n = merged.cases?.length ?? 0;
      if (merged.caseIds.length !== n) {
        merged.caseIds = Array.from({ length: n }, () => uuidv4());
      }
      return merged;
    }
  } catch {
    // sessionStorage indisponível ou JSON inválido — usa o estado inicial.
  }
  return INITIAL;
}

interface GeneratorContextValue {
  titulo: string;
  setTitulo: (v: string) => void;
  squad: string;
  setSquad: (v: string) => void;
  sprint: string;
  setSprint: (v: string) => void;
  cardId: string;
  setCardId: (v: string) => void;
  userStory: string;
  setUserStory: (v: string) => void;
  criteria: string;
  setCriteria: (v: string) => void;
  devAnalysis: string;
  setDevAnalysis: (v: string) => void;
  tipos: Tipo[];
  toggleTipo: (t: Tipo) => void;
  casosPorTipo: number;
  setCasosPorTipo: (n: number) => void;
  provider: ProviderId | '';
  setProvider: (v: ProviderId | '') => void;
  model: string;
  setModel: (v: string) => void;
  cases: TestCase[] | null;
  /** IDs estáveis por caso (mesmo índice de `cases`). */
  caseIds: string[];
  /** Define os casos gerados e zera status e cronômetros (cada geração recomeça). */
  setCases: (cases: TestCase[] | null) => void;
  /** Adiciona um caso manualmente ao final da lista. */
  addCase: (tc: TestCase) => void;
  /** Insere um caso na posição `index` (0 = no topo). */
  addCaseAt: (index: number, tc: TestCase) => void;
  /** Atualiza um caso gerado in-place (edição antes de salvar). */
  updateCase: (index: number, updated: TestCase) => void;
  /** Remove um caso gerado, reindexando status e cronômetros. */
  removeCase: (index: number) => void;
  statuses: Record<number, CaseStatus>;
  /** Marca/desmarca o status de um caso (null = volta para pendente). */
  setStatus: (index: number, status: CaseStatus | null) => void;
  timers: Record<number, TimerState>;
  startTimer: (index: number) => void;
  stopTimer: (index: number) => void;
  resetTimer: (index: number) => void;
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
    titulo: state.titulo,
    setTitulo: (v) => patch({ titulo: v }),
    squad: state.squad,
    setSquad: (v) => patch({ squad: v }),
    sprint: state.sprint,
    setSprint: (v) => patch({ sprint: v }),
    cardId: state.cardId,
    setCardId: (v) => patch({ cardId: v }),
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
    casosPorTipo: state.casosPorTipo,
    setCasosPorTipo: (n) => patch({ casosPorTipo: n }),
    provider: state.provider,
    setProvider: (v) => patch({ provider: v }),
    model: state.model,
    setModel: (v) => patch({ model: v }),
    cases: state.cases,
    caseIds: state.caseIds,
    setCases: (cases) =>
      patch({
        cases,
        caseIds: (cases ?? []).map(() => uuidv4()),
        statuses: {},
        timers: {},
      }),
    addCase: (tc) =>
      setState((s) => ({
        ...s,
        cases: [...(s.cases ?? []), tc],
        caseIds: [...s.caseIds, uuidv4()],
      })),
    addCaseAt: (index, tc) =>
      setState((s) => {
        const cases = (s.cases ?? []).slice();
        const caseIds = s.caseIds.slice();
        const at = Math.max(0, Math.min(index, cases.length));
        cases.splice(at, 0, tc);
        caseIds.splice(at, 0, uuidv4());
        return { ...s, cases, caseIds };
      }),
    updateCase: (index, updated) =>
      setState((s) => {
        if (!s.cases) return s;
        const next = s.cases.slice();
        next[index] = updated;
        return { ...s, cases: next };
      }),
    removeCase: (index) =>
      setState((s) => {
        if (!s.cases) return s;
        const cases = s.cases.slice();
        cases.splice(index, 1);
        const caseIds = s.caseIds.slice();
        caseIds.splice(index, 1);
        // Reindexa os mapas (chaves > index descem 1; a chave index é removida).
        const reindex = <T,>(m: Record<number, T>): Record<number, T> => {
          const out: Record<number, T> = {};
          for (const [k, v] of Object.entries(m)) {
            const i = Number(k);
            if (i < index) out[i] = v;
            else if (i > index) out[i - 1] = v;
          }
          return out;
        };
        return {
          ...s,
          cases,
          caseIds,
          statuses: reindex(s.statuses),
          timers: reindex(s.timers),
        };
      }),
    statuses: state.statuses,
    setStatus: (index, status) =>
      setState((s) => {
        const next = { ...s.statuses };
        if (status === null) delete next[index];
        else next[index] = status;
        return { ...s, statuses: next };
      }),
    timers: state.timers,
    startTimer: (index) =>
      setState((s) => {
        const cur = s.timers[index] ?? { elapsedMs: 0, startedAt: null };
        if (cur.startedAt !== null) return s; // já rodando
        return {
          ...s,
          timers: { ...s.timers, [index]: { ...cur, startedAt: Date.now() } },
        };
      }),
    stopTimer: (index) =>
      setState((s) => {
        const cur = s.timers[index];
        if (!cur || cur.startedAt === null) return s; // já parado
        return {
          ...s,
          timers: {
            ...s.timers,
            [index]: {
              elapsedMs: cur.elapsedMs + (Date.now() - cur.startedAt),
              startedAt: null,
            },
          },
        };
      }),
    resetTimer: (index) =>
      setState((s) => {
        const next = { ...s.timers };
        delete next[index];
        return { ...s, timers: next };
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

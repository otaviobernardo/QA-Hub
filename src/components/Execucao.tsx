import { useEffect, useMemo, useState } from 'react';
import type { SavedTestCase, SavedCaseStatus } from '../types';
import { getSavedCases, updateSavedCase } from '../lib/db';
import {
  tipoBadge,
  tipoLabel,
  savedStatusBadge,
  SAVED_STATUS_LABEL,
} from '../lib/testCaseOptions';

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// Cronômetros em andamento sobrevivem a troca de aba/reload via localStorage.
const RUNNING_KEY = 'qa-hub-execucao-running';

function loadRunning(): Record<string, number> {
  try {
    const raw = localStorage.getItem(RUNNING_KEY);
    if (raw) return JSON.parse(raw) as Record<string, number>;
  } catch {
    // localStorage indisponível ou JSON inválido — começa vazio.
  }
  return {};
}

export default function Execucao() {
  const [cases, setCases] = useState<SavedTestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [squadFilter, setSquadFilter] = useState('');
  const [sprintFilter, setSprintFilter] = useState('');
  const [search, setSearch] = useState('');

  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  // caseId -> instante de início do cronômetro (epoch ms). Ausente = parado.
  // Persistido no localStorage para sobreviver a troca de aba/reload (o startedAt
  // é absoluto, então a contagem continua correta ao remontar).
  const [running, setRunning] = useState<Record<string, number>>(loadRunning);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    try {
      localStorage.setItem(RUNNING_KEY, JSON.stringify(running));
    } catch {
      // localStorage indisponível — cronômetros seguem só em memória.
    }
  }, [running]);

  const load = async (): Promise<void> => {
    setLoading(true);
    setLoadError(false);
    try {
      setCases(await getSavedCases());
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const anyRunning = Object.keys(running).length > 0;
  useEffect(() => {
    if (!anyRunning) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [anyRunning]);

  const squads = useMemo(
    () => [...new Set(cases.map((c) => c.squad).filter(Boolean))].sort(),
    [cases],
  );
  const sprints = useMemo(
    () => [...new Set(cases.map((c) => c.sprint).filter(Boolean))].sort(),
    [cases],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return cases.filter((c) => {
      if (squadFilter && c.squad !== squadFilter) return false;
      if (sprintFilter && c.sprint !== sprintFilter) return false;
      if (term) {
        const hay = `${c.grupo} ${c.titulo} ${c.squad} ${c.sprint}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [cases, squadFilter, sprintFilter, search]);

  const groups = useMemo(() => {
    const map = new Map<string, SavedTestCase[]>();
    for (const c of filtered) {
      const key = c.grupo || 'Sem título';
      const arr = map.get(key);
      if (arr) arr.push(c);
      else map.set(key, [c]);
    }
    return [...map.entries()];
  }, [filtered]);

  const toggleGroup = (g: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });

  const elapsedOf = (c: SavedTestCase): number =>
    c.tempoMs + (running[c.id] ? now - running[c.id] : 0);

  const patchLocal = (id: string, changes: Partial<SavedTestCase>) =>
    setCases((prev) => prev.map((c) => (c.id === id ? { ...c, ...changes } : c)));

  const startTimer = (id: string) =>
    setRunning((prev) => (prev[id] ? prev : { ...prev, [id]: Date.now() }));

  const stopTimer = async (c: SavedTestCase): Promise<void> => {
    const startedAt = running[c.id];
    if (!startedAt) return;
    const tempoMs = c.tempoMs + (Date.now() - startedAt);
    setRunning((prev) => {
      const next = { ...prev };
      delete next[c.id];
      return next;
    });
    patchLocal(c.id, { tempoMs });
    try {
      await updateSavedCase(c.id, { tempoMs });
    } catch {
      window.alert('Não foi possível salvar o tempo. Tente novamente.');
    }
  };

  const resetTimer = async (c: SavedTestCase): Promise<void> => {
    if (elapsedOf(c) === 0) return;
    if (!window.confirm(`Zerar o tempo do caso "${c.titulo}"?`)) return;
    // Para o cronômetro, se estiver rodando, e zera o tempo acumulado.
    setRunning((prev) => {
      const next = { ...prev };
      delete next[c.id];
      return next;
    });
    patchLocal(c.id, { tempoMs: 0 });
    try {
      await updateSavedCase(c.id, { tempoMs: 0 });
    } catch {
      window.alert('Não foi possível zerar o tempo. Tente novamente.');
    }
  };

  const setStatus = async (c: SavedTestCase, status: SavedCaseStatus): Promise<void> => {
    const next = c.status === status ? 'pendente' : status;
    patchLocal(c.id, { status: next });
    try {
      await updateSavedCase(c.id, { status: next });
    } catch {
      patchLocal(c.id, { status: c.status });
      window.alert('Não foi possível salvar o status. Tente novamente.');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div
          role="status"
          aria-label="Carregando"
          className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-selbetti-green dark:border-gray-700 dark:border-t-selbetti-green"
        />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-500/30 dark:bg-red-500/10">
        <p className="text-sm text-red-700 dark:text-red-300">Erro ao carregar os casos.</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 rounded-md bg-selbetti-green px-4 py-2 text-sm font-semibold text-white hover:bg-selbetti-green/90"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (cases.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400">
        Nenhum caso salvo para executar. Gere e salve casos na aba Gerador.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
          Execução de testes
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Escolha um conjunto, rode cada caso com o cronômetro e marque
          Passou/Falhou. Tudo é salvo automaticamente.
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por feature, título…"
          className="min-w-[200px] flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-selbetti-green focus:ring-2 focus:ring-selbetti-green/30 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
        />
        <select
          value={squadFilter}
          onChange={(e) => setSquadFilter(e.target.value)}
          className="app-select rounded-md border border-gray-300 px-2 py-2 text-sm outline-none focus:border-selbetti-green dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        >
          <option value="">Squad: todos</option>
          {squads.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          value={sprintFilter}
          onChange={(e) => setSprintFilter(e.target.value)}
          className="app-select rounded-md border border-gray-300 px-2 py-2 text-sm outline-none focus:border-selbetti-green dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        >
          <option value="">Sprint: todas</option>
          {sprints.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400">
          Nenhum caso com os filtros atuais.
        </div>
      ) : (
      <div className="space-y-3">
        {groups.map(([grupo, items]) => {
          const isOpen = openGroups.has(grupo);
          const passed = items.filter((c) => c.status === 'pass').length;
          const failed = items.filter((c) => c.status === 'fail').length;
          const total = items.reduce((sum, c) => sum + elapsedOf(c), 0);
          return (
            <div
              key={grupo}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
            >
              <button
                type="button"
                onClick={() => toggleGroup(grupo)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <div className="min-w-0 flex-1">
                  {(items[0]?.squad || items[0]?.sprint) && (
                    <span className="mb-0.5 block truncate text-xs text-gray-400 dark:text-gray-500">
                      {[items[0]?.squad, items[0]?.sprint]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  )}
                  <span className="block truncate font-semibold text-gray-800 dark:text-gray-100">
                    {grupo}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                  <span className="text-selbetti-green dark:text-green-400">{passed} ok</span>
                  {' · '}
                  <span className="text-red-600 dark:text-red-400">{failed} falhas</span>
                  {' · '}
                  {formatTime(total)}
                </span>
                <svg
                  className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {isOpen && (
                <div className="space-y-3 border-t border-gray-100 p-4 dark:border-gray-700">
                  {items.map((c) => {
                    const isRunning = Boolean(running[c.id]);
                    return (
                      <article
                        key={c.id}
                        className={`rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800/60 ${
                          c.status === 'pass'
                            ? 'border-l-4 border-l-selbetti-green'
                            : c.status === 'fail'
                              ? 'border-l-4 border-l-red-500'
                              : ''
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tipoBadge[c.tipo]}`}
                          >
                            {tipoLabel[c.tipo]}
                          </span>
                          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                            {c.titulo}
                          </h3>
                          <span
                            className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${savedStatusBadge[c.status]}`}
                          >
                            {SAVED_STATUS_LABEL[c.status]}
                          </span>
                        </div>

                        {c.descricao && (
                          <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                            {c.descricao}
                          </p>
                        )}

                        {c.tipo === 'exploratorio' &&
                          (c.explore || c.com || c.para_validar || c.e) && (
                            <dl className="mt-3 space-y-2 rounded-md border border-fuchsia-200 bg-fuchsia-50 p-3 dark:border-fuchsia-500/20 dark:bg-fuchsia-500/10">
                              {(
                                [
                                  ['Explore', c.explore],
                                  ['Com', c.com],
                                  ['Para validar', c.para_validar],
                                  ['E', c.e],
                                ] as const
                              ).map(([label, val]) =>
                                val ? (
                                  <div key={label}>
                                    <dt className="text-xs font-bold uppercase tracking-wide text-fuchsia-700 dark:text-fuchsia-300">
                                      {label}
                                    </dt>
                                    <dd className="text-sm text-gray-700 dark:text-gray-300">
                                      {val}
                                    </dd>
                                  </div>
                                ) : null,
                              )}
                            </dl>
                          )}

                        {c.passos.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                              Passos
                            </p>
                            <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
                              {c.passos.map((passo, i) => (
                                <li key={i}>{passo}</li>
                              ))}
                            </ol>
                          </div>
                        )}

                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                              Resultado esperado
                            </p>
                            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                              {c.resultado_esperado || '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                              CA/RN coberto
                            </p>
                            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                              {c.ca_coberto || '—'}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3 dark:border-gray-700">
                          {/* Cronômetro */}
                          <div className="flex items-center gap-2">
                            <span className="min-w-[3.5rem] font-mono text-sm tabular-nums text-gray-700 dark:text-gray-200">
                              {formatTime(elapsedOf(c))}
                            </span>
                            {isRunning ? (
                              <button
                                type="button"
                                onClick={() => void stopTimer(c)}
                                className="rounded-md border border-selbetti-orange bg-selbetti-orange/10 px-3 py-1 text-xs font-semibold text-selbetti-orange transition-colors hover:bg-selbetti-orange/20"
                              >
                                ⏸ Parar
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => startTimer(c.id)}
                                className="rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                              >
                                ▶ Iniciar
                              </button>
                            )}
                            {!isRunning && elapsedOf(c) > 0 && (
                              <button
                                type="button"
                                onClick={() => void resetTimer(c)}
                                className="text-xs font-medium text-gray-400 underline transition-colors hover:text-gray-600 dark:hover:text-gray-300"
                              >
                                Zerar
                              </button>
                            )}
                          </div>

                          {/* Resultado */}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void setStatus(c, 'pass')}
                              className={`rounded-md border px-3 py-1 text-xs font-semibold transition-colors ${
                                c.status === 'pass'
                                  ? 'border-selbetti-green bg-selbetti-green text-white'
                                  : 'border-gray-300 text-selbetti-green hover:bg-selbetti-green/10 dark:border-gray-600 dark:text-green-400'
                              }`}
                            >
                              ✓ Passou
                            </button>
                            <button
                              type="button"
                              onClick={() => void setStatus(c, 'fail')}
                              className={`rounded-md border px-3 py-1 text-xs font-semibold transition-colors ${
                                c.status === 'fail'
                                  ? 'border-red-500 bg-red-500 text-white'
                                  : 'border-gray-300 text-red-600 hover:bg-red-50 dark:border-gray-600 dark:text-red-400 dark:hover:bg-red-500/10'
                              }`}
                            >
                              ✗ Falhou
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}

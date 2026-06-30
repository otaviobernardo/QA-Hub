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

export default function Execucao() {
  const [cases, setCases] = useState<SavedTestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  // caseId -> instante de início do cronômetro (epoch ms). Ausente = parado.
  const [running, setRunning] = useState<Record<string, number>>({});
  const [now, setNow] = useState(() => Date.now());

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

  const groups = useMemo(() => {
    const map = new Map<string, SavedTestCase[]>();
    for (const c of cases) {
      const key = c.grupo || 'Sem título';
      const arr = map.get(key);
      if (arr) arr.push(c);
      else map.set(key, [c]);
    }
    return [...map.entries()];
  }, [cases]);

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
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
          Execução de testes
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Escolha um conjunto, rode cada caso com o cronômetro e marque
          Passou/Falhou. Tudo é salvo automaticamente.
        </p>
      </div>

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
                <span className="flex-1 font-semibold text-gray-800 dark:text-gray-100">
                  {grupo}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
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
                <div className="divide-y divide-gray-100 border-t border-gray-100 dark:divide-gray-700 dark:border-gray-700">
                  {items.map((c) => {
                    const isRunning = Boolean(running[c.id]);
                    return (
                      <div
                        key={c.id}
                        className={`flex flex-wrap items-center gap-3 px-4 py-3 ${
                          c.status === 'pass'
                            ? 'border-l-4 border-l-selbetti-green'
                            : c.status === 'fail'
                              ? 'border-l-4 border-l-red-500'
                              : ''
                        }`}
                      >
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${tipoBadge[c.tipo]}`}
                        >
                          {tipoLabel[c.tipo]}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800 dark:text-gray-100">
                          {c.titulo}
                        </span>

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

                        <span
                          className={`hidden rounded-full px-2 py-0.5 text-xs font-medium sm:inline ${savedStatusBadge[c.status]}`}
                        >
                          {SAVED_STATUS_LABEL[c.status]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

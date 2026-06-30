import { useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { SavedTestCase, SavedCaseStatus, TestCase } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  getSavedCases,
  createSavedCase,
  updateSavedCase,
  deleteSavedCase,
} from '../lib/db';
import {
  TIPO_OPTIONS,
  tipoLabel,
  tipoBadge,
  SAVED_STATUS_LABEL,
  savedStatusBadge,
} from '../lib/testCaseOptions';
import TestCaseModal, { type TestCaseModalResult } from './TestCaseModal';

function formatTime(ms: number): string {
  if (!ms) return '—';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

const STATUSES: SavedCaseStatus[] = ['pendente', 'pass', 'fail'];

type ModalState =
  | { mode: 'create' }
  | { mode: 'edit'; item: SavedTestCase }
  | null;

const emptyCase: TestCase & {
  grupo: string;
  squad: string;
  sprint: string;
  modulo: string;
  status: SavedCaseStatus;
} = {
  tipo: 'positivo',
  titulo: '',
  descricao: '',
  passos: [],
  resultado_esperado: '',
  ca_coberto: '',
  grupo: '',
  squad: '',
  sprint: '',
  modulo: '',
  status: 'pendente',
};

export default function SavedTestCases() {
  const { user } = useAuth();
  const uid = user?.uid ?? '';
  const displayName = user?.displayName?.trim() || user?.email || 'QA';

  const [cases, setCases] = useState<SavedTestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [squadFilter, setSquadFilter] = useState('');
  const [sprintFilter, setSprintFilter] = useState('');
  const [moduloFilter, setModuloFilter] = useState('');

  const [modal, setModal] = useState<ModalState>(null);
  const [saving, setSaving] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  // Seleção em lote (somente casos do próprio usuário podem ser marcados).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const toggleGroup = (g: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Marca/desmarca todos os casos do usuário dentro de um grupo.
  const toggleGroupSelect = (ids: string[], allSelected: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });

  const load = async (): Promise<void> => {
    setLoading(true);
    setLoadError(false);
    try {
      setCases(await getSavedCases());
      setSelected(new Set());
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const squads = useMemo(
    () => [...new Set(cases.map((c) => c.squad).filter(Boolean))].sort(),
    [cases],
  );
  const sprints = useMemo(
    () => [...new Set(cases.map((c) => c.sprint).filter(Boolean))].sort(),
    [cases],
  );
  const modulos = useMemo(
    () => [...new Set(cases.map((c) => c.modulo).filter(Boolean))].sort(),
    [cases],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return cases.filter((c) => {
      if (tipoFilter && c.tipo !== tipoFilter) return false;
      if (statusFilter && c.status !== statusFilter) return false;
      if (squadFilter && c.squad !== squadFilter) return false;
      if (sprintFilter && c.sprint !== sprintFilter) return false;
      if (moduloFilter && c.modulo !== moduloFilter) return false;
      if (term) {
        const hay =
          `${c.grupo} ${c.titulo} ${c.descricao} ${c.modulo} ${c.squad} ${c.sprint}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [
    cases,
    search,
    tipoFilter,
    statusFilter,
    squadFilter,
    sprintFilter,
    moduloFilter,
  ]);

  // Agrupa os casos filtrados por título (grupo), preservando a ordem (mais recente primeiro).
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

  const handleSave = async (result: TestCaseModalResult): Promise<void> => {
    if (!user || !modal) return;
    setSaving(true);
    try {
      if (modal.mode === 'create') {
        await createSavedCase({
          id: uuidv4(),
          ...result,
          tempoMs: 0,
          createdBy: uid,
          createdByName: displayName,
        });
      } else {
        await updateSavedCase(modal.item.id, { ...result });
      }
      setModal(null);
      await load();
    } catch {
      window.alert('Não foi possível salvar o caso. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: SavedTestCase): Promise<void> => {
    if (!window.confirm(`Excluir o caso "${item.titulo}"?`)) return;
    try {
      await deleteSavedCase(item.id);
      await load();
    } catch {
      window.alert('Não foi possível excluir o caso.');
    }
  };

  const handleBulkDelete = async (): Promise<void> => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (
      !window.confirm(
        `Excluir ${ids.length} caso(s) selecionado(s)? Esta ação não pode ser desfeita.`,
      )
    )
      return;
    setBulkDeleting(true);
    try {
      // allSettled: reporta exatamente quantos falharam (exclusão parcial).
      const results = await Promise.allSettled(
        ids.map((id) => deleteSavedCase(id)),
      );
      const failed = results.filter((r) => r.status === 'rejected').length;
      await load();
      if (failed > 0) {
        window.alert(
          `${ids.length - failed} de ${ids.length} caso(s) excluído(s). ${failed} falhou(aram).`,
        );
      }
    } catch {
      window.alert('Não foi possível excluir os casos selecionados.');
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            Casos de teste
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Repositório dos casos salvos pelo time — gerados pela IA ou criados
            manualmente.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => exportCsv(filtered)}
            disabled={filtered.length === 0}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Exportar CSV
          </button>
          <button
            type="button"
            onClick={() => setModal({ mode: 'create' })}
            className="rounded-md bg-selbetti-green px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-selbetti-green/90"
          >
            + Novo manual
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por título, descrição, módulo…"
          className="min-w-[220px] flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-selbetti-green focus:ring-2 focus:ring-selbetti-green/30 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
        />
        <Filter value={tipoFilter} onChange={setTipoFilter} placeholder="Tipo: todos">
          {TIPO_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Filter>
        <Filter value={statusFilter} onChange={setStatusFilter} placeholder="Status: todos">
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {SAVED_STATUS_LABEL[s]}
            </option>
          ))}
        </Filter>
        <Filter value={squadFilter} onChange={setSquadFilter} placeholder="Squad: todos">
          {squads.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Filter>
        <Filter value={sprintFilter} onChange={setSprintFilter} placeholder="Sprint: todas">
          {sprints.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Filter>
        <Filter value={moduloFilter} onChange={setModuloFilter} placeholder="Módulo: todos">
          {modulos.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Filter>
      </div>

      {/* Barra de ações em lote */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-selbetti-orange/40 bg-selbetti-orange/10 px-3 py-2 text-sm">
          <span className="font-medium text-gray-700 dark:text-gray-200">
            {selected.size} caso{selected.size === 1 ? '' : 's'} selecionado
            {selected.size === 1 ? '' : 's'}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Limpar seleção
            </button>
            <button
              type="button"
              onClick={() => void handleBulkDelete()}
              disabled={bulkDeleting}
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {bulkDeleting ? 'Excluindo…' : `Excluir ${selected.size} selecionado(s)`}
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div
            role="status"
            aria-label="Carregando"
            className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-selbetti-green dark:border-gray-700 dark:border-t-selbetti-green"
          />
        </div>
      ) : loadError ? (
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
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400">
          Nenhum caso salvo {cases.length > 0 ? 'com os filtros atuais' : 'ainda'}.
          Gere casos no Gerador e clique em “Salvar”, ou crie um manual.
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(([grupo, items]) => {
            const isOpen = openGroups.has(grupo);
            const passed = items.filter((c) => c.status === 'pass').length;
            const groupIds = items.map((c) => c.id);
            const allSelected =
              groupIds.length > 0 && groupIds.every((id) => selected.has(id));
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
                    <p className="truncate font-semibold text-gray-800 dark:text-gray-100">
                      {grupo}
                    </p>
                    {(items[0]?.squad || items[0]?.sprint) && (
                      <p className="mt-0.5 truncate text-xs text-gray-400 dark:text-gray-500">
                        {[items[0]?.squad, items[0]?.sprint]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                    {items.length} caso{items.length === 1 ? '' : 's'} · {passed}/
                    {items.length} passaram
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
                  <div className="overflow-x-auto border-t border-gray-100 dark:border-gray-700">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-900/50 dark:text-gray-400">
                        <tr>
                          <th className="w-10 px-4 py-2">
                            {groupIds.length > 0 && (
                              <input
                                type="checkbox"
                                checked={allSelected}
                                onChange={() =>
                                  toggleGroupSelect(groupIds, allSelected)
                                }
                                aria-label="Selecionar todos os casos do grupo"
                                title="Selecionar todos os casos deste grupo"
                                className="h-4 w-4 rounded border-gray-300 text-selbetti-green focus:ring-selbetti-green"
                              />
                            )}
                          </th>
                          <th className="px-4 py-2 font-medium">Título</th>
                          <th className="px-4 py-2 font-medium">Tipo</th>
                          <th className="px-4 py-2 font-medium">Módulo</th>
                          <th className="px-4 py-2 font-medium">Status</th>
                          <th className="px-4 py-2 font-medium">Tempo</th>
                          <th className="px-4 py-2 text-right font-medium">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {items.map((c) => (
                          <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                            <td className="px-4 py-2">
                              <input
                                type="checkbox"
                                checked={selected.has(c.id)}
                                onChange={() => toggleSelect(c.id)}
                                aria-label={`Selecionar ${c.titulo}`}
                                className="h-4 w-4 rounded border-gray-300 text-selbetti-green focus:ring-selbetti-green"
                              />
                            </td>
                            <td className="max-w-xs truncate px-4 py-2 font-medium text-gray-800 dark:text-gray-100">
                              {c.titulo}
                            </td>
                            <td className="px-4 py-2">
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tipoBadge[c.tipo]}`}>
                                {tipoLabel[c.tipo]}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{c.modulo || '—'}</td>
                            <td className="px-4 py-2">
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${savedStatusBadge[c.status]}`}>
                                {SAVED_STATUS_LABEL[c.status]}
                              </span>
                            </td>
                            <td className="px-4 py-2 font-mono text-xs text-gray-600 dark:text-gray-300">
                              {formatTime(c.tempoMs)}
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => setModal({ mode: 'edit', item: c })}
                                  className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-selbetti-purple dark:hover:bg-gray-700"
                                  aria-label="Editar"
                                  title="Editar"
                                >
                                  <PencilIcon />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleDelete(c)}
                                  className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/15"
                                  aria-label="Excluir"
                                  title="Excluir"
                                >
                                  <TrashIcon />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <TestCaseModal
          value={modal.mode === 'edit' ? modal.item : emptyCase}
          withMeta
          title={modal.mode === 'edit' ? 'Editar caso de teste' : 'Novo caso de teste'}
          saving={saving}
          onClose={() => setModal(null)}
          onSave={(r) => void handleSave(r)}
        />
      )}
    </div>
  );
}

function Filter({
  value,
  onChange,
  placeholder,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="app-select rounded-md border border-gray-300 px-2 py-2 text-sm outline-none focus:border-selbetti-green dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
    >
      <option value="">{placeholder}</option>
      {children}
    </select>
  );
}

/* --------------------------- Export CSV --------------------------- */

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function bodyText(c: SavedTestCase): string {
  if (c.tipo === 'exploratorio') {
    return [
      c.explore && `EXPLORE: ${c.explore}`,
      c.com && `COM: ${c.com}`,
      c.para_validar && `PARA VALIDAR: ${c.para_validar}`,
      c.e && `E: ${c.e}`,
    ]
      .filter(Boolean)
      .join('\n');
  }
  return c.passos.map((p, i) => `${i + 1}. ${p}`).join('\n');
}

function exportCsv(cases: SavedTestCase[]): void {
  const headers = [
    'Squad',
    'Sprint',
    'Feature',
    'Tipo',
    'Título',
    'Módulo',
    'Status',
    'Tempo',
    'Passos/Charter',
    'Resultado Esperado',
    'CA Coberto',
  ];
  const rows = cases.map((c) =>
    [
      c.squad,
      c.sprint,
      c.grupo,
      tipoLabel[c.tipo],
      c.titulo,
      c.modulo,
      SAVED_STATUS_LABEL[c.status],
      formatTime(c.tempoMs),
      bodyText(c),
      c.resultado_esperado,
      c.ca_coberto,
    ]
      .map(csvCell)
      .join(';'),
  );
  const content = '﻿' + [headers.map(csvCell).join(';'), ...rows].join('\r\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `casos-de-teste-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function PencilIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
  );
}

import { useMemo, useState } from 'react';
import type { Bug, BugStatus, Severity } from '../types';
import { deleteBug } from '../lib/db';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { STATUSES, SEVERITIES, severityBadge, statusBadge } from '../lib/bugOptions';

const PAGE_SIZE = 20;

interface BugTableProps {
  bugs: Bug[];
  onView: (bug: Bug) => void;
  onEdit: (bug: Bug) => void;
  onChanged: () => void; // recarrega a lista após exclusão
}

export default function BugTable({ bugs, onView, onEdit, onChanged }: BugTableProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const uid = user?.uid ?? '';

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<BugStatus | ''>('');
  const [severity, setSeverity] = useState<Severity | ''>('');
  const [sprint, setSprint] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [onlyMine, setOnlyMine] = useState(true);
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const sprints = useMemo(
    () => [...new Set(bugs.map((b) => b.sprint).filter(Boolean))].sort(),
    [bugs],
  );
  const modules = useMemo(
    () => [...new Set(bugs.map((b) => b.module).filter(Boolean))].sort(),
    [bugs],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return bugs.filter((b) => {
      if (onlyMine && b.createdBy !== uid) return false;
      if (status && b.status !== status) return false;
      if (severity && b.severity !== severity) return false;
      if (sprint && b.sprint !== sprint) return false;
      if (moduleFilter && b.module !== moduleFilter) return false;
      if (term) {
        const haystack = `${b.title} ${b.description} ${b.assignee} ${b.module}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [bugs, onlyMine, uid, status, severity, sprint, moduleFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const resetPage = () => setPage(1);

  const handleDelete = async (bug: Bug): Promise<void> => {
    const confirmed = await confirm({
      title: 'Excluir bug',
      message: `Excluir o bug "${bug.title}"? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar',
      tone: 'red',
    });
    if (!confirmed) return;
    setDeletingId(bug.id);
    try {
      await deleteBug(bug.id);
      onChanged();
    } catch {
      showToast('Não foi possível excluir o bug. Tente novamente.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleExportCsv = () => exportBugsCsv(filtered);

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            resetPage();
          }}
          placeholder="Buscar por título, descrição, responsável…"
          className="min-w-[220px] flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-selbetti-green focus:ring-2 focus:ring-selbetti-green/30 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
        />

        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as BugStatus | '');
            resetPage();
          }}
          className="app-select rounded-md border border-gray-300 px-2 py-2 text-sm outline-none focus:border-selbetti-green dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        >
          <option value="">Status: todos</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={severity}
          onChange={(e) => {
            setSeverity(e.target.value as Severity | '');
            resetPage();
          }}
          className="app-select rounded-md border border-gray-300 px-2 py-2 text-sm outline-none focus:border-selbetti-green dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        >
          <option value="">Severidade: todas</option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={sprint}
          onChange={(e) => {
            setSprint(e.target.value);
            resetPage();
          }}
          className="app-select rounded-md border border-gray-300 px-2 py-2 text-sm outline-none focus:border-selbetti-green dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        >
          <option value="">Sprint: todas</option>
          {sprints.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={moduleFilter}
          onChange={(e) => {
            setModuleFilter(e.target.value);
            resetPage();
          }}
          className="app-select rounded-md border border-gray-300 px-2 py-2 text-sm outline-none focus:border-selbetti-green dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        >
          <option value="">Módulo: todos</option>
          {modules.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={onlyMine}
            onChange={(e) => {
              setOnlyMine(e.target.checked);
              resetPage();
            }}
            className="h-4 w-4 rounded border-gray-300 text-selbetti-green focus:ring-selbetti-green"
          />
          {onlyMine ? 'Exibindo apenas os meus' : 'Exibindo todos'}
        </label>

        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {filtered.length} bug{filtered.length === 1 ? '' : 's'}
          </span>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filtered.length === 0}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Tabela / estado vazio */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400">
          Nenhum bug encontrado com os filtros atuais.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3 font-medium">Título</th>
                <th className="px-4 py-3 font-medium">Módulo</th>
                <th className="px-4 py-3 font-medium">Sprint</th>
                <th className="px-4 py-3 font-medium">Severidade</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Responsável</th>
                <th className="px-4 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {pageItems.map((bug) => (
                <tr key={bug.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                  <td className="max-w-xs truncate px-4 py-3 font-medium text-gray-800 dark:text-gray-100">
                    {bug.title}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{bug.module}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{bug.sprint}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${severityBadge[bug.severity]}`}>
                      {bug.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[bug.status]}`}>
                      {bug.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{bug.assignee}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <ActionButton label="Visualizar" onClick={() => onView(bug)}>
                        <EyeIcon />
                      </ActionButton>
                      {bug.createdBy === uid && (
                        <>
                          <ActionButton label="Editar" onClick={() => onEdit(bug)}>
                            <PencilIcon />
                          </ActionButton>
                          <ActionButton
                            label="Excluir"
                            danger
                            disabled={deletingId === bug.id}
                            onClick={() => handleDelete(bug)}
                          >
                            <TrashIcon />
                          </ActionButton>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="rounded-md border border-gray-300 px-3 py-1.5 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Anterior
          </button>
          <span className="text-gray-500 dark:text-gray-400">
            Página {currentPage} de {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="rounded-md border border-gray-300 px-3 py-1.5 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}

/* --------------------------- Export CSV --------------------------- */

function csvCell(value: string): string {
  // Aspas duplas escapadas; envolve sempre em aspas para suportar ; e quebras.
  return `"${value.replace(/"/g, '""')}"`;
}

function exportBugsCsv(bugs: Bug[]): void {
  const headers = [
    'ID',
    'Título',
    'Módulo',
    'Severidade',
    'Prioridade',
    'Ambiente',
    'Status',
    'Sprint',
    'Responsável',
    'Descrição',
    'Evidência',
  ];

  const rows = bugs.map((b) =>
    [
      b.id,
      b.title,
      b.module,
      b.severity,
      b.priority,
      b.environment,
      b.status,
      b.sprint,
      b.assignee,
      b.description,
      b.evidence,
    ]
      .map(csvCell)
      .join(';'),
  );

  // BOM para o Excel reconhecer UTF-8 e exibir acentos corretamente.
  const content = '﻿' + [headers.map(csvCell).join(';'), ...rows].join('\r\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `bugs-${stamp}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/* --------------------------- Subcomponents ------------------------ */

function ActionButton({
  label,
  onClick,
  children,
  danger = false,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`rounded-md p-1.5 transition-colors disabled:opacity-40 ${
        danger
          ? 'text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/15'
          : 'text-gray-400 hover:bg-gray-100 hover:text-selbetti-purple dark:hover:bg-gray-700'
      }`}
    >
      {children}
    </button>
  );
}

function EyeIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );
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

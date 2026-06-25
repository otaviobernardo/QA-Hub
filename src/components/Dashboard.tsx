import { useEffect, useMemo, useState } from 'react';
import type { Bug } from '../types';
import { getBugs } from '../lib/db';
import { SEVERITIES, STATUSES, severityBadge, statusBadge } from '../lib/bugOptions';
import BugTable from './BugTable';
import BugModal, { type BugModalMode } from './BugModal';
import SprintNotes from './SprintNotes';

type Tab = 'overview' | 'list';

interface ModalState {
  mode: BugModalMode;
  bug?: Bug;
}

export default function Dashboard() {
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');
  const [modal, setModal] = useState<ModalState | null>(null);

  const loadBugs = async (): Promise<void> => {
    setLoading(true);
    setLoadError(false);
    try {
      setBugs(await getBugs());
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBugs();
  }, []);

  const sprints = useMemo(
    () => [...new Set(bugs.map((b) => b.sprint).filter(Boolean))].sort(),
    [bugs],
  );

  if (loading) {
    return (
      <div className="flex justify-center py-20">
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
        <p className="text-sm text-red-700 dark:text-red-300">
          Erro ao carregar os bugs.
        </p>
        <button
          type="button"
          onClick={() => void loadBugs()}
          className="mt-3 rounded-md bg-selbetti-green px-4 py-2 text-sm font-semibold text-white hover:bg-selbetti-green/90"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sub-abas */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        <TabButton active={tab === 'overview'} onClick={() => setTab('overview')}>
          Visão geral
        </TabButton>
        <TabButton active={tab === 'list'} onClick={() => setTab('list')}>
          Lista de bugs
        </TabButton>
      </div>

      {tab === 'overview' ? (
        <Overview bugs={bugs} sprints={sprints} />
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setModal({ mode: 'create' })}
              className="rounded-md bg-selbetti-green px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-selbetti-green/90"
            >
              + Novo bug
            </button>
          </div>
          <BugTable
            bugs={bugs}
            onView={(bug) => setModal({ mode: 'view', bug })}
            onEdit={(bug) => setModal({ mode: 'edit', bug })}
            onChanged={() => void loadBugs()}
          />
        </div>
      )}

      {modal && (
        <BugModal
          mode={modal.mode}
          bug={modal.bug}
          onClose={() => setModal(null)}
          onSaved={() => void loadBugs()}
        />
      )}
    </div>
  );
}

/* ----------------------------- Visão geral ------------------------ */

function Overview({ bugs, sprints }: { bugs: Bug[]; sprints: string[] }) {
  const total = bugs.length;
  const open = bugs.filter((b) => b.status === 'Aberto').length;
  const inProgress = bugs.filter((b) => b.status === 'Em andamento').length;
  const resolved = bugs.filter(
    (b) => b.status === 'Resolvido' || b.status === 'Fechado',
  ).length;
  const critical = bugs.filter((b) => b.severity === 'Crítico').length;

  const bySeverity = SEVERITIES.map((s) => ({
    label: s,
    count: bugs.filter((b) => b.severity === s).length,
    badge: severityBadge[s],
  }));
  const byStatus = STATUSES.map((s) => ({
    label: s,
    count: bugs.filter((b) => b.status === s).length,
    badge: statusBadge[s],
  }));

  if (total === 0) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400">
          Nenhum bug registrado ainda. Use a aba <strong>Lista de bugs</strong> para
          criar o primeiro.
        </div>
        <SprintNotes sprints={sprints} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cards de métricas */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard label="Total" value={total} accent="text-gray-800 dark:text-gray-100" />
        <MetricCard label="Abertos" value={open} accent="text-red-600" />
        <MetricCard label="Em andamento" value={inProgress} accent="text-selbetti-purple" />
        <MetricCard label="Resolvidos" value={resolved} accent="text-selbetti-green" />
        <MetricCard label="Críticos" value={critical} accent="text-selbetti-orange" />
      </div>

      {/* Distribuições */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DistributionCard title="Por severidade" items={bySeverity} total={total} />
        <DistributionCard title="Por status" items={byStatus} total={total} />
      </div>

      <SprintNotes sprints={sprints} />
    </div>
  );
}

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
        {label}
      </p>
      <p className={`mt-1 text-3xl font-bold ${accent}`}>{value}</p>
    </div>
  );
}

function DistributionCard({
  title,
  items,
  total,
}: {
  title: string;
  items: { label: string; count: number; badge: string }[];
  total: number;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 p-5">
      <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">{title}</h3>
      <div className="mt-4 space-y-3">
        {items.map((item) => {
          const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
          return (
            <div key={item.label}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${item.badge}`}>
                  {item.label}
                </span>
                <span className="text-gray-500 dark:text-gray-400">
                  {item.count} ({pct}%)
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                <div
                  className="h-full rounded-full bg-selbetti-green"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? 'border-selbetti-green text-selbetti-green'
          : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
      }`}
    >
      {children}
    </button>
  );
}

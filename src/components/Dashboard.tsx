import { useEffect, useMemo, useState } from 'react';
import type { Bug } from '../types';
import { useAuth } from '../context/AuthContext';
import { getBugs } from '../lib/db';
import { SEVERITIES, STATUSES, severityBadge, statusBadge } from '../lib/bugOptions';
import SprintNotes from './SprintNotes';

type Tab = 'overview' | 'trends';

export default function Dashboard() {
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');

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
        <TabButton active={tab === 'trends'} onClick={() => setTab('trends')}>
          Tendências
        </TabButton>
      </div>

      {tab === 'overview' && <Overview bugs={bugs} sprints={sprints} />}

      {tab === 'trends' && <Trends bugs={bugs} />}
    </div>
  );
}

/* ----------------------------- Visão geral ------------------------ */

function Overview({ bugs, sprints }: { bugs: Bug[]; sprints: string[] }) {
  const { user } = useAuth();
  const uid = user?.uid ?? '';
  const [onlyMine, setOnlyMine] = useState(true);

  const visible = onlyMine ? bugs.filter((b) => b.createdBy === uid) : bugs;

  const total = visible.length;
  const open = visible.filter((b) => b.status === 'Aberto').length;
  const inProgress = visible.filter((b) => b.status === 'Em andamento').length;
  const resolved = visible.filter(
    (b) => b.status === 'Resolvido' || b.status === 'Fechado',
  ).length;
  const critical = visible.filter((b) => b.severity === 'Crítico').length;

  const bySeverity = SEVERITIES.map((s) => ({
    label: s,
    count: visible.filter((b) => b.severity === s).length,
    badge: severityBadge[s],
  }));
  const byStatus = STATUSES.map((s) => ({
    label: s,
    count: visible.filter((b) => b.status === s).length,
    badge: statusBadge[s],
  }));

  return (
    <div className="space-y-6">
      {/* Toggle meus / todos */}
      <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
        <input
          type="checkbox"
          checked={onlyMine}
          onChange={(e) => setOnlyMine(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-selbetti-green focus:ring-selbetti-green"
        />
        {onlyMine ? 'Vendo apenas os meus bugs' : 'Vendo todos os bugs'}
      </label>

      {total === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400">
          {bugs.length > 0 && onlyMine
            ? 'Você ainda não registrou bugs. Desmarque o filtro para ver os de todos.'
            : 'Nenhum bug registrado ainda. Use a aba Lista de bugs para criar o primeiro.'}
        </div>
      ) : (
        <>
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
        </>
      )}

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

/* ----------------------------- Tendências ------------------------ */

const NEUTRAL_BADGE = 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';

function countBy(bugs: Bug[], key: (b: Bug) => string): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const b of bugs) {
    const k = key(b) || '—';
    acc[k] = (acc[k] ?? 0) + 1;
  }
  return acc;
}

function toItems(counts: Record<string, number>) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count, badge: NEUTRAL_BADGE }));
}

function Trends({ bugs }: { bugs: Bug[] }) {
  if (bugs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400">
        Sem bugs para gerar tendências.
      </div>
    );
  }

  const open = bugs.filter(
    (b) => b.status === 'Aberto' || b.status === 'Em andamento',
  );

  // Aging dos bugs abertos por faixa de idade.
  const ageBuckets: Record<string, number> = {
    '0–3 dias': 0,
    '4–7 dias': 0,
    '8–14 dias': 0,
    '15+ dias': 0,
  };
  const now = Date.now();
  for (const b of open) {
    const days = (now - b.createdAt.getTime()) / 86_400_000;
    if (days <= 3) ageBuckets['0–3 dias']++;
    else if (days <= 7) ageBuckets['4–7 dias']++;
    else if (days <= 14) ageBuckets['8–14 dias']++;
    else ageBuckets['15+ dias']++;
  }

  const sprints = [...new Set(bugs.map((b) => b.sprint).filter(Boolean))].sort();
  const bySprint = sprints.map((s) => {
    const inSprint = bugs.filter((b) => b.sprint === s);
    const resolved = inSprint.filter(
      (b) => b.status === 'Resolvido' || b.status === 'Fechado',
    ).length;
    return { sprint: s, total: inSprint.length, resolved, open: inSprint.length - resolved };
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DistributionCard
          title="Bugs por módulo"
          items={toItems(countBy(bugs, (b) => b.module))}
          total={bugs.length}
        />
        <DistributionCard
          title="Bugs por responsável"
          items={toItems(countBy(bugs, (b) => b.assignee))}
          total={bugs.length}
        />
        <DistributionCard
          title="Bugs abertos por idade (aging)"
          items={Object.entries(ageBuckets).map(([label, count]) => ({
            label,
            count,
            badge: NEUTRAL_BADGE,
          }))}
          total={open.length}
        />
        <SprintProgressCard data={bySprint} />
      </div>
    </div>
  );
}

function SprintProgressCard({
  data,
}: {
  data: { sprint: string; total: number; resolved: number; open: number }[];
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">
        Abertos vs. resolvidos por sprint
      </h3>
      {data.length === 0 ? (
        <p className="mt-4 text-sm text-gray-400 dark:text-gray-500">Sem sprints.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {data.map((s) => {
            const pctResolved =
              s.total > 0 ? Math.round((s.resolved / s.total) * 100) : 0;
            return (
              <div key={s.sprint}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300">{s.sprint}</span>
                  <span className="text-gray-500 dark:text-gray-400">
                    {s.resolved}/{s.total} resolvidos
                  </span>
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-selbetti-orange/30">
                  <div
                    className="h-full rounded-full bg-selbetti-green"
                    style={{ width: `${pctResolved}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
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

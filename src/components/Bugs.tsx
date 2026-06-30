import { useEffect, useState } from 'react';
import type { Bug } from '../types';
import { getBugs, getUserProfile, updateBug } from '../lib/db';
import { pullBugStatus } from '../lib/bugSync';
import { AzureError } from '../lib/azure';
import { useAuth } from '../context/AuthContext';
import BugTable from './BugTable';
import BugModal, { type BugModalMode } from './BugModal';

interface ModalState {
  mode: BugModalMode;
  bug?: Bug;
}

export default function Bugs() {
  const { user } = useAuth();
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

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

  // Pull manual: lê o estado dos work items vinculados (apenas dos meus bugs,
  // pois só o criador pode atualizar no Firestore) e traz o status de volta.
  const handleSync = async (): Promise<void> => {
    if (!user) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const profile = await getUserProfile(user.uid);
      const pat = profile?.azurePat?.trim();
      if (!pat) {
        setSyncMsg('Configure seu PAT do Azure DevOps em Configurações.');
        return;
      }
      const mine = bugs.filter(
        (b) => b.azureWorkItemId && b.createdBy === user.uid,
      );
      if (mine.length === 0) {
        setSyncMsg('Nenhum bug vinculado ao Azure para sincronizar.');
        return;
      }
      let updated = 0;
      let failed = 0;
      for (const b of mine) {
        try {
          const next = await pullBugStatus(pat, b);
          if (next) {
            await updateBug(b.id, { status: next, azureSyncedAt: new Date() });
            updated++;
          }
        } catch {
          failed++;
        }
      }
      await loadBugs();
      setSyncMsg(
        `Sincronização concluída: ${updated} atualizado(s)` +
          (failed ? `, ${failed} com erro.` : '.'),
      );
    } catch (err) {
      setSyncMsg(
        err instanceof AzureError
          ? err.message
          : 'Falha ao sincronizar com o Azure DevOps.',
      );
    } finally {
      setSyncing(false);
    }
  };

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
        <p className="text-sm text-red-700 dark:text-red-300">Erro ao carregar os bugs.</p>
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Bugs</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Registro e acompanhamento de bugs do time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleSync()}
            disabled={syncing}
            title="Puxar status dos work items vinculados no Azure DevOps"
            className="flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            {syncing && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-selbetti-green" />
            )}
            {syncing ? 'Sincronizando…' : 'Sincronizar Azure'}
          </button>
          <button
            type="button"
            onClick={() => setModal({ mode: 'create' })}
            className="rounded-md bg-selbetti-green px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-selbetti-green/90"
          >
            + Novo bug
          </button>
        </div>
      </div>

      {syncMsg && (
        <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
          {syncMsg}
        </div>
      )}

      <BugTable
        bugs={bugs}
        onView={(bug) => setModal({ mode: 'view', bug })}
        onEdit={(bug) => setModal({ mode: 'edit', bug })}
        onChanged={() => void loadBugs()}
      />

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

import { useEffect, useState } from 'react';
import type { Bug } from '../types';
import { getBugs } from '../lib/db';
import BugTable from './BugTable';
import BugModal, { type BugModalMode } from './BugModal';

interface ModalState {
  mode: BugModalMode;
  bug?: Bug;
}

export default function Bugs() {
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
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

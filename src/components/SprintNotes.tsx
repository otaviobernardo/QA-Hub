import { useEffect, useState, type FormEvent } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { SprintNote } from '../types';
import {
  getSprintNotes,
  createSprintNote,
  updateSprintNote,
  deleteSprintNote,
} from '../lib/db';
import { useAuth } from '../context/AuthContext';

interface SprintNotesProps {
  /** Sprints existentes nos bugs, para o select da nova nota. */
  sprints: string[];
}

const dateFmt = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

export default function SprintNotes({ sprints }: SprintNotesProps) {
  const { user } = useAuth();
  const uid = user?.uid ?? '';
  const displayName = user?.displayName?.trim() || user?.email || 'QA';

  const [notes, setNotes] = useState<SprintNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [sprint, setSprint] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const load = async (): Promise<void> => {
    setLoading(true);
    setLoadError(false);
    try {
      setNotes(await getSprintNotes());
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  // Mantém o select coerente com as sprints disponíveis.
  useEffect(() => {
    if (sprints.length > 0 && !sprints.includes(sprint)) {
      setSprint(sprints[0]);
    }
  }, [sprints, sprint]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setFormError(null);

    if (!user) return;
    if (!sprint) {
      setFormError('Selecione uma sprint.');
      return;
    }
    if (!content.trim()) {
      setFormError('Escreva o conteúdo da observação.');
      return;
    }

    setSubmitting(true);
    try {
      await createSprintNote({
        id: uuidv4(),
        sprint,
        content: content.trim(),
        createdBy: uid,
        createdByName: displayName,
      });
      setContent('');
      await load();
    } catch {
      setFormError('Não foi possível salvar a observação. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (note: SprintNote) => {
    setEditingId(note.id);
    setEditContent(note.content);
  };

  const saveEdit = async (note: SprintNote): Promise<void> => {
    if (!editContent.trim()) return;
    try {
      await updateSprintNote(note.id, editContent.trim());
      setEditingId(null);
      await load();
    } catch {
      window.alert('Não foi possível editar a observação.');
    }
  };

  const handleDelete = async (note: SprintNote): Promise<void> => {
    if (!window.confirm('Excluir esta observação?')) return;
    try {
      await deleteSprintNote(note.id);
      await load();
    } catch {
      window.alert('Não foi possível excluir a observação.');
    }
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">
        Observações de sprint
      </h3>
      <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
        Alinhamentos com PM e DEV que fogem do que está descrito nas USs.
      </p>

      {/* Formulário de nova observação */}
      {sprints.length === 0 ? (
        <p className="mt-4 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-500 dark:bg-gray-900/50 dark:text-gray-400">
          Cadastre um bug com uma sprint para poder registrar observações.
        </p>
      ) : (
        <form onSubmit={handleCreate} className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <select
              value={sprint}
              onChange={(e) => setSprint(e.target.value)}
              className="app-select rounded-md border border-gray-300 px-2 py-2 text-sm outline-none focus:border-selbetti-green focus:ring-2 focus:ring-selbetti-green/30 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            >
              {sprints.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            placeholder="Ex: Alinhado com PM que o critério X da US Y não será implementado porque…"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-selbetti-green focus:ring-2 focus:ring-selbetti-green/30 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
          />
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-selbetti-green px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-selbetti-green/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Registrando…' : 'Registrar observação'}
          </button>
        </form>
      )}

      {/* Lista de observações */}
      <div className="mt-5 space-y-3">
        {loading ? (
          <p className="text-sm text-gray-400">Carregando observações…</p>
        ) : loadError ? (
          <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <span>Erro ao carregar observações.</span>
            <button
              type="button"
              onClick={() => void load()}
              className="font-medium underline"
            >
              Tentar de novo
            </button>
          </div>
        ) : notes.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhuma observação registrada ainda.</p>
        ) : (
          notes.map((note) => (
            <article
              key={note.id}
              className="rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/50"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-selbetti-purple/10 px-2 py-0.5 text-xs font-medium text-selbetti-purple">
                  {note.sprint}
                </span>
                {note.createdBy === uid && editingId !== note.id && (
                  <div className="flex gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => startEdit(note)}
                      className="text-gray-500 hover:text-selbetti-purple"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(note)}
                      className="text-gray-500 hover:text-red-600"
                    >
                      Excluir
                    </button>
                  </div>
                )}
              </div>

              {editingId === note.id ? (
                <div className="mt-2 space-y-2">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-selbetti-green focus:ring-2 focus:ring-selbetti-green/30 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void saveEdit(note)}
                      className="rounded-md bg-selbetti-green px-3 py-1.5 text-xs font-semibold text-white hover:bg-selbetti-green/90"
                    >
                      Salvar
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                  {note.content}
                </p>
              )}

              <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                {note.createdByName} · {dateFmt.format(note.createdAt)}
              </p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

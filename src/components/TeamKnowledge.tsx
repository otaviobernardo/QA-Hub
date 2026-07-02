import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { TeamNote, TeamNoteCategory } from '../types';
import {
  getTeamNotes,
  createTeamNote,
  updateTeamNote,
  deleteTeamNote,
} from '../lib/db';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';

const CATEGORIES: { value: TeamNoteCategory; label: string }[] = [
  { value: 'modulo', label: 'Módulo' },
  { value: 'sistema', label: 'Sistema' },
  { value: 'processo', label: 'Processo' },
  { value: 'outro', label: 'Outro' },
];

const catLabel: Record<TeamNoteCategory, string> = {
  modulo: 'Módulo',
  sistema: 'Sistema',
  processo: 'Processo',
  outro: 'Outro',
};

const catBadge: Record<TeamNoteCategory, string> = {
  modulo: 'bg-selbetti-green/15 text-selbetti-green',
  sistema: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  processo: 'bg-selbetti-orange/15 text-selbetti-orange',
  outro: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

const dateFmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' });
const ALL = 'todos';

const inputClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-selbetti-green focus:ring-2 focus:ring-selbetti-green/30 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500';

export default function TeamKnowledge() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const uid = user?.uid ?? '';
  const displayName = user?.displayName?.trim() || user?.email || 'QA';

  const [notes, setNotes] = useState<TeamNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [cat, setCat] = useState<TeamNoteCategory | typeof ALL>(ALL);
  const [search, setSearch] = useState('');

  // Formulário de nova nota
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TeamNoteCategory>('modulo');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Edição inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState<TeamNoteCategory>('modulo');
  const [editContent, setEditContent] = useState('');

  const load = async (): Promise<void> => {
    setLoading(true);
    setLoadError(false);
    try {
      setNotes(await getTeamNotes());
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return notes.filter((n) => {
      if (cat !== ALL && n.category !== cat) return false;
      if (term) {
        const haystack = `${n.title} ${n.content}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [notes, cat, search]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setFormError(null);
    if (!user) return;
    if (!title.trim() || !content.trim()) {
      setFormError('Preencha o título e o conteúdo.');
      return;
    }
    setSubmitting(true);
    try {
      await createTeamNote({
        id: uuidv4(),
        title: title.trim(),
        category,
        content: content.trim(),
        createdBy: uid,
        createdByName: displayName,
      });
      setTitle('');
      setContent('');
      await load();
    } catch {
      setFormError('Não foi possível salvar. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (note: TeamNote) => {
    setEditingId(note.id);
    setEditTitle(note.title);
    setEditCategory(note.category);
    setEditContent(note.content);
  };

  const saveEdit = async (note: TeamNote): Promise<void> => {
    if (!editTitle.trim() || !editContent.trim()) return;
    try {
      await updateTeamNote(note.id, {
        title: editTitle.trim(),
        category: editCategory,
        content: editContent.trim(),
      });
      setEditingId(null);
      await load();
    } catch {
      showToast('Não foi possível editar a nota.', 'error');
    }
  };

  const handleDelete = async (note: TeamNote): Promise<void> => {
    const ok = await confirm({
      title: 'Excluir nota',
      message: `Excluir "${note.title}"?`,
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar',
      tone: 'red',
    });
    if (!ok) return;
    try {
      await deleteTeamNote(note.id);
      await load();
    } catch {
      showToast('Não foi possível excluir a nota.', 'error');
    }
  };

  return (
    <div className="space-y-5">
      {/* Formulário de nova nota */}
      <form
        onSubmit={handleCreate}
        className="space-y-3 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
      >
        <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">
          Adicionar conhecimento
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Compartilhe com o time como testar um módulo, configurar um sistema,
          dados de teste, etc.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título (ex: Como testar o módulo SmartShare)"
            className={`${inputClass} flex-1`}
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as TeamNoteCategory)}
            className="app-select rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-selbetti-green focus:ring-2 focus:ring-selbetti-green/30 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          placeholder="Passo a passo, observações, links…"
          className={inputClass}
        />
        {formError && <p className="text-sm text-red-600">{formError}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-selbetti-green px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-selbetti-green/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Salvando…' : 'Compartilhar'}
        </button>
      </form>

      {/* Filtros */}
      <div className="space-y-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar no conhecimento do time…"
          className={inputClass}
        />
        <div className="flex flex-wrap gap-2">
          <CatChip active={cat === ALL} onClick={() => setCat(ALL)}>
            Todos
          </CatChip>
          {CATEGORIES.map((c) => (
            <CatChip
              key={c.value}
              active={cat === c.value}
              onClick={() => setCat(c.value)}
            >
              {c.label}
            </CatChip>
          ))}
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <p className="text-sm text-gray-400">Carregando…</p>
      ) : loadError ? (
        <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          <span>Erro ao carregar o conhecimento do time.</span>
          <button type="button" onClick={() => void load()} className="font-medium underline">
            Tentar de novo
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400">
          Nenhum conhecimento registrado ainda.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((note) => (
            <article
              key={note.id}
              className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
            >
              {editingId === note.id ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className={`${inputClass} flex-1`}
                    />
                    <select
                      value={editCategory}
                      onChange={(e) =>
                        setEditCategory(e.target.value as TeamNoteCategory)
                      }
                      className="app-select rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-selbetti-green dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={4}
                    className={inputClass}
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
                      className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${catBadge[note.category]}`}
                      >
                        {catLabel[note.category]}
                      </span>
                      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        {note.title}
                      </h3>
                    </div>
                    {note.createdBy === uid && (
                      <div className="flex gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => startEdit(note)}
                          className="text-gray-500 hover:text-selbetti-purple dark:text-gray-400"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(note)}
                          className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                        >
                          Excluir
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                    {note.content}
                  </p>
                  <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                    {note.createdByName} · atualizado em {dateFmt.format(note.updatedAt)}
                  </p>
                </>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function CatChip({
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
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'border-selbetti-green bg-selbetti-green/15 text-selbetti-green'
          : 'border-gray-300 bg-white text-gray-600 hover:border-selbetti-green dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-selbetti-green'
      }`}
    >
      {children}
    </button>
  );
}

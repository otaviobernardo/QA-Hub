import { useState, type FormEvent } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type {
  Bug,
  Severity,
  Priority,
  BugStatus,
  Environment,
} from '../types';
import { createBug, updateBug, getUserProfile } from '../lib/db';
import { useAuth } from '../context/AuthContext';
import { AzureError } from '../lib/azure';
import { createBugTasks } from '../lib/bugAzure';
import {
  SEVERITIES,
  PRIORITIES,
  STATUSES,
  ENVIRONMENTS,
  VM_OPTIONS,
  severityBadge,
  statusBadge,
  priorityBadge,
} from '../lib/bugOptions';

export type BugModalMode = 'view' | 'create' | 'edit';

interface BugModalProps {
  mode: BugModalMode;
  bug?: Bug; // obrigatório em "view" e "edit"
  /** Valores iniciais no modo "create" (ex.: bug aberto a partir de um caso). */
  initial?: Partial<FormState>;
  /** Vínculo de origem gravado no bug (caso de teste / US) no modo "create". */
  link?: { caseId: string; caseTitulo?: string; azureCardId?: string };
  onClose: () => void;
  onSaved: () => void; // chamado após criar/editar com sucesso
  /** Chamado com o id do bug recém-criado (para vincular no caso de origem). */
  onCreated?: (bugId: string) => void;
}

interface FormState {
  title: string;
  module: string;
  sprint: string;
  severity: Severity;
  priority: Priority;
  environment: Environment;
  status: BugStatus;
  description: string;
  evidence: string;
  assignee: string;
  vm: string;
  azureCardId: string; // PBI/US pai no Azure (para abrir os cards BUG/CR/Teste)
}

const REQUIRED_FIELDS: (keyof FormState)[] = [
  'title',
  'module',
  'sprint',
  'assignee',
  'description',
];

function initialForm(
  bug?: Bug,
  defaultAssignee?: string,
  initial?: Partial<FormState>,
): FormState {
  return {
    title: initial?.title ?? bug?.title ?? '',
    module: initial?.module ?? bug?.module ?? '',
    sprint: initial?.sprint ?? bug?.sprint ?? '',
    severity: initial?.severity ?? bug?.severity ?? 'Médio',
    priority: initial?.priority ?? bug?.priority ?? 'Média',
    environment: initial?.environment ?? bug?.environment ?? 'Homologação',
    status: initial?.status ?? bug?.status ?? 'Aberto',
    description: initial?.description ?? bug?.description ?? '',
    evidence: initial?.evidence ?? bug?.evidence ?? '',
    assignee: initial?.assignee ?? bug?.assignee ?? defaultAssignee ?? '',
    vm: initial?.vm ?? bug?.vm ?? '',
    azureCardId: initial?.azureCardId ?? bug?.azureCardId ?? '',
  };
}

export default function BugModal({
  mode,
  bug,
  initial,
  link,
  onClose,
  onSaved,
  onCreated,
}: BugModalProps) {
  const { user } = useAuth();
  const displayName = user?.displayName?.trim() || user?.email || '';
  const [form, setForm] = useState<FormState>(() => {
    const f = initialForm(bug, mode === 'create' ? displayName : undefined, initial);
    // PBI pai vindo do caso de teste (fluxo Falhou → abrir bug).
    if (!f.azureCardId && link?.azureCardId) f.azureCardId = link.azureCardId;
    return f;
  });
  const [errors, setErrors] = useState<Set<keyof FormState>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Id do bug já criado no Firestore — evita duplicar ao re-tentar os cards do Azure.
  const [createdBugId, setCreatedBugId] = useState<string | null>(null);

  const isView = mode === 'view';

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors.has(key)) {
      setErrors((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const missing = new Set<keyof FormState>();
    for (const field of REQUIRED_FIELDS) {
      if (!form[field].trim()) missing.add(field);
    }
    setErrors(missing);
    return missing.size === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSaveError(null);
    if (!user) return;
    if (!validate()) return;

    const parent = form.azureCardId.trim();
    if (parent && !/^\d+$/.test(parent)) {
      setSaveError('O ID do PBI/US pai deve ser numérico (ex: 151171).');
      return;
    }

    setSaving(true);
    const vmValue =
      form.environment === 'Homologação' && form.vm ? form.vm : undefined;

    // Edição: só atualiza e fecha.
    if (mode === 'edit' && bug) {
      try {
        await updateBug(bug.id, { ...form, vm: vmValue });
        onSaved();
        onClose();
      } catch {
        setSaveError('Não foi possível salvar o bug. Tente novamente.');
        setSaving(false);
      }
      return;
    }

    // Criação — 1) grava no Firestore (só na primeira vez).
    const id = createdBugId ?? uuidv4();
    if (!createdBugId) {
      try {
        await createBug({
          id,
          ...form,
          vm: vmValue,
          azureCardId: parent || undefined,
          linkedCaseId: link?.caseId,
          linkedCaseTitulo: link?.caseTitulo,
          createdBy: user.uid,
          createdByName: user.displayName?.trim() || user.email || '',
        });
        onCreated?.(id);
        setCreatedBugId(id);
        onSaved();
      } catch {
        setSaveError('Não foi possível salvar o bug. Tente novamente.');
        setSaving(false);
        return;
      }
    }

    // 2) Abre os cards no Azure (BUG/CR/Teste) sob o PBI pai. Best-effort.
    if (!parent) {
      onClose(); // sem PBI pai: não cria nada no Azure.
      return;
    }
    try {
      const profile = await getUserProfile(user.uid);
      const pat = profile?.azurePat?.trim();
      if (!pat) {
        setSaveError(
          'Bug salvo. Para abrir os cards BUG/CR/Teste no Azure, configure seu PAT em Configurações.',
        );
        setSaving(false);
        return;
      }
      await createBugTasks(pat, Number(parent), form.title.trim());
      onClose();
    } catch (err) {
      setSaveError(
        `Bug salvo, mas falhou ao abrir os cards no Azure: ${
          err instanceof AzureError ? err.message : 'erro inesperado.'
        } Você pode fechar ou tentar de novo.`,
      );
      setSaving(false);
    }
  };

  const title =
    mode === 'create'
      ? 'Novo bug'
      : mode === 'edit'
        ? 'Editar bug'
        : 'Detalhes do bug';

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="my-8 w-full max-w-2xl rounded-xl bg-white shadow-xl dark:bg-gray-800">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isView ? (
          <ViewBody bug={bug!} />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5" noValidate>
            <Field label="Título" required error={errors.has('title')}>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setField('title', e.target.value)}
                className={inputClass(errors.has('title'))}
              />
            </Field>

            {mode === 'create' && (
              <Field label="PBI/US pai no Azure (opcional)">
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.azureCardId}
                  onChange={(e) => setField('azureCardId', e.target.value)}
                  placeholder="Ex: 151171 — abre os cards BUG | / CR | / Teste | sob essa US"
                  className={inputClass(false)}
                />
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  Se preenchido (e com PAT configurado), ao salvar são criadas 3
                  Tasks no Azure (BUG, CR e Teste) em New e sem dono, sob essa US.
                </p>
              </Field>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Módulo" required error={errors.has('module')}>
                <input
                  type="text"
                  value={form.module}
                  onChange={(e) => setField('module', e.target.value)}
                  className={inputClass(errors.has('module'))}
                />
              </Field>
              <Field label="Sprint" required error={errors.has('sprint')}>
                <input
                  type="text"
                  value={form.sprint}
                  onChange={(e) => setField('sprint', e.target.value)}
                  placeholder="Ex: Sprint 24"
                  className={inputClass(errors.has('sprint'))}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Responsável" required error={errors.has('assignee')}>
                <input
                  type="text"
                  value={form.assignee}
                  onChange={(e) => setField('assignee', e.target.value)}
                  className={inputClass(errors.has('assignee'))}
                />
              </Field>
              <Field label="Ambiente">
                <select
                  value={form.environment}
                  onChange={(e) => {
                    const env = e.target.value as Environment;
                    setForm((prev) => ({ ...prev, environment: env, vm: '' }));
                  }}
                  className={`${inputClass(false)} app-select`}
                >
                  {ENVIRONMENTS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {form.environment === 'Homologação' && (
              <Field label="VM">
                <select
                  value={form.vm}
                  onChange={(e) => setField('vm', e.target.value)}
                  className={`${inputClass(false)} app-select`}
                >
                  <option value="">Selecione a VM</option>
                  {VM_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Severidade">
                <select
                  value={form.severity}
                  onChange={(e) => setField('severity', e.target.value as Severity)}
                  className={`${inputClass(false)} app-select`}
                >
                  {SEVERITIES.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Prioridade">
                <select
                  value={form.priority}
                  onChange={(e) => setField('priority', e.target.value as Priority)}
                  className={`${inputClass(false)} app-select`}
                >
                  {PRIORITIES.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select
                  value={form.status}
                  onChange={(e) => setField('status', e.target.value as BugStatus)}
                  className={`${inputClass(false)} app-select`}
                >
                  {STATUSES.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Descrição" required error={errors.has('description')}>
              <textarea
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                rows={4}
                className={inputClass(errors.has('description'))}
              />
            </Field>

            <Field label="Evidência">
              <textarea
                value={form.evidence}
                onChange={(e) => setField('evidence', e.target.value)}
                rows={2}
                placeholder="Links, prints ou passos para reproduzir"
                className={inputClass(false)}
              />
            </Field>

            {errors.size > 0 && (
              <p className="text-sm text-red-600">
                Preencha os campos obrigatórios destacados.
              </p>
            )}
            {saveError && (
              <div
                role="alert"
                className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
              >
                {saveError}
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-700">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {createdBugId ? 'Fechar' : 'Cancelar'}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-selbetti-green px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-selbetti-green/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? 'Salvando…'
                  : createdBugId
                    ? 'Tentar abrir cards no Azure'
                    : mode === 'create'
                      ? 'Criar bug'
                      : 'Salvar alterações'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function inputClass(hasError: boolean): string {
  const base =
    'w-full rounded-md border px-3 py-2 text-sm outline-none transition-colors focus:ring-2 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500';
  return hasError
    ? `${base} border-red-400 focus:border-red-500 focus:ring-red-200 dark:border-red-500/50`
    : `${base} border-gray-300 focus:border-selbetti-green focus:ring-selbetti-green/30 dark:border-gray-600`;
}

function Field({
  label,
  required = false,
  error = false,
  children,
}: {
  label: string;
  required?: boolean;
  error?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
        {error && (
          <span className="ml-2 text-xs font-normal text-red-600">obrigatório</span>
        )}
      </label>
      {children}
    </div>
  );
}

function ViewBody({ bug }: { bug: Bug }) {
  const dateFmt = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  return (
    <div className="space-y-4 px-6 py-5">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{bug.title}</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${severityBadge[bug.severity]}`}>
            {bug.severity}
          </span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${priorityBadge[bug.priority]}`}>
            Prioridade {bug.priority}
          </span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge[bug.status]}`}>
            {bug.status}
          </span>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <Info label="Módulo" value={bug.module} />
        <Info label="Sprint" value={bug.sprint} />
        <Info label="Ambiente" value={bug.environment} />
        {bug.environment === 'Homologação' && (
          <Info label="VM" value={bug.vm || '—'} />
        )}
        <Info label="Responsável" value={bug.assignee} />
        <Info label="Registrado por" value={bug.createdByName || '—'} />
        <Info label="Criado em" value={dateFmt.format(bug.createdAt)} />
        <Info label="Atualizado em" value={dateFmt.format(bug.updatedAt)} />
      </dl>

      <div>
        <dt className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
          Descrição
        </dt>
        <dd className="mt-1 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
          {bug.description || '—'}
        </dd>
      </div>

      <div>
        <dt className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
          Evidência
        </dt>
        <dd className="mt-1 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
          {bug.evidence || '—'}
        </dd>
      </div>

      <p className="border-t border-gray-100 pt-3 text-xs text-gray-400 dark:border-gray-700 dark:text-gray-500">
        ID: {bug.id}
      </p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
        {label}
      </dt>
      <dd className="mt-0.5 text-gray-800 dark:text-gray-200">{value || '—'}</dd>
    </div>
  );
}

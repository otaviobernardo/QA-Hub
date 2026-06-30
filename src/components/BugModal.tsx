import { useRef, useState, type FormEvent } from 'react';
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
import { pushNewBug, pushBugStatus } from '../lib/bugSync';
import {
  SEVERITIES,
  PRIORITIES,
  STATUSES,
  ENVIRONMENTS,
  ENV_DETAIL_META,
  severityBadge,
  statusBadge,
  priorityBadge,
} from '../lib/bugOptions';

export type BugModalMode = 'view' | 'create' | 'edit';

interface BugModalProps {
  mode: BugModalMode;
  bug?: Bug; // obrigatório em "view" e "edit"
  onClose: () => void;
  onSaved: () => void; // chamado após criar/editar com sucesso
}

interface FormState {
  title: string;
  module: string;
  sprint: string;
  severity: Severity;
  priority: Priority;
  environment: Environment;
  environmentDetail: string;
  status: BugStatus;
  description: string;
  evidence: string;
}

const REQUIRED_FIELDS: (keyof FormState)[] = [
  'title',
  'module',
  'sprint',
  'description',
];

function initialForm(bug?: Bug): FormState {
  return {
    title: bug?.title ?? '',
    module: bug?.module ?? '',
    sprint: bug?.sprint ?? '',
    severity: bug?.severity ?? 'Médio',
    priority: bug?.priority ?? 'Média',
    environment: bug?.environment ?? 'Homologação',
    environmentDetail: bug?.environmentDetail ?? '',
    status: bug?.status ?? 'Aberto',
    description: bug?.description ?? '',
    evidence: bug?.evidence ?? '',
  };
}

export default function BugModal({ mode, bug, onClose, onSaved }: BugModalProps) {
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(initialForm(bug));
  const [parentPbi, setParentPbi] = useState<string>(
    bug?.azureParentId ? String(bug.azureParentId) : '',
  );
  const [errors, setErrors] = useState<Set<keyof FormState>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Sincronização com o Azure (best-effort): aviso não-bloqueante.
  const [azureWarn, setAzureWarn] = useState<string | null>(null);
  // Marca que o bug já foi salvo no Firestore (evita duplicar ao re-tentar o sync).
  const [savedToDb, setSavedToDb] = useState(false);
  // Id estável do documento (mesmo entre re-tentativas de sincronização).
  const idRef = useRef(bug?.id ?? uuidv4());

  const isView = mode === 'view';
  // Responsável automático: nome de quem está cadastrando (não editável).
  const currentUserName = user?.displayName?.trim() || user?.email || 'QA';
  // Em edição, mantém quem registrou; em criação, é o usuário atual.
  const responsavel = mode === 'edit' ? (bug?.assignee ?? currentUserName) : currentUserName;

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
    setAzureWarn(null);
    if (!user) return;
    if (!validate()) return;

    const parentRaw = parentPbi.trim();
    if (parentRaw && !/^\d+$/.test(parentRaw)) {
      setSaveError('O ID do PBI pai deve ser numérico (ex: 12345).');
      return;
    }
    const parsedParent = parentRaw ? Number(parentRaw) : undefined;

    setSaving(true);
    const id = idRef.current;

    // 1) Persiste no Firestore (fonte da verdade). Só na primeira vez.
    if (!savedToDb) {
      try {
        if (mode === 'create') {
          await createBug({
            id,
            ...form,
            assignee: responsavel,
            azureParentId: parsedParent,
            createdBy: user.uid,
          });
        } else if (mode === 'edit' && bug) {
          await updateBug(id, {
            ...form,
            assignee: responsavel,
            azureParentId: parsedParent,
          });
        }
        setSavedToDb(true);
        onSaved();
      } catch {
        setSaveError('Não foi possível salvar o bug. Tente novamente.');
        setSaving(false);
        return;
      }
    }

    // 2) Sincroniza com o Azure (best-effort). Sem PAT, apenas fecha.
    try {
      const profile = await getUserProfile(user.uid);
      const pat = profile?.azurePat?.trim();
      if (!pat) {
        onClose();
        return;
      }

      const existingWorkItemId = bug?.azureWorkItemId;
      if (existingWorkItemId) {
        // Já vinculado: empurra o status atual e marca o sync.
        await pushBugStatus(pat, existingWorkItemId, form.status);
        await updateBug(id, { azureSyncedAt: new Date() });
      } else {
        // Sem vínculo: cria a Task "BUG | ..." no Azure e grava o vínculo.
        const bugForAzure: Bug = {
          id,
          ...form,
          assignee: responsavel,
          azureParentId: parsedParent,
          createdBy: bug?.createdBy ?? user.uid,
          createdAt: bug?.createdAt ?? new Date(),
          updatedAt: new Date(),
        };
        const link = await pushNewBug(pat, bugForAzure);
        await updateBug(id, link);
      }
      onSaved();
      onClose();
    } catch (err) {
      const msg =
        err instanceof AzureError
          ? err.message
          : 'Falha ao sincronizar com o Azure DevOps.';
      setAzureWarn(msg);
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
              <Field label="Ambiente">
                <select
                  value={form.environment}
                  onChange={(e) =>
                    setField('environment', e.target.value as Environment)
                  }
                  className={`${inputClass(false)} app-select`}
                >
                  {ENVIRONMENTS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={ENV_DETAIL_META[form.environment].label}>
                <input
                  type="text"
                  value={form.environmentDetail}
                  onChange={(e) => setField('environmentDetail', e.target.value)}
                  placeholder={ENV_DETAIL_META[form.environment].placeholder}
                  className={inputClass(false)}
                />
              </Field>
            </div>

            <Field label="Responsável">
              <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-200">
                <span className="font-medium">{responsavel}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  (preenchido automaticamente)
                </span>
              </div>
            </Field>

            <Field label="PBI pai no Azure (opcional)">
              <input
                type="text"
                inputMode="numeric"
                value={parentPbi}
                onChange={(e) => setParentPbi(e.target.value)}
                placeholder="Ex: 12345 — a Task 'BUG | …' será criada como filha desse PBI"
                disabled={Boolean(bug?.azureWorkItemId)}
                className={`${inputClass(false)} disabled:opacity-60`}
              />
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                {bug?.azureWorkItemId
                  ? `Vinculado ao work item #${bug.azureWorkItemId}.`
                  : 'Se você tiver um PAT configurado, ao salvar criamos a Task no Azure. Sem PBI pai, ela é criada sem vínculo.'}
              </p>
            </Field>

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
            {azureWarn && (
              <div
                role="alert"
                className="rounded-md border border-selbetti-orange/40 bg-selbetti-orange/10 px-3 py-2 text-sm text-gray-700 dark:text-gray-200"
              >
                <span className="font-semibold">Bug salvo</span>, mas não
                sincronizou com o Azure: {azureWarn} Você pode fechar e tentar de
                novo depois, ou repetir agora.
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-700">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {savedToDb ? 'Fechar' : 'Cancelar'}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-selbetti-green px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-selbetti-green/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? 'Salvando…'
                  : savedToDb
                    ? 'Tentar sincronizar de novo'
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
        <Info
          label={ENV_DETAIL_META[bug.environment].label}
          value={bug.environmentDetail}
        />
        <Info label="Responsável" value={bug.assignee} />
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

      {bug.azureWorkItemId && (
        <div className="border-t border-gray-100 pt-3 dark:border-gray-700">
          <dt className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Azure DevOps
          </dt>
          <dd className="mt-1 text-sm">
            {bug.azureUrl ? (
              <a
                href={bug.azureUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-selbetti-purple underline hover:opacity-80"
              >
                Abrir Task #{bug.azureWorkItemId}
              </a>
            ) : (
              <span className="text-gray-700 dark:text-gray-300">
                Work item #{bug.azureWorkItemId}
              </span>
            )}
            {bug.azureSyncedAt && (
              <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                · sincronizado em {dateFmt.format(bug.azureSyncedAt)}
              </span>
            )}
          </dd>
        </div>
      )}

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

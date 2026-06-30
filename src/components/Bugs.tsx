import { useEffect, useState, type FormEvent } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Bug, Severity, Priority, BugStatus, Environment } from '../types';
import { getBugs, createBug } from '../lib/db';
import { useAuth } from '../context/AuthContext';
import {
  SEVERITIES,
  PRIORITIES,
  STATUSES,
  ENVIRONMENTS,
  VM_OPTIONS,
} from '../lib/bugOptions';
import BugTable from './BugTable';
import BugModal, { type BugModalMode } from './BugModal';

type Tab = 'register' | 'list';

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
}

const REQUIRED_FIELDS: (keyof FormState)[] = [
  'title',
  'module',
  'sprint',
  'assignee',
  'description',
];

function emptyForm(): FormState {
  return {
    title: '',
    module: '',
    sprint: '',
    severity: 'Médio',
    priority: 'Média',
    environment: 'Homologação',
    status: 'Aberto',
    description: '',
    evidence: '',
    assignee: '',
    vm: '',
  };
}

export default function Bugs() {
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [tab, setTab] = useState<Tab>('register');
  const [modal, setModal] = useState<{ mode: BugModalMode; bug?: Bug } | null>(null);

  const load = async (): Promise<void> => {
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
    void load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Bugs</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Registre e acompanhe os bugs encontrados durante os testes.
        </p>
      </div>

      {/* Sub-abas */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        <TabBtn active={tab === 'register'} onClick={() => setTab('register')}>
          Registrar bug
        </TabBtn>
        <TabBtn active={tab === 'list'} onClick={() => setTab('list')}>
          Lista de bugs
        </TabBtn>
      </div>

      {tab === 'register' && (
        <RegisterForm
          onSaved={async () => {
            await load();
            setTab('list');
          }}
        />
      )}

      {tab === 'list' && (
        <div className="space-y-4">
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
              <p className="text-sm text-red-700 dark:text-red-300">Erro ao carregar os bugs.</p>
              <button
                type="button"
                onClick={() => void load()}
                className="mt-3 rounded-md bg-selbetti-green px-4 py-2 text-sm font-semibold text-white hover:bg-selbetti-green/90"
              >
                Tentar novamente
              </button>
            </div>
          ) : (
            <BugTable
              bugs={bugs}
              onView={(bug) => setModal({ mode: 'view', bug })}
              onEdit={(bug) => setModal({ mode: 'edit', bug })}
              onChanged={() => void load()}
            />
          )}
        </div>
      )}

      {modal && (
        <BugModal
          mode={modal.mode}
          bug={modal.bug}
          onClose={() => setModal(null)}
          onSaved={() => void load()}
        />
      )}
    </div>
  );
}

/* -------------------- Sub-aba: Registrar bug -------------------- */

function RegisterForm({ onSaved }: { onSaved: () => Promise<void> }) {
  const { user } = useAuth();
  const displayName = user?.displayName?.trim() || user?.email || 'QA';

  const [form, setForm] = useState<FormState>({ ...emptyForm(), assignee: displayName });
  const [errors, setErrors] = useState<Set<keyof FormState>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors.has(key)) {
      setErrors((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
    if (success) setSuccess(false);
  };

  const validate = (): boolean => {
    const missing = new Set<keyof FormState>();
    for (const field of REQUIRED_FIELDS) {
      if (!form[field].trim()) missing.add(field);
    }
    setErrors(missing);
    return missing.size === 0;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setSaveError(null);
    if (!user) return;
    if (!validate()) return;

    setSaving(true);
    try {
      await createBug({
        id: uuidv4(),
        ...form,
        vm: form.environment === 'Homologação' && form.vm ? form.vm : undefined,
        createdBy: user.uid,
        createdByName: displayName,
      });
      setForm(emptyForm());
      setErrors(new Set());
      setSuccess(true);
      await onSaved();
    } catch {
      setSaveError('Não foi possível salvar o bug. Tente novamente.');
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-100 px-6 py-4 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">
            Novo bug
          </h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Registrado por:{' '}
            <span className="font-medium text-gray-700 dark:text-gray-200">{displayName}</span>
          </p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 px-6 py-5" noValidate>
          <Field label="Título" required error={errors.has('title')}>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              placeholder="Ex: Botão de salvar não funciona na tela de edição"
              className={inputClass(errors.has('title'))}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Módulo" required error={errors.has('module')}>
              <input
                type="text"
                value={form.module}
                onChange={(e) => setField('module', e.target.value)}
                placeholder="Ex: Cadastro de clientes"
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
                placeholder="Nome do QA responsável"
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
              placeholder="Descreva o comportamento incorreto observado e o comportamento esperado"
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
            <p className="text-sm text-red-600 dark:text-red-400">
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
          {success && (
            <div
              role="status"
              className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300"
            >
              Bug registrado com sucesso! Redirecionando para a lista…
            </div>
          )}

          <div className="flex justify-end border-t border-gray-100 pt-4 dark:border-gray-700">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-selbetti-green px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-selbetti-green/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Registrando…' : 'Registrar bug'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* -------------------- Helpers -------------------- */

function TabBtn({
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
          <span className="ml-2 text-xs font-normal text-red-600 dark:text-red-400">
            obrigatório
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

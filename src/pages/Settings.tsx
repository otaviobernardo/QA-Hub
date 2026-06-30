import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  updateApiKey,
  removeApiKey,
  updateAzurePat,
  removeAzurePat,
} from '../lib/db';
import { PROVIDERS, type ProviderDef } from '../lib/providers';
import { readWorkItem, field, AzureError } from '../lib/azure';

export default function Settings() {
  const { apiKeys } = useAuth();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
        Configurações
      </h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Configure a chave de um ou mais provedores de IA. Cada chave é pessoal,
        fica salva apenas no seu perfil e não é compartilhada com outros QAs. No
        gerador você escolhe qual provedor usar.
      </p>

      <div className="mt-6 space-y-3">
        {PROVIDERS.map((provider) => (
          <ProviderKeyRow
            key={provider.id}
            provider={provider}
            currentKey={apiKeys[provider.id]}
          />
        ))}
      </div>

      <h2 className="mt-8 text-lg font-bold text-gray-800 dark:text-gray-100">
        Azure DevOps
      </h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Seu Personal Access Token (escopo Work Items – Read &amp; write). Usado
        para ler/mover/comentar/criar cards. Fica só no seu perfil.
      </p>
      <div className="mt-3">
        <AzureSection />
      </div>
    </div>
  );
}

type RowStatus = 'idle' | 'saving' | 'saved' | 'removing' | 'error';

function ProviderKeyRow({
  provider,
  currentKey,
}: {
  provider: ProviderDef;
  currentKey?: string;
}) {
  const { user, refreshKeys } = useAuth();
  const [value, setValue] = useState('');
  const [reveal, setReveal] = useState(false);
  const [status, setStatus] = useState<RowStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const configured = Boolean(currentKey);

  useEffect(() => {
    setValue(currentKey ?? '');
  }, [currentKey]);

  const handleSave = async (): Promise<void> => {
    setError(null);
    if (!user) return;
    const trimmed = value.trim();
    if (!trimmed) {
      setStatus('error');
      setError('Informe uma chave válida.');
      return;
    }
    setStatus('saving');
    try {
      await updateApiKey(user.uid, provider.id, trimmed);
      await refreshKeys();
      setStatus('saved');
      window.setTimeout(() => setStatus('idle'), 2500);
    } catch {
      setStatus('error');
      setError('Não foi possível salvar. Tente novamente.');
    }
  };

  const handleRemove = async (): Promise<void> => {
    if (!user) return;
    setStatus('removing');
    setError(null);
    try {
      await removeApiKey(user.uid, provider.id);
      await refreshKeys();
      setValue('');
      setStatus('idle');
    } catch {
      setStatus('error');
      setError('Não foi possível remover. Tente novamente.');
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          {provider.label}
        </span>
        {provider.freeTier && (
          <span className="rounded-full bg-selbetti-green/15 px-2 py-0.5 text-xs font-medium text-selbetti-green">
            tier gratuito
          </span>
        )}
        <span
          className={`ml-auto text-xs font-medium ${
            configured
              ? 'text-selbetti-green'
              : 'text-gray-400 dark:text-gray-500'
          }`}
        >
          {configured ? 'Configurada' : 'Não configurada'}
        </span>
      </div>

      <div className="flex gap-2">
        <input
          type={reveal ? 'text' : 'password'}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (status !== 'idle') setStatus('idle');
          }}
          autoComplete="off"
          spellCheck={false}
          disabled={status === 'saving' || status === 'removing'}
          placeholder={provider.keyHint}
          className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm outline-none transition-colors focus:border-selbetti-green focus:ring-2 focus:ring-selbetti-green/30 disabled:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500 dark:disabled:bg-gray-800"
        />
        <button
          type="button"
          onClick={() => setReveal((v) => !v)}
          className="shrink-0 rounded-md border border-gray-300 px-3 text-sm text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          aria-pressed={reveal}
        >
          {reveal ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>

      {status === 'error' && error && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={status === 'saving' || status === 'removing'}
          className="rounded-md bg-selbetti-green px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-selbetti-green/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === 'saving' ? 'Salvando…' : configured ? 'Atualizar' : 'Salvar'}
        </button>
        {configured && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={status === 'saving' || status === 'removing'}
            className="text-sm font-medium text-gray-500 transition-colors hover:text-red-600 disabled:opacity-50 dark:text-gray-400 dark:hover:text-red-400"
          >
            {status === 'removing' ? 'Removendo…' : 'Remover'}
          </button>
        )}
        {status === 'saved' && (
          <span className="text-sm font-medium text-selbetti-green">Salva!</span>
        )}
        <a
          href={provider.keysUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-xs text-gray-400 underline hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
        >
          Obter chave
        </a>
      </div>
    </div>
  );
}

type AzureStatus = 'idle' | 'saving' | 'saved' | 'removing' | 'error';

function AzureSection() {
  const { user, azurePat, refreshKeys } = useAuth();
  const [pat, setPat] = useState('');
  const [reveal, setReveal] = useState(false);
  const [status, setStatus] = useState<AzureStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const [workItemId, setWorkItemId] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const configured = Boolean(azurePat);

  useEffect(() => {
    setPat(azurePat ?? '');
  }, [azurePat]);

  const handleSave = async (): Promise<void> => {
    setError(null);
    if (!user) return;
    const trimmed = pat.trim();
    if (!trimmed) {
      setStatus('error');
      setError('Informe um PAT válido.');
      return;
    }
    setStatus('saving');
    try {
      await updateAzurePat(user.uid, trimmed);
      await refreshKeys();
      setStatus('saved');
      window.setTimeout(() => setStatus('idle'), 2500);
    } catch {
      setStatus('error');
      setError('Não foi possível salvar. Tente novamente.');
    }
  };

  const handleRemove = async (): Promise<void> => {
    if (!user) return;
    setStatus('removing');
    setError(null);
    try {
      await removeAzurePat(user.uid);
      await refreshKeys();
      setPat('');
      setStatus('idle');
    } catch {
      setStatus('error');
      setError('Não foi possível remover. Tente novamente.');
    }
  };

  const handleTest = async (): Promise<void> => {
    setTestResult(null);
    setTestError(null);
    const id = workItemId.trim();
    if (!id) {
      setTestError('Informe o ID de um card para testar.');
      return;
    }
    setTesting(true);
    try {
      const item = await readWorkItem(pat.trim(), id);
      const titulo = field(item, 'System.Title');
      const estado = field(item, 'System.State');
      const tipo = field(item, 'System.WorkItemType');
      setTestResult(`#${item.id} · ${tipo} · ${estado} — ${titulo}`);
    } catch (e) {
      setTestError(
        e instanceof AzureError ? e.message : 'Falha ao ler o card. Tente novamente.',
      );
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          Personal Access Token
        </span>
        <span
          className={`text-xs font-medium ${
            configured ? 'text-selbetti-green dark:text-green-400' : 'text-gray-400 dark:text-gray-500'
          }`}
        >
          {configured ? 'Configurado' : 'Não configurado'}
        </span>
      </div>

      <div className="flex gap-2">
        <input
          type={reveal ? 'text' : 'password'}
          value={pat}
          onChange={(e) => {
            setPat(e.target.value);
            if (status !== 'idle') setStatus('idle');
          }}
          autoComplete="off"
          spellCheck={false}
          disabled={status === 'saving' || status === 'removing'}
          placeholder="cole aqui o PAT do Azure DevOps"
          className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm outline-none transition-colors focus:border-selbetti-green focus:ring-2 focus:ring-selbetti-green/30 disabled:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500 dark:disabled:bg-gray-800"
        />
        <button
          type="button"
          onClick={() => setReveal((v) => !v)}
          className="shrink-0 rounded-md border border-gray-300 px-3 text-sm text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          aria-pressed={reveal}
        >
          {reveal ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>

      {status === 'error' && error && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={status === 'saving' || status === 'removing'}
          className="rounded-md bg-selbetti-green px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-selbetti-green/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === 'saving' ? 'Salvando…' : configured ? 'Atualizar' : 'Salvar'}
        </button>
        {configured && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={status === 'saving' || status === 'removing'}
            className="text-sm font-medium text-gray-500 transition-colors hover:text-red-600 disabled:opacity-50 dark:text-gray-400 dark:hover:text-red-400"
          >
            {status === 'removing' ? 'Removendo…' : 'Remover'}
          </button>
        )}
        {status === 'saved' && (
          <span className="text-sm font-medium text-selbetti-green dark:text-green-400">
            Salvo!
          </span>
        )}
      </div>

      {/* Teste de conexão */}
      <div className="mt-5 border-t border-gray-100 pt-4 dark:border-gray-700">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
          Testar conexão — ler um card
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={workItemId}
            onChange={(e) => setWorkItemId(e.target.value)}
            placeholder="ID do work item (ex: 153148)"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-selbetti-green focus:ring-2 focus:ring-selbetti-green/30 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
          />
          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            className="shrink-0 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            {testing ? 'Lendo…' : 'Ler card'}
          </button>
        </div>
        {testResult && (
          <p className="mt-2 rounded-md bg-selbetti-green/10 px-3 py-2 text-sm text-gray-700 dark:text-gray-200">
            ✓ {testResult}
          </p>
        )}
        {testError && (
          <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
            {testError}
          </p>
        )}
      </div>
    </div>
  );
}

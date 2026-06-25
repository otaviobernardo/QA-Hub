import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateApiKey, removeApiKey } from '../lib/db';
import { PROVIDERS, type ProviderDef } from '../lib/providers';

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

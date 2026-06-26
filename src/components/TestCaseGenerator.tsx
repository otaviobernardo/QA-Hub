import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { TestCase } from '../types';
import { useAuth } from '../context/AuthContext';
import { useGenerator, timerElapsed } from '../context/GeneratorContext';
import { getUserProfile } from '../lib/db';
import { generateTestCases, TestCaseGenError } from '../lib/ai';
import { PROVIDERS, PROVIDER_MAP, type ProviderId } from '../lib/providers';

type Tipo = TestCase['tipo'];

const TIPO_OPTIONS: { value: Tipo; label: string }[] = [
  { value: 'positivo', label: 'Positivo' },
  { value: 'negativo', label: 'Negativo' },
  { value: 'edge', label: 'Edge case' },
  { value: 'regressao', label: 'Regressão' },
  { value: 'integracao', label: 'Integração' },
  { value: 'api', label: 'API' },
  { value: 'exploratorio', label: 'Exploratório' },
  { value: 'aceitacao', label: 'Aceitação (UAT)' },
  { value: 'smoke', label: 'Smoke' },
  { value: 'seguranca', label: 'Segurança' },
  { value: 'usabilidade', label: 'Usabilidade' },
  { value: 'compatibilidade', label: 'Compatibilidade' },
  { value: 'acessibilidade', label: 'Acessibilidade' },
  { value: 'performance', label: 'Performance' },
];

const tipoBadge: Record<Tipo, string> = {
  positivo: 'bg-selbetti-green/15 text-selbetti-green',
  negativo: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  edge: 'bg-selbetti-orange/15 text-selbetti-orange',
  regressao: 'bg-selbetti-purple/15 text-selbetti-purple',
  acessibilidade: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  performance:
    'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  seguranca: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  usabilidade: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
  integracao:
    'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  compatibilidade:
    'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300',
  aceitacao:
    'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  smoke: 'bg-slate-100 text-slate-700 dark:bg-slate-600/30 dark:text-slate-300',
  api: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  exploratorio:
    'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300',
};

const tipoLabel: Record<Tipo, string> = {
  positivo: 'Positivo',
  negativo: 'Negativo',
  edge: 'Edge case',
  regressao: 'Regressão',
  acessibilidade: 'Acessibilidade',
  performance: 'Performance',
  seguranca: 'Segurança',
  usabilidade: 'Usabilidade',
  integracao: 'Integração',
  compatibilidade: 'Compatibilidade',
  aceitacao: 'Aceitação (UAT)',
  smoke: 'Smoke',
  api: 'API',
  exploratorio: 'Exploratório',
};

interface GenError {
  message: string;
  needsConfig?: boolean; // chave não configurada → link para /settings
}

export default function TestCaseGenerator() {
  const { user, apiKeys } = useAuth();
  const {
    userStory,
    setUserStory,
    criteria,
    setCriteria,
    devAnalysis,
    setDevAnalysis,
    tipos,
    toggleTipo,
    provider,
    setProvider,
    model,
    setModel,
    cases,
    setCases,
    statuses,
    setStatus,
    timers,
    startTimer,
    stopTimer,
    resetTimer,
  } = useGenerator();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<GenError | null>(null);
  const [copied, setCopied] = useState(false);

  // Provedores que o QA já configurou (na ordem do registro).
  const configured = useMemo(
    () => PROVIDERS.filter((p) => Boolean(apiKeys[p.id])),
    [apiKeys],
  );

  // Mantém provedor/modelo coerentes com o que está configurado.
  useEffect(() => {
    if (configured.length === 0) {
      if (provider !== '') setProvider('');
      return;
    }
    const stillValid = configured.some((p) => p.id === provider);
    const next = stillValid ? (provider as ProviderId) : configured[0].id;
    if (next !== provider) setProvider(next);
    const def = PROVIDER_MAP[next];
    if (!def.models.some((m) => m.id === model)) {
      setModel(def.models[0].id);
    }
  }, [configured, provider, model, setProvider, setModel]);

  // Resumo dos status dos casos gerados.
  const passedCount = Object.values(statuses).filter((s) => s === 'pass').length;
  const failedCount = Object.values(statuses).filter((s) => s === 'fail').length;
  const pendingCount = cases ? cases.length - passedCount - failedCount : 0;

  // Atualiza o tempo exibido enquanto algum cronômetro estiver em andamento.
  const [now, setNow] = useState(() => Date.now());
  const anyRunning = useMemo(
    () => Object.values(timers).some((t) => t.startedAt !== null),
    [timers],
  );
  useEffect(() => {
    if (!anyRunning) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [anyRunning]);

  const totalMs = cases
    ? cases.reduce((sum, _tc, i) => sum + timerElapsed(timers[i], now), 0)
    : 0;

  const handleGenerate = async (): Promise<void> => {
    setError(null);

    if (!user) return;
    if (!userStory.trim() || !criteria.trim()) {
      setError({ message: 'Preencha a User Story e os Critérios de Aceite.' });
      return;
    }
    if (tipos.length === 0) {
      setError({ message: 'Selecione ao menos um tipo de teste.' });
      return;
    }
    if (!provider) {
      setError({
        message:
          'Você ainda não configurou nenhuma chave de IA. Acesse Configurações para adicionar uma.',
        needsConfig: true,
      });
      return;
    }

    setLoading(true);
    // Mantém os casos atuais visíveis durante a geração; só substitui no sucesso,
    // assim uma falha (rede/limite/JSON) não apaga os últimos casos gerados.
    try {
      // Busca a chave do provedor escolhido no Firestore antes de cada chamada.
      const profile = await getUserProfile(user.uid);
      const apiKey = profile?.apiKeys?.[provider]?.trim();

      if (!apiKey) {
        setError({
          message:
            'A chave do provedor selecionado não está configurada. Acesse Configurações para adicioná-la.',
          needsConfig: true,
        });
        return;
      }

      const result = await generateTestCases({
        provider,
        model,
        apiKey,
        userStory: userStory.trim(),
        acceptanceCriteria: criteria.trim(),
        devAnalysis: devAnalysis.trim(),
        tipos: [...tipos],
      });
      setCases(result);
    } catch (err) {
      if (err instanceof TestCaseGenError) {
        setError({ message: err.message });
      } else {
        setError({
          message: 'Erro inesperado ao gerar casos de teste. Tente novamente.',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (): Promise<void> => {
    if (!cases) return;
    try {
      await navigator.clipboard.writeText(casesToText(cases));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError({ message: 'Não foi possível copiar para a área de transferência.' });
    }
  };

  const handleExportCsv = () => {
    if (cases) exportCasesCsv(cases);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
          Gerador de casos de teste
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Cole a User Story e os Critérios de Aceite, escolha os tipos de teste e
          a IA gera os casos estruturados.
        </p>
      </div>

      {/* Entrada */}
      <div className="space-y-4 rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 p-6">
        <div>
          <label
            htmlFor="userStory"
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
          >
            User Story
          </label>
          <textarea
            id="userStory"
            value={userStory}
            onChange={(e) => setUserStory(e.target.value)}
            rows={6}
            placeholder="Como [persona], quero [ação] para [objetivo]…"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-selbetti-green focus:ring-2 focus:ring-selbetti-green/30 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
          />
        </div>

        <div>
          <label
            htmlFor="criteria"
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
          >
            Critérios de Aceite
          </label>
          <textarea
            id="criteria"
            value={criteria}
            onChange={(e) => setCriteria(e.target.value)}
            rows={6}
            placeholder="CA1: …&#10;CA2: …"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-selbetti-green focus:ring-2 focus:ring-selbetti-green/30 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
          />
        </div>

        <div>
          <label
            htmlFor="devAnalysis"
            className="mb-1 flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-200"
          >
            Análise do Dev
            <span className="text-xs font-normal text-gray-400 dark:text-gray-500">
              Detalhes técnicos, regras de negócio, dependências (opcional)
            </span>
          </label>
          <textarea
            id="devAnalysis"
            value={devAnalysis}
            onChange={(e) => setDevAnalysis(e.target.value)}
            rows={6}
            placeholder="Ex: endpoint POST /auth/reset-password, token JWT expira em 1800s, validação no front e back, integração com SendGrid."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-selbetti-green focus:ring-2 focus:ring-selbetti-green/30 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
          />
        </div>

        {/* Provedor de IA + modelo */}
        {configured.length === 0 ? (
          <div className="rounded-md border border-selbetti-orange/40 bg-selbetti-orange/10 px-3 py-2 text-sm text-gray-700 dark:text-gray-200">
            Você ainda não configurou nenhuma chave de IA.{' '}
            <Link to="/settings" className="font-semibold text-selbetti-orange underline">
              Configure um provedor
            </Link>{' '}
            para gerar casos de teste.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="provider"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
              >
                Provedor de IA
              </label>
              <select
                id="provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value as ProviderId)}
                className="app-select w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-selbetti-green focus:ring-2 focus:ring-selbetti-green/30 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
              >
                {configured.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="model"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
              >
                Modelo
              </label>
              <select
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="app-select w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-selbetti-green focus:ring-2 focus:ring-selbetti-green/30 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
              >
                {(provider ? PROVIDER_MAP[provider].models : []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-200">
            Tipos de teste
          </legend>
          <div className="flex flex-wrap gap-2">
            {TIPO_OPTIONS.map((opt) => {
              const checked = tipos.includes(opt.value);
              return (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors ${
                    checked
                      ? 'border-selbetti-green bg-selbetti-green/10 text-selbetti-green'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleTipo(opt.value)}
                    className="h-4 w-4 rounded border-gray-300 text-selbetti-green focus:ring-selbetti-green"
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
        </fieldset>

        {error && (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
          >
            {error.message}
            {error.needsConfig && (
              <>
                {' '}
                <Link to="/settings" className="font-semibold underline">
                  Ir para Configurações
                </Link>
              </>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading || configured.length === 0}
          className="flex items-center justify-center gap-2 rounded-md bg-selbetti-green px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-selbetti-green/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          )}
          {loading ? 'Gerando…' : 'Gerar casos de teste'}
        </button>
      </div>

      {/* Resultado */}
      {cases && cases.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                {cases.length} caso{cases.length === 1 ? '' : 's'} gerado
                {cases.length === 1 ? '' : 's'}
              </h2>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                <span className="font-medium text-selbetti-green">
                  {passedCount} passaram
                </span>{' '}
                ·{' '}
                <span className="font-medium text-red-600 dark:text-red-400">
                  {failedCount} falharam
                </span>{' '}
                · {pendingCount} pendente{pendingCount === 1 ? '' : 's'}
                <span className="ml-2 text-gray-400 dark:text-gray-500">
                  · ⏱ {formatTime(totalMs)} no total
                </span>
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                {copied ? 'Copiado!' : 'Copiar tudo'}
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                Exportar CSV
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {cases.map((tc, idx) => (
              <article
                key={idx}
                className={`rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800 ${
                  statuses[idx] === 'pass'
                    ? 'border-l-4 border-l-selbetti-green'
                    : statuses[idx] === 'fail'
                      ? 'border-l-4 border-l-red-500'
                      : ''
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tipoBadge[tc.tipo]}`}
                  >
                    {tipoLabel[tc.tipo]}
                  </span>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    {tc.titulo}
                  </h3>
                </div>

                {tc.descricao && (
                  <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                    {tc.descricao}
                  </p>
                )}

                {tc.tipo === 'exploratorio' &&
                  (tc.explore || tc.com || tc.para_validar || tc.e) && (
                  <dl className="mt-3 space-y-2 rounded-md border border-fuchsia-200 bg-fuchsia-50 p-3 dark:border-fuchsia-500/20 dark:bg-fuchsia-500/10">
                    {(
                      [
                        ['Explore', tc.explore],
                        ['Com', tc.com],
                        ['Para validar', tc.para_validar],
                        ['E', tc.e],
                      ] as const
                    ).map(([label, val]) =>
                      val ? (
                        <div key={label}>
                          <dt className="text-xs font-bold uppercase tracking-wide text-fuchsia-700 dark:text-fuchsia-300">
                            {label}
                          </dt>
                          <dd className="text-sm text-gray-700 dark:text-gray-300">
                            {val}
                          </dd>
                        </div>
                      ) : null,
                    )}
                  </dl>
                )}

                {tc.passos.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                      Passos
                    </p>
                    <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
                      {tc.passos.map((passo, i) => (
                        <li key={i}>{passo}</li>
                      ))}
                    </ol>
                  </div>
                )}

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                      Resultado esperado
                    </p>
                    <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                      {tc.resultado_esperado || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                      CA coberto
                    </p>
                    <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                      {tc.ca_coberto || '—'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3 dark:border-gray-700">
                  {/* Cronômetro do teste */}
                  <div className="flex items-center gap-2">
                    <span className="min-w-[3.5rem] font-mono text-sm tabular-nums text-gray-700 dark:text-gray-200">
                      {formatTime(timerElapsed(timers[idx], now))}
                    </span>
                    {timers[idx]?.startedAt != null ? (
                      <button
                        type="button"
                        onClick={() => stopTimer(idx)}
                        className="rounded-md border border-selbetti-orange bg-selbetti-orange/10 px-3 py-1 text-xs font-semibold text-selbetti-orange transition-colors hover:bg-selbetti-orange/20"
                      >
                        ⏸ Parar
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startTimer(idx)}
                        className="rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                      >
                        ▶ Iniciar
                      </button>
                    )}
                    {timerElapsed(timers[idx], now) > 0 &&
                      timers[idx]?.startedAt == null && (
                        <button
                          type="button"
                          onClick={() => resetTimer(idx)}
                          className="text-xs font-medium text-gray-400 underline transition-colors hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          Zerar
                        </button>
                      )}
                  </div>

                  {/* Resultado do teste */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setStatus(idx, statuses[idx] === 'pass' ? null : 'pass')
                      }
                      className={`rounded-md border px-3 py-1 text-xs font-semibold transition-colors ${
                        statuses[idx] === 'pass'
                          ? 'border-selbetti-green bg-selbetti-green text-white'
                          : 'border-gray-300 text-selbetti-green hover:bg-selbetti-green/10 dark:border-gray-600'
                      }`}
                    >
                      ✓ Passou
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setStatus(idx, statuses[idx] === 'fail' ? null : 'fail')
                      }
                      className={`rounded-md border px-3 py-1 text-xs font-semibold transition-colors ${
                        statuses[idx] === 'fail'
                          ? 'border-red-500 bg-red-500 text-white'
                          : 'border-gray-300 text-red-600 hover:bg-red-50 dark:border-gray-600 dark:text-red-400 dark:hover:bg-red-500/10'
                      }`}
                    >
                      ✗ Falhou
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Helpers ---------------------------- */

/** Formata milissegundos como mm:ss (ou h:mm:ss acima de 1h). */
function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Para exploratórios usa o charter; para os demais, os passos numerados. */
function charterOrSteps(tc: TestCase): string {
  if (tc.tipo === 'exploratorio') {
    return [
      tc.explore && `EXPLORE: ${tc.explore}`,
      tc.com && `COM: ${tc.com}`,
      tc.para_validar && `PARA VALIDAR: ${tc.para_validar}`,
      tc.e && `E: ${tc.e}`,
    ]
      .filter(Boolean)
      .join('\n');
  }
  return tc.passos.map((p, i) => `${i + 1}. ${p}`).join('\n');
}

function casesToText(cases: TestCase[]): string {
  return cases
    .map((tc, idx) => {
      const corpo = charterOrSteps(tc);
      const corpoLabel = tc.tipo === 'exploratorio' ? 'Charter' : 'Passos';
      return [
        `Caso ${idx + 1} — [${tipoLabel[tc.tipo]}] ${tc.titulo}`,
        tc.descricao && `Descrição: ${tc.descricao}`,
        corpo && `${corpoLabel}:\n${corpo}`,
        `Resultado esperado: ${tc.resultado_esperado}`,
        `CA coberto: ${tc.ca_coberto}`,
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function exportCasesCsv(cases: TestCase[]): void {
  const headers = [
    'Tipo',
    'Título',
    'Descrição',
    'Passos',
    'Resultado Esperado',
    'CA Coberto',
  ];

  const rows = cases.map((tc) =>
    [
      tipoLabel[tc.tipo],
      tc.titulo,
      tc.descricao,
      charterOrSteps(tc),
      tc.resultado_esperado,
      tc.ca_coberto,
    ]
      .map(csvCell)
      .join(';'),
  );

  // BOM para o Excel reconhecer UTF-8 e exibir acentos corretamente.
  const content = '﻿' + [headers.map(csvCell).join(';'), ...rows].join('\r\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `casos-de-teste-${stamp}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

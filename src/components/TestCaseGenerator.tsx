import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { TestCase } from '../types';
import { useAuth } from '../context/AuthContext';
import { useGenerator } from '../context/GeneratorContext';
import { getUserProfile, createSavedCase } from '../lib/db';
import { generateTestCases, TestCaseGenError } from '../lib/ai';
import { PROVIDERS, PROVIDER_MAP, type ProviderId } from '../lib/providers';
import { TIPO_OPTIONS, tipoLabel, tipoBadge } from '../lib/testCaseOptions';
import {
  importFromCard,
  findMapaDeTestes,
  writeMapaDeTestes,
} from '../lib/cardImport';
import { AzureError, updateState } from '../lib/azure';
import TestCaseModal, { type TestCaseModalResult } from './TestCaseModal';

/** Caso em branco usado ao adicionar um caso manualmente. */
const BLANK_CASE: TestCase = {
  tipo: 'positivo',
  titulo: '',
  descricao: '',
  passos: [],
  resultado_esperado: '',
  ca_coberto: '',
};

interface GenError {
  message: string;
  needsConfig?: boolean; // chave não configurada → link para /settings
}

export default function TestCaseGenerator() {
  const { user, apiKeys } = useAuth();
  const {
    titulo,
    setTitulo,
    squad,
    setSquad,
    sprint,
    setSprint,
    cardId,
    setCardId,
    userStory,
    setUserStory,
    criteria,
    setCriteria,
    devAnalysis,
    setDevAnalysis,
    tipos,
    toggleTipo,
    casosPorTipo,
    setCasosPorTipo,
    provider,
    setProvider,
    model,
    setModel,
    cases,
    caseIds,
    setCases,
    addCaseAt,
    updateCase,
    removeCase,
  } = useGenerator();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<GenError | null>(null);
  const [copied, setCopied] = useState(false);
  // Edição de caso gerado + inserção manual (em um índice) + salvamento.
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [addingAt, setAddingAt] = useState<number | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [savedAll, setSavedAll] = useState(false);
  // Importação dos campos a partir de um card do Azure DevOps (cardId no contexto).
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<
    { type: 'ok' | 'error'; text: string } | null
  >(null);
  // Resultado da cópia dos casos para a task "Mapa de testes".
  const [mapaMsg, setMapaMsg] = useState<
    { type: 'ok' | 'error'; text: string } | null
  >(null);
  const [mapaPushing, setMapaPushing] = useState(false);

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

  const handleImport = async (): Promise<void> => {
    setImportMsg(null);
    const raw = cardId.trim();
    if (!raw) {
      setImportMsg({ type: 'error', text: 'Informe o ID do card (PBI).' });
      return;
    }
    if (!/^\d+$/.test(raw)) {
      setImportMsg({ type: 'error', text: 'O ID do card deve ser numérico.' });
      return;
    }
    if (!user) return;
    // Evita apagar conteúdo já digitado sem aviso.
    if (
      (userStory.trim() || criteria.trim() || devAnalysis.trim()) &&
      !window.confirm(
        'Isso vai substituir a User Story, os Critérios de Aceite e a Análise do Dev já preenchidos. Continuar?',
      )
    ) {
      return;
    }

    setImporting(true);
    try {
      const profile = await getUserProfile(user.uid);
      const pat = profile?.azurePat?.trim();
      if (!pat) {
        setImportMsg({
          type: 'error',
          text: 'Configure seu PAT do Azure DevOps em Configurações.',
        });
        return;
      }
      const data = await importFromCard(pat, raw);
      // Título automático: ID do card + título do PBI.
      if (data.title) setTitulo(`${raw} - ${data.title}`);
      // Squad e Sprint vêm automaticamente do card (Area/Iteration Path).
      setSquad(data.squad);
      setSprint(data.sprint);
      setUserStory(data.userStory);
      setCriteria(data.criteria);
      if (data.devAnalysis) setDevAnalysis(data.devAnalysis);
      setImportMsg({
        type: 'ok',
        text: data.foundAnalise
          ? 'User Story, Critérios de Aceite e Análise do Dev importados do card.'
          : 'User Story e Critérios de Aceite importados. Análise do Dev não encontrada (task filha "Análise") — preencha manualmente se precisar.',
      });
    } catch (err) {
      setImportMsg({
        type: 'error',
        text:
          err instanceof AzureError
            ? err.message
            : 'Falha ao buscar o card no Azure DevOps.',
      });
    } finally {
      setImporting(false);
    }
  };

  const handleGenerate = async (): Promise<void> => {
    setError(null);

    if (!user) return;
    if (!titulo.trim()) {
      setError({ message: 'Informe um título para o conjunto de casos.' });
      return;
    }
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
        casosPorTipo,
      });
      // Ordena pela ordem de exibição dos tipos (TIPO_OPTIONS).
      const order = new Map(TIPO_OPTIONS.map((o, i) => [o.value, i]));
      const sorted = [...result].sort(
        (a, b) => (order.get(a.tipo) ?? 99) - (order.get(b.tipo) ?? 99),
      );
      setCases(sorted);
      setSavedAll(false);
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

  // Salva TODOS os casos gerados no repositório, sob o título (grupo) informado.
  const saveAll = async (): Promise<void> => {
    if (!user || !cases || cases.length === 0) return;
    if (!titulo.trim()) {
      setError({ message: 'Informe um título para salvar os casos.' });
      return;
    }
    setSavingAll(true);
    setMapaMsg(null);
    try {
      const createdByName = user.displayName?.trim() || user.email || 'QA';
      const azureCardId = cardId.trim() || undefined;
      await Promise.all(
        cases.map((tc, idx) =>
          createSavedCase({
            // ID estável por caso: re-salvar atualiza o mesmo doc (não duplica).
            id: caseIds[idx],
            ...tc,
            grupo: titulo.trim(),
            squad: squad.trim(),
            sprint: sprint.trim(),
            modulo: '',
            status: 'pendente',
            tempoMs: 0,
            azureCardId,
            createdBy: user.uid,
            createdByName,
          }),
        ),
      );
      setSavedAll(true);
    } catch {
      window.alert('Não foi possível salvar os casos no repositório.');
      setSavingAll(false);
      return;
    }

    // Cola os casos na task "Mapa de testes" do card, se houver card vinculado.
    if (cardId.trim()) {
      await runMapaPush();
    }
    setSavingAll(false);
  };

  // Cola os casos na task "Mapa de testes"; pergunta antes de sobrescrever conteúdo.
  // Reutilizável: chamado no salvar e no botão "tentar de novo".
  const runMapaPush = async (): Promise<void> => {
    if (!user || !cases || cases.length === 0 || !cardId.trim()) return;
    setMapaMsg(null);
    setMapaPushing(true);
    try {
      const profile = await getUserProfile(user.uid);
      const pat = profile?.azurePat?.trim();
      if (!pat) {
        setMapaMsg({
          type: 'error',
          text: 'Para colar no "Mapa de testes", configure seu PAT do Azure em Configurações.',
        });
        return;
      }
      // Procura a task "Mapa de testes" que é FILHA do card informado no import.
      const mapa = await findMapaDeTestes(pat, cardId.trim());
      if (!mapa) {
        setMapaMsg({
          type: 'error',
          text: 'A task filha "Mapa de testes" não foi encontrada no card informado.',
        });
        return;
      }
      // Escreve os casos na descrição dessa task filha e a move para finalizado.
      await writeMapaDeTestes(pat, mapa.id, casesToHtml(cases));
      await updateState(pat, mapa.id, 'Done');
      setMapaMsg({
        type: 'ok',
        text: `Casos salvos na task "Mapa de testes" (#${mapa.id}) e finalizada (Done).`,
      });
    } catch (err) {
      setMapaMsg({
        type: 'error',
        text:
          err instanceof AzureError
            ? err.message
            : 'Falhou ao colar no "Mapa de testes".',
      });
    } finally {
      setMapaPushing(false);
    }
  };

  // Salva a edição inline de um caso gerado (apenas os campos do caso).
  const handleEditSave = (result: TestCaseModalResult): void => {
    if (editingIdx === null) return;
    const { sprint: _s, modulo: _m, status: _st, ...core } = result;
    void _s;
    void _m;
    void _st;
    updateCase(editingIdx, core);
    setEditingIdx(null);
  };

  // Insere um caso criado manualmente na posição escolhida (addingAt).
  const handleAddSave = (result: TestCaseModalResult): void => {
    if (addingAt === null) return;
    const { sprint: _s, modulo: _m, status: _st, ...core } = result;
    void _s;
    void _m;
    void _st;
    addCaseAt(addingAt, core);
    setAddingAt(null);
    setSavedAll(false);
  };

  // Limpa os casos gerados e os campos de entrada (US, CA, Análise, card).
  const handleClear = (): void => {
    if (
      !window.confirm(
        'Limpar o título, a User Story, Critérios de Aceite, Análise do Dev e os casos gerados?',
      )
    )
      return;
    setTitulo('');
    setSquad('');
    setSprint('');
    setCardId('');
    setUserStory('');
    setCriteria('');
    setDevAnalysis('');
    setCases(null);
    setError(null);
    setImportMsg(null);
    setMapaMsg(null);
    setSavedAll(false);
  };

  const hasContent =
    Boolean(cases && cases.length > 0) ||
    Boolean(titulo.trim()) ||
    Boolean(userStory.trim()) ||
    Boolean(criteria.trim()) ||
    Boolean(devAnalysis.trim()) ||
    Boolean(cardId.trim());

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
        {/* Importar campos a partir de um card do Azure DevOps */}
        <div className="rounded-md border border-selbetti-purple/30 bg-selbetti-purple/5 p-4">
          <label
            htmlFor="cardId"
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
          >
            Importar do Azure DevOps
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="cardId"
              type="text"
              inputMode="numeric"
              value={cardId}
              onChange={(e) => setCardId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleImport();
                }
              }}
              placeholder="ID do PBI (ex: 151171)"
              className="w-44 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-selbetti-green focus:ring-2 focus:ring-selbetti-green/30 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
            />
            <button
              type="button"
              onClick={() => void handleImport()}
              disabled={importing}
              className="flex items-center gap-2 rounded-md bg-selbetti-purple px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-selbetti-purple/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {importing && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              )}
              {importing ? 'Buscando…' : 'Buscar do Azure'}
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Puxa a <b>User Story</b> e os <b>Critérios de Aceite</b> do card e a{' '}
            <b>Análise do Dev</b> da task filha “Análise”.
          </p>
          {importMsg && (
            <div
              role="alert"
              className={`mt-2 rounded-md px-3 py-2 text-sm ${
                importMsg.type === 'ok'
                  ? 'bg-selbetti-green/10 text-selbetti-green dark:text-green-300'
                  : 'border border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300'
              }`}
            >
              {importMsg.text}
            </div>
          )}
        </div>

        <div>
          <label
            htmlFor="titulo"
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
          >
            Título
          </label>
          <input
            id="titulo"
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex: Recuperação de senha por e-mail"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-selbetti-green focus:ring-2 focus:ring-selbetti-green/30 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
          />
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            Os casos salvos ficam agrupados sob este título (Feature) no repositório.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="squad"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
            >
              Squad
            </label>
            <input
              id="squad"
              type="text"
              value={squad}
              onChange={(e) => setSquad(e.target.value)}
              placeholder="Ex: DI, SQUAD SHARE-4"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-selbetti-green focus:ring-2 focus:ring-selbetti-green/30 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
            />
          </div>
          <div>
            <label
              htmlFor="sprint"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
            >
              Sprint
            </label>
            <input
              id="sprint"
              type="text"
              value={sprint}
              onChange={(e) => setSprint(e.target.value)}
              placeholder="Ex: Sprint 24 / nome da iteração"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-selbetti-green focus:ring-2 focus:ring-selbetti-green/30 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
            />
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 sm:col-span-2">
            Preenchidos automaticamente ao importar do Azure (squad e sprint do card). Edite se precisar.
          </p>
        </div>

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

        <div className="flex items-end justify-between gap-3">
          <label
            htmlFor="casosPorTipo"
            className="text-sm font-medium text-gray-700 dark:text-gray-200"
          >
            Casos por tipo
          </label>
          <select
            id="casosPorTipo"
            value={casosPorTipo}
            onChange={(e) => setCasosPorTipo(Number(e.target.value))}
            className="app-select rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-selbetti-green focus:ring-2 focus:ring-selbetti-green/30 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          >
            <option value={2}>2 por tipo</option>
            <option value={3}>3 por tipo</option>
            <option value={5}>5 por tipo</option>
            <option value={8}>8 por tipo</option>
          </select>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-200">
            Tipos de teste{' '}
            <span className="font-normal text-gray-400 dark:text-gray-500">
              ({tipos.length === 0
                ? 'nenhum'
                : `~${casosPorTipo * tipos.length} casos no total`}
              )
            </span>
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

        <div className="flex flex-wrap items-center gap-2">
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
          <button
            type="button"
            onClick={handleClear}
            disabled={loading || !hasContent}
            className="rounded-md border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-red-500/10 dark:hover:text-red-400"
          >
            Limpar
          </button>
        </div>
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
                Revise, edite ou adicione casos e salve no repositório. A
                execução (cronômetro e Passou/Falhou) fica na aba Execução.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
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
              <button
                type="button"
                onClick={() => void saveAll()}
                disabled={savingAll || savedAll}
                className="rounded-md bg-selbetti-green px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-selbetti-green/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savedAll
                  ? 'Salvo ✓'
                  : savingAll
                    ? 'Salvando…'
                    : 'Salvar no Repositório'}
              </button>
            </div>
          </div>

          {mapaMsg && (
            <div
              role="status"
              className={`flex flex-wrap items-center justify-between gap-2 rounded-md px-3 py-2 text-sm ${
                mapaMsg.type === 'ok'
                  ? 'bg-selbetti-green/10 text-selbetti-green dark:text-green-300'
                  : 'border border-selbetti-orange/40 bg-selbetti-orange/10 text-gray-700 dark:text-gray-200'
              }`}
            >
              <span>{mapaMsg.text}</span>
              {mapaMsg.type === 'error' && cardId.trim() && (
                <button
                  type="button"
                  onClick={() => void runMapaPush()}
                  disabled={mapaPushing}
                  className="shrink-0 rounded-md border border-selbetti-orange px-3 py-1 text-xs font-semibold text-selbetti-orange transition-colors hover:bg-selbetti-orange/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {mapaPushing ? 'Colando…' : 'Tentar colar no Mapa de testes'}
                </button>
              )}
            </div>
          )}

          <div className="space-y-2">
            {cases.map((tc, idx) => (
              <Fragment key={caseIds[idx] ?? idx}>
                <InsertCaseRow onClick={() => setAddingAt(idx)} />
                <article className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
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

                <div className="mt-4 flex items-center justify-end gap-2 border-t border-gray-100 pt-3 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => setEditingIdx(idx)}
                    className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => removeCase(idx)}
                    className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-500 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                  >
                    Excluir
                  </button>
                </div>
                </article>
              </Fragment>
            ))}
            <InsertCaseRow onClick={() => setAddingAt(cases.length)} />
          </div>
        </div>
      )}

      {editingIdx !== null && cases && (
        <TestCaseModal
          value={cases[editingIdx]}
          withMeta={false}
          title="Editar caso gerado"
          onClose={() => setEditingIdx(null)}
          onSave={handleEditSave}
        />
      )}

      {addingAt !== null && (
        <TestCaseModal
          value={BLANK_CASE}
          withMeta={false}
          title="Adicionar caso"
          onClose={() => setAddingAt(null)}
          onSave={handleAddSave}
        />
      )}
    </div>
  );
}

/** Divisor com botão "+ adicionar caso" para inserir um caso naquele intervalo. */
function InsertCaseRow({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-3 py-1 text-xs font-medium text-gray-500 transition-colors hover:border-selbetti-green hover:bg-selbetti-green/10 hover:text-selbetti-green dark:border-gray-600 dark:text-gray-400 dark:hover:text-selbetti-green"
      >
        <span className="text-base leading-none">+</span> adicionar caso
      </button>
      <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
    </div>
  );
}

/* ----------------------------- Helpers ---------------------------- */

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

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Corpo HTML do caso: charter (exploratório) ou lista de passos. */
function caseBodyHtml(tc: TestCase): string {
  if (tc.tipo === 'exploratorio') {
    return [
      tc.explore && `<b>EXPLORE:</b> ${escapeHtml(tc.explore)}`,
      tc.com && `<b>COM:</b> ${escapeHtml(tc.com)}`,
      tc.para_validar && `<b>PARA VALIDAR:</b> ${escapeHtml(tc.para_validar)}`,
      tc.e && `<b>E:</b> ${escapeHtml(tc.e)}`,
    ]
      .filter(Boolean)
      .join('<br/>');
  }
  if (tc.passos.length === 0) return '';
  return `<ol>${tc.passos.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ol>`;
}

/** Renderiza os casos como HTML para colar na descrição do work item. */
function casesToHtml(cases: TestCase[]): string {
  return cases
    .map((tc, idx) => {
      const body = caseBodyHtml(tc);
      const bodyLabel = tc.tipo === 'exploratorio' ? 'Charter' : 'Passos';
      return [
        `<b>Caso ${idx + 1} — [${tipoLabel[tc.tipo]}] ${escapeHtml(tc.titulo)}</b>`,
        tc.descricao && escapeHtml(tc.descricao),
        body && `<b>${bodyLabel}:</b><br/>${body}`,
        `<b>Resultado esperado:</b> ${escapeHtml(tc.resultado_esperado || '—')}`,
        `<b>CA/RN coberto:</b> ${escapeHtml(tc.ca_coberto || '—')}`,
      ]
        .filter(Boolean)
        .join('<br/>');
    })
    .join('<br/><br/>');
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

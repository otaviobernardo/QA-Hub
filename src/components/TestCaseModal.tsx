import { useState, type FormEvent } from 'react';
import type { TestCase, SavedCaseStatus } from '../types';
import { TIPO_OPTIONS, SAVED_STATUS_LABEL } from '../lib/testCaseOptions';

export interface TestCaseModalResult extends TestCase {
  grupo: string;
  sprint: string;
  modulo: string;
  status: SavedCaseStatus;
}

interface TestCaseModalProps {
  value: TestCase &
    Partial<{ grupo: string; sprint: string; modulo: string; status: SavedCaseStatus }>;
  /** Mostra os campos de repositório (sprint, módulo, status). */
  withMeta: boolean;
  title: string;
  saving?: boolean;
  onClose: () => void;
  onSave: (result: TestCaseModalResult) => void;
}

const inputClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition-colors focus:border-selbetti-green focus:ring-2 focus:ring-selbetti-green/30 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500';
const labelClass = 'mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200';

export default function TestCaseModal({
  value,
  withMeta,
  title,
  saving = false,
  onClose,
  onSave,
}: TestCaseModalProps) {
  const [tipo, setTipo] = useState<TestCase['tipo']>(value.tipo);
  const [titulo, setTitulo] = useState(value.titulo);
  const [descricao, setDescricao] = useState(value.descricao);
  const [passos, setPassos] = useState(value.passos.join('\n'));
  const [resultado, setResultado] = useState(value.resultado_esperado);
  const [caCoberto, setCaCoberto] = useState(value.ca_coberto);
  const [explore, setExplore] = useState(value.explore ?? '');
  const [com, setCom] = useState(value.com ?? '');
  const [paraValidar, setParaValidar] = useState(value.para_validar ?? '');
  const [eCampo, setECampo] = useState(value.e ?? '');
  const [grupo, setGrupo] = useState(value.grupo ?? '');
  const [sprint, setSprint] = useState(value.sprint ?? '');
  const [modulo, setModulo] = useState(value.modulo ?? '');
  const [status, setStatus] = useState<SavedCaseStatus>(value.status ?? 'pendente');

  const isExploratorio = tipo === 'exploratorio';

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onSave({
      tipo,
      titulo: titulo.trim(),
      descricao: descricao.trim(),
      passos: passos
        .split('\n')
        .map((p) => p.trim())
        .filter(Boolean),
      resultado_esperado: resultado.trim(),
      ca_coberto: caCoberto.trim(),
      explore: explore.trim() || undefined,
      com: com.trim() || undefined,
      para_validar: paraValidar.trim() || undefined,
      e: eCampo.trim() || undefined,
      grupo: grupo.trim(),
      sprint: sprint.trim(),
      modulo: modulo.trim(),
      status,
    });
  };

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
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className={labelClass}>Título</label>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Tipo</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TestCase['tipo'])}
                className={`${inputClass} app-select`}
              >
                {TIPO_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {withMeta && (
            <div>
              <label className={labelClass}>Título do conjunto</label>
              <input
                type="text"
                value={grupo}
                onChange={(e) => setGrupo(e.target.value)}
                placeholder="Ex: Recuperação de senha"
                className={inputClass}
              />
            </div>
          )}

          {withMeta && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className={labelClass}>Módulo</label>
                <input
                  type="text"
                  value={modulo}
                  onChange={(e) => setModulo(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Sprint</label>
                <input
                  type="text"
                  value={sprint}
                  onChange={(e) => setSprint(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as SavedCaseStatus)}
                  className={`${inputClass} app-select`}
                >
                  {(Object.keys(SAVED_STATUS_LABEL) as SavedCaseStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {SAVED_STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <label className={labelClass}>Descrição</label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
              className={inputClass}
            />
          </div>

          {isExploratorio ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Explore</label>
                <textarea value={explore} onChange={(e) => setExplore(e.target.value)} rows={2} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Com</label>
                <textarea value={com} onChange={(e) => setCom(e.target.value)} rows={2} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Para validar</label>
                <textarea value={paraValidar} onChange={(e) => setParaValidar(e.target.value)} rows={2} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>E</label>
                <textarea value={eCampo} onChange={(e) => setECampo(e.target.value)} rows={2} className={inputClass} />
              </div>
            </div>
          ) : (
            <div>
              <label className={labelClass}>Passos (um por linha)</label>
              <textarea
                value={passos}
                onChange={(e) => setPassos(e.target.value)}
                rows={5}
                placeholder={'1. Acesse a tela\n2. Preencha o campo\n3. Clique em Salvar'}
                className={inputClass}
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Resultado esperado</label>
              <textarea value={resultado} onChange={(e) => setResultado(e.target.value)} rows={2} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>CA coberto</label>
              <input type="text" value={caCoberto} onChange={(e) => setCaCoberto(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !titulo.trim()}
              className="rounded-md bg-selbetti-green px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-selbetti-green/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

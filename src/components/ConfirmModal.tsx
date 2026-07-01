import type { ReactNode } from 'react';

interface ConfirmModalProps {
  title?: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  /** Estilo do botão de confirmar. */
  tone?: 'green' | 'red' | 'purple';
}

/** Diálogo de confirmação simples e reutilizável (dois botões). */
export default function ConfirmModal({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  busy = false,
  tone = 'green',
}: ConfirmModalProps) {
  const confirmClass =
    tone === 'purple'
      ? 'bg-selbetti-purple hover:bg-selbetti-purple/90'
      : tone === 'red'
        ? 'bg-red-600 hover:bg-red-700'
        : 'bg-selbetti-green hover:bg-selbetti-green/90';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title ?? 'Confirmação'}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
        {title && (
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
            {title}
          </h2>
        )}
        <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
          {message}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-60 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${confirmClass}`}
          >
            {busy && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

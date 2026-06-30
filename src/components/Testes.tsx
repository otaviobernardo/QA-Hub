import { useState } from 'react';
import TestCaseGenerator from './TestCaseGenerator';
import SavedTestCases from './SavedTestCases';
import Execucao from './Execucao';

type Sub = 'gerador' | 'casos' | 'execucao';

const TABS: { id: Sub; label: string }[] = [
  { id: 'gerador', label: 'Gerador' },
  { id: 'casos', label: 'Casos de teste' },
  { id: 'execucao', label: 'Execução' },
];

export default function Testes() {
  const [sub, setSub] = useState<Sub>('gerador');

  return (
    <div className="space-y-6">
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSub(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              sub === t.id
                ? 'border-selbetti-green text-selbetti-green'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {sub === 'gerador' && <TestCaseGenerator />}
      {sub === 'casos' && <SavedTestCases />}
      {sub === 'execucao' && <Execucao />}
    </div>
  );
}

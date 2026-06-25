import { Navigate, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Header from './Header';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/gerador', label: 'Gerador de testes', end: false },
  { to: '/base', label: 'Base de conhecimento', end: false },
];

/**
 * Protege as rotas filhas:
 * - enquanto o estado de auth carrega, mostra um spinner (evita flash de conteúdo);
 * - se não autenticado, redireciona para /login;
 * - se autenticado, renderiza o Header + a rota filha (via <Outlet />).
 */
export default function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div
          role="status"
          aria-label="Carregando"
          className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-selbetti-green dark:border-gray-700 dark:border-t-selbetti-green"
        />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <nav className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="no-scrollbar mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `-mb-px whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-selbetti-green text-selbetti-green'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

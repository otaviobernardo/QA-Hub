import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { FirebaseError } from 'firebase/app';
import { signIn } from '../lib/auth';
import { useAuth } from '../context/AuthContext';

/** Traduz códigos de erro do Firebase Auth em mensagens claras para o QA. */
function mapAuthError(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
        return 'E-mail ou senha incorretos. Verifique e tente novamente.';
      case 'auth/user-not-found':
        return 'Usuário não encontrado. Confirme o e-mail ou peça ao admin para criar sua conta.';
      case 'auth/invalid-email':
        return 'E-mail em formato inválido.';
      case 'auth/user-disabled':
        return 'Esta conta está desativada. Procure o administrador.';
      case 'auth/too-many-requests':
        return 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.';
      case 'auth/network-request-failed':
        return 'Falha de conexão. Verifique sua internet e tente novamente.';
      default:
        return 'Não foi possível entrar. Tente novamente.';
    }
  }
  return 'Não foi possível entrar. Tente novamente.';
}

interface LocationState {
  from?: { pathname: string };
}

export default function Login() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as LocationState | null)?.from?.pathname ?? '/';

  // Evita flash da tela de login enquanto o estado de auth é resolvido.
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div
          role="status"
          aria-label="Carregando"
          className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-selbetti-green"
        />
      </div>
    );
  }

  // Já autenticado: não exibe o login.
  if (user) {
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Preencha e-mail e senha.');
      return;
    }

    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(mapAuthError(err));
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img
            src="/selbetti-logo-sem-fundo.png"
            alt="Selbetti"
            className="mx-auto h-12 w-auto"
          />
          <h1 className="mt-4 text-xl font-semibold text-gray-700 dark:text-gray-200">
            QA Hub
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Ferramenta interna do time de Qualidade
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
          noValidate
        >
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
            >
              E-mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition-colors focus:border-selbetti-green focus:ring-2 focus:ring-selbetti-green/30 disabled:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500 dark:disabled:bg-gray-800"
              placeholder="voce@selbetti.com.br"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
            >
              Senha
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition-colors focus:border-selbetti-green focus:ring-2 focus:ring-selbetti-green/30 disabled:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500 dark:disabled:bg-gray-800"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center rounded-md bg-selbetti-green px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-selbetti-green/90 focus:outline-none focus:ring-2 focus:ring-selbetti-green/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-gray-400">
          As contas são criadas pelo administrador no Firebase.
        </p>
      </div>
    </div>
  );
}

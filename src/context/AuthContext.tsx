import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChange } from '../lib/auth';
import { getUserProfile } from '../lib/db';

interface AuthContextValue {
  /** Usuário do Firebase Auth, ou null se não autenticado. */
  user: User | null;
  /** Chaves de IA configuradas, por provedor (ex: { anthropic: '...', gemini: '...' }). */
  apiKeys: Record<string, string>;
  /** true quando há ao menos uma chave de IA configurada. */
  hasApiKey: boolean;
  /** true enquanto o estado inicial de auth ainda está sendo resolvido. */
  loading: boolean;
  /** Recarrega as chaves do Firestore (usar após salvar/remover em Settings). */
  refreshKeys: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (nextUser) => {
      setUser(nextUser);

      if (nextUser) {
        try {
          const profile = await getUserProfile(nextUser.uid);
          setApiKeys(profile?.apiKeys ?? {});
        } catch {
          // Falha ao ler o perfil não deve travar a UI; tratamos como "sem chave".
          setApiKeys({});
        }
      } else {
        setApiKeys({});
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const refreshKeys = async (): Promise<void> => {
    if (!user) return;
    const profile = await getUserProfile(user.uid);
    setApiKeys(profile?.apiKeys ?? {});
  };

  const value: AuthContextValue = {
    user,
    apiKeys,
    hasApiKey: Object.keys(apiKeys).length > 0,
    loading,
    refreshKeys,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de <AuthProvider>.');
  }
  return context;
}

import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth } from './firebase';

/** Autentica com e-mail e senha. Lança FirebaseError em caso de falha. */
export function signIn(email: string, password: string): Promise<User> {
  return signInWithEmailAndPassword(auth, email, password).then(
    (credential) => credential.user,
  );
}

/** Encerra a sessão do usuário atual. */
export function signOut(): Promise<void> {
  return firebaseSignOut(auth);
}

/** Retorna o usuário autenticado no momento, ou null. */
export function getCurrentUser(): User | null {
  return auth.currentUser;
}

/**
 * Observa mudanças no estado de autenticação.
 * Retorna a função de unsubscribe.
 */
export function onAuthStateChange(
  callback: (user: User | null) => void,
): () => void {
  return onAuthStateChanged(auth, callback);
}

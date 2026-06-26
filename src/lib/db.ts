import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import type { ProviderId } from './providers';
import { db } from './firebase';
import type {
  Bug,
  SprintNote,
  UserProfile,
  TeamNote,
  TeamNoteCategory,
} from '../types';

const BUGS = 'bugs';
const SPRINT_NOTES = 'sprintNotes';
const TEAM_NOTES = 'teamNotes';

/** Converte um valor do Firestore (Timestamp | Date | null) em Date. */
function toDate(value: unknown): Date {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return new Date();
}

/* ------------------------------------------------------------------ */
/* Perfil do usuário                                                  */
/* ------------------------------------------------------------------ */

/**
 * Lê o perfil do usuário em users/{uid}.
 * Retorna null se o documento ainda não existir (ex: usuário recém-criado
 * pelo admin que nunca salvou nada). A chave Anthropic, quando presente,
 * vem deste documento — nunca de localStorage.
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const ref = doc(db, 'users', uid);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();

  // Monta o mapa de chaves por provedor, migrando a chave Anthropic legada.
  const apiKeys: Record<string, string> = {};
  if (data.apiKeys && typeof data.apiKeys === 'object') {
    for (const [provider, value] of Object.entries(
      data.apiKeys as Record<string, unknown>,
    )) {
      if (typeof value === 'string' && value) apiKeys[provider] = value;
    }
  }
  if (typeof data.apiKey === 'string' && data.apiKey && !apiKeys.anthropic) {
    apiKeys.anthropic = data.apiKey;
  }

  return {
    uid,
    email: typeof data.email === 'string' ? data.email : '',
    displayName: typeof data.displayName === 'string' ? data.displayName : '',
    apiKey: typeof data.apiKey === 'string' ? data.apiKey : undefined,
    apiKeys,
  };
}

/**
 * Cria ou atualiza a chave de um provedor de IA em users/{uid}/apiKeys/{provider}.
 * Usa merge para não sobrescrever as chaves dos outros provedores.
 */
export async function updateApiKey(
  uid: string,
  provider: ProviderId,
  apiKey: string,
): Promise<void> {
  const ref = doc(db, 'users', uid);
  await setDoc(
    ref,
    { apiKeys: { [provider]: apiKey }, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/** Remove a chave de um provedor de IA do perfil do usuário. */
export async function removeApiKey(
  uid: string,
  provider: ProviderId,
): Promise<void> {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, { [`apiKeys.${provider}`]: deleteField() });
}

/* ------------------------------------------------------------------ */
/* Bugs                                                               */
/* ------------------------------------------------------------------ */

/** Dados de um novo bug. createdAt/updatedAt são definidos pelo servidor. */
export type NewBug = Omit<Bug, 'createdAt' | 'updatedAt'>;
/** Campos editáveis de um bug existente. */
export type BugUpdate = Partial<
  Omit<Bug, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>
>;

/** Lista todos os bugs, mais recentes primeiro. */
export async function getBugs(): Promise<Bug[]> {
  const q = query(collection(db, BUGS), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d): Bug => {
    const data = d.data();
    return {
      id: d.id,
      title: data.title ?? '',
      module: data.module ?? '',
      sprint: data.sprint ?? '',
      severity: data.severity,
      priority: data.priority,
      environment: data.environment,
      status: data.status,
      description: data.description ?? '',
      evidence: data.evidence ?? '',
      assignee: data.assignee ?? '',
      createdBy: data.createdBy ?? '',
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
    };
  });
}

/** Cria um bug. O id (UUID) é gerado no cliente e vira o id do documento. */
export async function createBug(bug: NewBug): Promise<void> {
  const { id, ...rest } = bug;
  await setDoc(doc(db, BUGS, id), {
    ...rest,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** Atualiza os campos editáveis de um bug. */
export async function updateBug(id: string, changes: BugUpdate): Promise<void> {
  await updateDoc(doc(db, BUGS, id), {
    ...changes,
    updatedAt: serverTimestamp(),
  });
}

/** Remove um bug. */
export async function deleteBug(id: string): Promise<void> {
  await deleteDoc(doc(db, BUGS, id));
}

/* ------------------------------------------------------------------ */
/* Observações de sprint                                              */
/* ------------------------------------------------------------------ */

/** Dados de uma nova nota. createdAt é definido pelo servidor. */
export type NewSprintNote = Omit<SprintNote, 'createdAt'>;

function toSprintNote(d: {
  id: string;
  data: () => Record<string, unknown>;
}): SprintNote {
  const data = d.data();
  return {
    id: d.id,
    sprint: typeof data.sprint === 'string' ? data.sprint : '',
    content: typeof data.content === 'string' ? data.content : '',
    visibility: data.visibility === 'private' ? 'private' : 'public',
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
    createdByName:
      typeof data.createdByName === 'string' ? data.createdByName : '',
    createdAt: toDate(data.createdAt),
  };
}

/**
 * Lista as observações de sprint visíveis para o usuário: todas as públicas
 * mais as privadas dele mesmo. Mais recentes primeiro.
 */
export async function getSprintNotes(uid: string): Promise<SprintNote[]> {
  const coll = collection(db, SPRINT_NOTES);
  const [publicSnap, mineSnap] = await Promise.all([
    getDocs(query(coll, where('visibility', '==', 'public'))),
    getDocs(query(coll, where('createdBy', '==', uid))),
  ]);

  // Dedup (uma nota pública minha apareceria nas duas consultas).
  const byId = new Map<string, SprintNote>();
  for (const d of [...publicSnap.docs, ...mineSnap.docs]) {
    byId.set(d.id, toSprintNote(d));
  }

  return [...byId.values()].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
}

/** Cria uma observação de sprint. O id (UUID) vira o id do documento. */
export async function createSprintNote(note: NewSprintNote): Promise<void> {
  const { id, ...rest } = note;
  await setDoc(doc(db, SPRINT_NOTES, id), {
    ...rest,
    createdAt: serverTimestamp(),
  });
}

/**
 * Atualiza o texto de uma observação de sprint.
 * As regras do Firestore garantem que só o criador consegue gravar.
 */
export async function updateSprintNote(
  id: string,
  content: string,
): Promise<void> {
  await updateDoc(doc(db, SPRINT_NOTES, id), { content });
}

/** Remove uma observação de sprint. */
export async function deleteSprintNote(id: string): Promise<void> {
  await deleteDoc(doc(db, SPRINT_NOTES, id));
}

/* ------------------------------------------------------------------ */
/* Conhecimento do time (observações gerais)                          */
/* ------------------------------------------------------------------ */

export type NewTeamNote = Omit<TeamNote, 'createdAt' | 'updatedAt'>;
export type TeamNoteUpdate = {
  title?: string;
  category?: TeamNoteCategory;
  content?: string;
};

const CATEGORIES: TeamNoteCategory[] = [
  'modulo',
  'sistema',
  'processo',
  'outro',
];

/** Lista todas as notas de conhecimento do time, mais recentes primeiro. */
export async function getTeamNotes(): Promise<TeamNote[]> {
  const q = query(collection(db, TEAM_NOTES), orderBy('updatedAt', 'desc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d): TeamNote => {
    const data = d.data();
    const category = CATEGORIES.includes(data.category as TeamNoteCategory)
      ? (data.category as TeamNoteCategory)
      : 'outro';
    return {
      id: d.id,
      title: typeof data.title === 'string' ? data.title : '',
      category,
      content: typeof data.content === 'string' ? data.content : '',
      createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
      createdByName:
        typeof data.createdByName === 'string' ? data.createdByName : '',
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
    };
  });
}

/** Cria uma nota de conhecimento do time. */
export async function createTeamNote(note: NewTeamNote): Promise<void> {
  const { id, ...rest } = note;
  await setDoc(doc(db, TEAM_NOTES, id), {
    ...rest,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** Atualiza uma nota de conhecimento do time. Só o criador (pelas regras). */
export async function updateTeamNote(
  id: string,
  changes: TeamNoteUpdate,
): Promise<void> {
  await updateDoc(doc(db, TEAM_NOTES, id), {
    ...changes,
    updatedAt: serverTimestamp(),
  });
}

/** Remove uma nota de conhecimento do time. */
export async function deleteTeamNote(id: string): Promise<void> {
  await deleteDoc(doc(db, TEAM_NOTES, id));
}

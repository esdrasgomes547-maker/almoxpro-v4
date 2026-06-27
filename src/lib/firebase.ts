import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, onSnapshot as fsOnSnapshot, Query, DocumentData } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';
import { saveToVirtualCells, loadFromVirtualCells } from '../utils/paradoxCompressor';

const app = initializeApp(firebaseConfig);

// Configuração para banco de dados massivo com cache offline avançado
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);

export const auth = getAuth(app);
export const storage = getStorage(app);

// Robustly handle anonymous authentication preserving state and handling rate limits
let pendingAuthPromise: Promise<any> | null = null;

export const ensureAuth = async (retries = 3) => {
  if (!firebaseConfig.apiKey) {
    console.warn("Firebase configuration is missing or incomplete.");
    return null;
  }

  if (auth.currentUser) {
    return auth.currentUser;
  }

  if (pendingAuthPromise) {
    return pendingAuthPromise;
  }

  pendingAuthPromise = (async () => {
    for (let i = 0; i < retries; i++) {
      try {
        if (!auth.currentUser) {
          await signInAnonymously(auth);
        }
        return auth.currentUser;
      } catch (e: any) {
        if (e.code === 'auth/network-request-failed' && i < retries - 1) {
          console.warn(`Auth retry ${i + 1}/${retries} due to network error...`);
          await new Promise(r => setTimeout(r, 1000 * (i + 1)));
          continue;
        }

        // Handle too-many-requests or other rate limiting gracefully
        if (e.code === 'auth/too-many-requests') {
          console.warn("Firebase Anonymous Auth is temporarily rate-limited (too-many-requests). Carrying on safely with cached/offline capabilities.");
          break;
        }
        
        // Graceful handling for known non-fatal auth issues on Vercel/sandboxes
        if (e.code === 'auth/operation-not-allowed' || e.code === 'auth/admin-restricted-operation') {
          console.warn("Firebase Anonymous Auth is not fully supported or enabled in this environment; skipping.");
        } else {
          console.error("Firebase Anonymous Auth failed:", e.message);
        }
        break;
      }
    }
    return auth.currentUser;
  })();

  try {
    return await pendingAuthPromise;
  } finally {
    pendingAuthPromise = null;
  }
};

// Initiate auth
ensureAuth();

export const signInWithGoogle = () => {
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
};

export const loginWithEmail = (email: string, pass: string) => {
  return signInWithEmailAndPassword(auth, email, pass);
};

export const createUserWithEmail = (email: string, pass: string) => {
  return createUserWithEmailAndPassword(auth, email, pass);
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errStr = error instanceof Error ? error.message : String(error);
  if (errStr.toLowerCase().includes('quota') || errStr.toLowerCase().includes('exhausted') || errStr.toLowerCase().includes('limit')) {
    localStorage.setItem("almoxPro_quotaExceeded", "true");
    console.warn("ALMOX PRO NOTICE: Firebase Quota Reached. Activating cached/demo layout state.");
    return;
  }
  const errInfo: FirestoreErrorInfo = {
    error: errStr,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    const testDoc = await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firebase connection successful:", testDoc.exists() ? "Document found" : "Document not found (expected)");
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    if (errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('exhausted') || errMsg.toLowerCase().includes('limit')) {
      console.warn("ALMOX PRO NOTE: Firebase connection reached free quota limit. Activating client-side gracefully with local fallback: " + errMsg);
      localStorage.setItem("almoxPro_quotaExceeded", "true");
      return;
    }
    // If it's permission denied, it means we ARE talking to the server!
    if (error.code === 'permission-denied') {
      console.log("Firebase communication established (Permission Denied for test doc).");
      return;
    }
    if (error.message && error.message.includes('the client is offline')) {
      console.error("CRITICAL: Firebase client is offline. Check project provisioning and network.");
    } else {
      console.error("Firebase connection test failed:", error);
    }
  }
}
testConnection();

/**
 * Se inscreve em um query do Firestore, salvando os resultados no Cache Paradoxal Local (CPQ-1KB).
 * Caso a cota diária esteja estourada ou o usuário tenha ativado o Modo Local-First,
 * retorna instantaneamente os dados do armazenamento local.
 */
export function safeOnSnapshot(
  firestoreQuery: Query<DocumentData>,
  cacheKey: string,
  onNext: (data: any[]) => void,
  onError?: (error: any) => void
) {
  const isLocalFirst = localStorage.getItem("almoxPro_localFirstMode") === "true";
  const quotaExceeded = localStorage.getItem("almoxPro_quotaExceeded") === "true";

  if (isLocalFirst || quotaExceeded) {
    const cached = loadFromVirtualCells(cacheKey);
    console.log(`[Paradox Core Active] Servindo ${cached.length} itens do Cache Local para: ${cacheKey}`);
    onNext(cached);
    return () => {}; // retorno de unsub vazio
  }

  try {
    return fsOnSnapshot(firestoreQuery, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      saveToVirtualCells(cacheKey, list);
      onNext(list);
    }, (err) => {
      const errStr = err?.message || String(err);
      if (errStr.toLowerCase().includes('quota') || errStr.toLowerCase().includes('exhausted') || errStr.toLowerCase().includes('limit')) {
        localStorage.setItem("almoxPro_quotaExceeded", "true");
        console.warn(`[Paradox Auto-Switch Alert] Quota excedida ao ler ${cacheKey}. Chaveamento automático de emergência ativado.`);
        const cached = loadFromVirtualCells(cacheKey);
        onNext(cached);
        return;
      }
      if (onError) {
        onError(err);
      } else {
        console.error(`Erro na subscrição do Firestore (${cacheKey}):`, err);
      }
    });
  } catch (err: any) {
    console.warn(`Erro crítico ao tentar safeOnSnapshot na chave ${cacheKey}, usando cache local:`, err);
    const cached = loadFromVirtualCells(cacheKey);
    onNext(cached);
    return () => {};
  }
}


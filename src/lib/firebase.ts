/// <reference types="vite/client" />
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import appletConfig from "../../firebase-applet-config.json";

// Structure for Firebase credentials
export interface FirebaseCredentials {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

// Get config from Environment variables (with VITE_ prefix for client side) or fallback to applet configuration
export function getFirebaseConfig(): FirebaseCredentials | null {
  // First, prioritize Environment variables
  const envConfig: FirebaseCredentials = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
  };

  if (envConfig.apiKey && envConfig.projectId) {
    return envConfig;
  }

  // Fallback to the auto-generated applet configuration
  if (appletConfig && appletConfig.apiKey && appletConfig.projectId) {
    return {
      apiKey: appletConfig.apiKey,
      authDomain: appletConfig.authDomain,
      projectId: appletConfig.projectId,
      storageBucket: appletConfig.storageBucket,
      messagingSenderId: appletConfig.messagingSenderId,
      appId: appletConfig.appId,
    };
  }

  return null;
}

// Helper to determine if we have a valid configuration loaded
export function isFirebaseConfigured(): boolean {
  return getFirebaseConfig() !== null;
}

let firebaseAuthInstance: Auth | null = null;
let firebaseFirestoreInstance: Firestore | null = null;
let isInitializedSimulated = false;

// Safe initializer to avoid crashing the application
export function initFirebase() {
  const config = getFirebaseConfig();

  if (!config) {
    if (!isInitializedSimulated) {
      console.warn(
        "⚠️ [Firebase] Nenhuma chave do Firebase configurada. O sistema entrará em modo de simulação interativo para demonstração do RBAC (Controle de Acesso Baseado em Papéis). Defina as credenciais no painel de controle!"
      );
      isInitializedSimulated = true;
    }
    return {
      auth: null,
      db: null,
      isMock: true,
    };
  }

  try {
    const app = getApps().length === 0 ? initializeApp(config) : getApp();
    firebaseAuthInstance = getAuth(app);
    
    const dbId = (config as any).firestoreDatabaseId || appletConfig?.firestoreDatabaseId;
    firebaseFirestoreInstance = dbId ? getFirestore(app, dbId) : getFirestore(app);

    return {
      auth: firebaseAuthInstance,
      db: firebaseFirestoreInstance,
      isMock: false,
    };
  } catch (error) {
    console.error("❌ Falha ao inicializar o Firebase SDK real:", error);
    return {
      auth: null,
      db: null,
      isMock: true,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Lazy-getters for export to avoid top-level module load failures
export function getFirebaseAuth(): Auth {
  const { auth, isMock } = initFirebase();
  if (isMock || !auth) {
    throw new Error("Firebase Auth não está configurado ou inicializado. Use a simulação ou configure as chaves.");
  }
  return auth;
}

export function getFirebaseDb(): Firestore {
  const { db, isMock } = initFirebase();
  if (isMock || !db) {
    throw new Error("Firebase Firestore não está configurado ou inicializado. Use a simulação ou configure as chaves.");
  }
  return db;
}

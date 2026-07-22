/**
 * neonAuth.ts
 * -----------
 * Serviço de autenticação usando Neon Auth (Stack Auth SDK).
 * Substitui firebase.ts + firebaseAuth.ts.
 *
 * Instalação:
 *   npm install @stackframe/stack
 */

import { StackClientApp } from "@stackframe/stack";

// ─────────────────────────────────────────────
// Configuração do Neon Auth (Stack Auth)
// ─────────────────────────────────────────────
const NEON_AUTH_PROJECT_ID = import.meta.env.VITE_NEON_AUTH_PROJECT_ID || "";
const NEON_AUTH_PUBLISHABLE_KEY = import.meta.env.VITE_NEON_AUTH_PUBLISHABLE_KEY || "";

// Instância singleton do Stack Auth Client
let _stackApp: StackClientApp<true> | null = null;

export function getStackApp(): StackClientApp<true> {
  if (!_stackApp) {
    if (!NEON_AUTH_PROJECT_ID || !NEON_AUTH_PUBLISHABLE_KEY) {
      throw new Error(
        "VITE_NEON_AUTH_PROJECT_ID e VITE_NEON_AUTH_PUBLISHABLE_KEY não configurados. " +
        "Verifique o arquivo .env."
      );
    }
    _stackApp = new StackClientApp({
      tokenStore: "nextjs-cookie", // usa cookie HTTP-only por padrão
      // Para SPAs sem Next.js, use:
      // tokenStore: "cookie",
      projectId: NEON_AUTH_PROJECT_ID,
      publishableClientKey: NEON_AUTH_PUBLISHABLE_KEY,
      urls: {
        home: "/",
        signIn: "/login",
        afterSignIn: "/",
        afterSignOut: "/login",
      },
    });
  }
  return _stackApp;
}

// ─────────────────────────────────────────────
// Funções de Autenticação
// ─────────────────────────────────────────────

/**
 * Faz login com email e senha via Neon Auth.
 * Retorna o token de acesso JWT em caso de sucesso.
 */
export async function signInWithEmailPassword(
  email: string,
  password: string
): Promise<{ accessToken: string; userId: string }> {
  const app = getStackApp();
  const result = await app.signInWithCredential({ email, password });

  if (result.status === "error") {
    throw new Error(result.error?.message || "Credenciais inválidas.");
  }

  const user = await app.getUser();
  if (!user) throw new Error("Falha ao obter dados do usuário após login.");

  const token = await user.getAuthJson();
  const accessToken = token?.accessToken || "";

  return { accessToken, userId: user.id };
}

/**
 * Faz logout do usuário atual.
 */
export async function signOut(): Promise<void> {
  const app = getStackApp();
  const user = await app.getUser();
  if (user) {
    await user.signOut();
  }
}

/**
 * Obtém o token de acesso JWT do usuário autenticado.
 * Retorna null se não há usuário logado.
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    const app = getStackApp();
    const user = await app.getUser();
    if (!user) return null;
    const authJson = await user.getAuthJson();
    return authJson?.accessToken || null;
  } catch {
    return null;
  }
}

/**
 * Obtém o usuário atual (sem informações de role — role vem da API Flask).
 * Retorna null se não há usuário logado.
 */
export async function getCurrentUser(): Promise<{
  id: string;
  email: string;
  displayName: string;
} | null> {
  try {
    const app = getStackApp();
    const user = await app.getUser();
    if (!user) return null;
    return {
      id: user.id,
      email: user.primaryEmail || "",
      displayName: user.displayName || user.primaryEmail || "",
    };
  } catch {
    return null;
  }
}

/**
 * Altera a senha do usuário logado (para alunos no primeiro acesso).
 */
export async function changePassword(
  oldPassword: string,
  newPassword: string
): Promise<void> {
  const app = getStackApp();
  const user = await app.getUser();
  if (!user) throw new Error("Usuário não autenticado.");

  // Stack Auth: usar updatePassword
  await (user as any).updatePassword({ oldPassword, newPassword });
}

/**
 * Verifica se o Neon Auth está configurado corretamente.
 */
export function isNeonAuthConfigured(): boolean {
  return !!(NEON_AUTH_PROJECT_ID && NEON_AUTH_PUBLISHABLE_KEY);
}

/**
 * neonAuth.ts (Autenticação Nativa do CodeTracker ETE)
 * -----------------------------------------------------
 * Gerenciamento de sessão e tokens JWT via API Flask local
 * com senhas criptografadas no Neon PostgreSQL.
 */

import type { AuthUser } from "../types";
export type { AuthUser };

const TOKEN_KEY = "codetracker_auth_token";
const USER_KEY = "codetracker_auth_user";

/**
 * Faz login com email/matrícula e senha via API Flask do CodeTracker.
 * Retorna o token de acesso JWT em caso de sucesso.
 */
export async function signInWithEmailPassword(
  identifier: string,
  password: string
): Promise<{ accessToken: string; userId: string; user?: any }> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ identifier, password }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Credenciais inválidas. Verifique usuário/matrícula e senha.");
  }

  const token = data.token;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));

  return {
    accessToken: token,
    userId: data.user.id,
    user: data.user,
  };
}

/**
 * Faz logout do usuário atual limpando os tokens locais.
 */
export async function signOut(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    // Continua mesmo se a rede falhar
  }
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Obtém o token de acesso JWT do usuário autenticado.
 * Retorna null se não há usuário logado.
 */
export async function getAccessToken(): Promise<string | null> {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Obtém o usuário atual salvo na sessão local.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const userJson = localStorage.getItem(USER_KEY);
  if (!userJson) return null;

  try {
    const u = JSON.parse(userJson);
    return {
      id: u.id,
      email: u.email || "",
      displayName: u.displayName || u.name || u.email || "",
      role: (u.role as "admin" | "professor" | "aluno") || "aluno",
      entityId: u.entityId || u.entity_id || null,
    };
  } catch {
    return null;
  }
}

/**
 * Altera a senha do usuário logado diretamente no banco.
 */
export async function changePassword(
  oldPassword: string,
  newPassword: string
): Promise<void> {
  const token = await getAccessToken();
  const response = await fetch("/api/auth/alterar-senha", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      old_password: oldPassword,
      new_password: newPassword,
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || "Falha ao alterar senha.");
  }
}

/**
 * Verifica se a autenticação está ativa (sempre true no modo nativo).
 */
export function isNeonAuthConfigured(): boolean {
  return true;
}

/**
 * Stub de compatibilidade legado caso seja chamado em algum componente.
 */
export function getStackApp(): any {
  return null;
}

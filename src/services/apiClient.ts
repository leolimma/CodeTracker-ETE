/**
 * apiClient.ts
 * ------------
 * Cliente HTTP centralizado para a API Flask do CodeTracker ETE.
 * Substitui firebaseDb.ts — dados vêm do Neon PostgreSQL via Flask.
 *
 * Todas as requisições adicionam automaticamente o token JWT do Neon Auth.
 */

import { getAccessToken } from "./neonAuth";
import type {
  ClassItem, Student, Exercise, StatusAtividade, StatusLog,
  AuditLog, ProfessorDashboardData, AIMensagem, Professor
} from "../types";

// Base URL da API — em produção aponta para o Render, em dev para o Flask local
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

// ─────────────────────────────────────────────
// Função base de fetch com autenticação
// ─────────────────────────────────────────────
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAccessToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `Erro ${response.status}: ${response.statusText}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorData.message || errorMessage;
    } catch {
      // ignora erros de parse do JSON de erro
    }
    throw new Error(errorMessage);
  }

  return response.json() as Promise<T>;
}

// ─────────────────────────────────────────────
// AUTH / PERFIL
// ─────────────────────────────────────────────
export async function getMe(): Promise<{ auth_user_id: string; role: "admin" | "professor" | "aluno"; entity_id: string | null }> {
  return apiFetch("/api/me");
}

// ─────────────────────────────────────────────
// TURMAS
// ─────────────────────────────────────────────
export async function getTurmas(): Promise<ClassItem[]> {
  const data = await apiFetch<{ success: boolean; turmas: ClassItem[] }>("/api/turmas");
  return data.turmas.map(normalizeClassItem);
}

export async function criarTurma(payload: {
  nome: string; ano: string; curso: string; sala?: string;
}): Promise<ClassItem> {
  const data = await apiFetch<{ success: boolean; turma: ClassItem }>("/api/turmas", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return normalizeClassItem(data.turma);
}

export async function editarTurma(id: string, payload: Partial<ClassItem>): Promise<ClassItem> {
  const data = await apiFetch<{ success: boolean; turma: ClassItem }>(`/api/turmas/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return normalizeClassItem(data.turma);
}

export async function excluirTurma(id: string): Promise<void> {
  await apiFetch(`/api/turmas/${id}`, { method: "DELETE" });
}

export async function definirExercicioAtivo(
  turmaId: string, exercicioId: string | null
): Promise<void> {
  await apiFetch(`/api/turmas/${turmaId}/exercicio-ativo`, {
    method: "POST",
    body: JSON.stringify({ exercicio_id: exercicioId }),
  });
}

// ─────────────────────────────────────────────
// EXERCÍCIOS
// ─────────────────────────────────────────────
export async function getExercicios(query?: string): Promise<Exercise[]> {
  const qs = query ? `?q=${encodeURIComponent(query)}` : "";
  const data = await apiFetch<{ success: boolean; exercicios: Exercise[] }>(`/api/exercicios${qs}`);
  return data.exercicios.map(normalizeExercise);
}

export async function criarExercicio(payload: Partial<Exercise>): Promise<Exercise> {
  const data = await apiFetch<{ success: boolean; exercicio: Exercise }>("/api/exercicios", {
    method: "POST",
    body: JSON.stringify(denormalizeExercise(payload)),
  });
  return normalizeExercise(data.exercicio);
}

export async function editarExercicio(id: string, payload: Partial<Exercise>): Promise<Exercise> {
  const data = await apiFetch<{ success: boolean; exercicio: Exercise }>(`/api/exercicios/${id}`, {
    method: "PUT",
    body: JSON.stringify(denormalizeExercise(payload)),
  });
  return normalizeExercise(data.exercicio);
}

export async function excluirExercicio(id: string): Promise<void> {
  await apiFetch(`/api/exercicios/${id}`, { method: "DELETE" });
}

// ─────────────────────────────────────────────
// ALUNOS
// ─────────────────────────────────────────────
export async function getAlunos(turmaId?: string): Promise<Student[]> {
  const qs = turmaId ? `?turma_id=${turmaId}` : "";
  const data = await apiFetch<{ success: boolean; alunos: Student[] }>(`/api/alunos${qs}`);
  return data.alunos.map(normalizeStudent);
}

export async function criarAluno(payload: {
  nome: string; matricula?: string; turma_id: string; email?: string; foto?: string;
}): Promise<Student> {
  const data = await apiFetch<{ success: boolean; aluno: Student }>("/api/alunos", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return normalizeStudent(data.aluno);
}

export async function importarAlunosCSV(payload: {
  csv_text: string; turma_id: string;
}): Promise<{ importados: number; ignorados: number; erros: string[] }> {
  return apiFetch("/api/alunos/importar-csv", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function editarAluno(id: string, payload: Partial<Student>): Promise<Student> {
  const data = await apiFetch<{ success: boolean; aluno: Student }>(`/api/alunos/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return normalizeStudent(data.aluno);
}

export async function excluirAluno(id: string): Promise<void> {
  await apiFetch(`/api/alunos/${id}`, { method: "DELETE" });
}

// ─────────────────────────────────────────────
// STATUS ATIVIDADES
// ─────────────────────────────────────────────
export async function atualizarStatus(payload: {
  atividade_id: string;
  estado_atual: string;
  progresso?: number;
  observacao?: string;
}): Promise<{ estado_atual: string; progresso: number; tempo_gasto?: string }> {
  return apiFetch("/api/atividades/status", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function salvarObservacao(atividadeId: string, observacao: string): Promise<void> {
  await apiFetch("/api/atividades/observacao", {
    method: "POST",
    body: JSON.stringify({ atividade_id: atividadeId, observacao }),
  });
}

export async function salvarCodigo(atividadeId: string, codigo: string): Promise<void> {
  await apiFetch("/api/atividades/codigo", {
    method: "POST",
    body: JSON.stringify({ atividade_id: atividadeId, codigo }),
  });
}

export async function atribuirNota(payload: {
  atividade_id: string; nota: number; observacao?: string;
}): Promise<StatusAtividade> {
  const data = await apiFetch<{ success: boolean; atividade: StatusAtividade }>(
    "/api/atividades/nota", { method: "POST", body: JSON.stringify(payload) }
  );
  return data.atividade;
}

// ─────────────────────────────────────────────
// DASHBOARD DO PROFESSOR
// ─────────────────────────────────────────────
export async function getProfessorDados(): Promise<ProfessorDashboardData> {
  const data = await apiFetch<ProfessorDashboardData & { success: boolean }>(
    "/api/professor/dados"
  );
  return {
    turmas: data.turmas.map(normalizeClassItem),
    exercicios: data.exercicios.map(normalizeExercise),
    alunos: data.alunos.map(normalizeStudent),
    atividades: data.atividades,
    historico: data.historico,
    stats: data.stats,
  };
}

// ─────────────────────────────────────────────
// DASHBOARD DO ALUNO
// ─────────────────────────────────────────────
export async function getAlunoDados(): Promise<{
  aluno: Student;
  atividades: StatusAtividade[];
  exercicio_ativo_id: string | null;
}> {
  return apiFetch("/api/aluno/dados");
}

export async function marcarPrimeiroAcesso(): Promise<void> {
  await apiFetch("/api/aluno/primeiro-acesso", { method: "POST" });
}

// ─────────────────────────────────────────────
// PROFESSORES
// ─────────────────────────────────────────────
export async function getProfessores(): Promise<Professor[]> {
  const data = await apiFetch<{ success: boolean; professores: Professor[] }>(
    "/api/professores"
  );
  return data.professores;
}

export async function criarProfessor(payload: {
  usuario: string; email: string; nome: string;
}): Promise<Professor> {
  const data = await apiFetch<{ success: boolean; professor: Professor }>("/api/professores", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.professor;
}

export async function excluirProfessor(id: string): Promise<void> {
  await apiFetch(`/api/professores/${id}`, { method: "DELETE" });
}

// ─────────────────────────────────────────────
// LOGS & AUDIT
// ─────────────────────────────────────────────
export async function getLogs(): Promise<StatusLog[]> {
  return apiFetch<StatusLog[]>("/api/logs");
}

export async function getAuditLogs(limit = 100): Promise<AuditLog[]> {
  return apiFetch<AuditLog[]>(`/api/admin/audits?limit=${limit}`);
}

// ─────────────────────────────────────────────
// ADMIN: EXPORT
// ─────────────────────────────────────────────
export async function exportarDados(): Promise<void> {
  const token = await getAccessToken();
  const response = await fetch(`${API_BASE}/api/admin/export`, {
    headers: { Authorization: token ? `Bearer ${token}` : "" },
  });
  if (!response.ok) throw new Error("Erro ao exportar dados.");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `codetracker_backup_${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────
// AI TUTOR
// ─────────────────────────────────────────────
export async function consultarTutor(payload: {
  exercicio_id: string;
  codigo_atual?: string;
  duvida: string;
  historico_conversa?: AIMensagem[];
}): Promise<{ resposta: string; exercicio_titulo: string }> {
  return apiFetch("/api/ai/tutor", {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      historico_conversa: (payload.historico_conversa || []).map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        content: m.content,
      })),
    }),
  });
}

// ─────────────────────────────────────────────
// Normalizadores de compatibilidade
// (mantêm campos legacy para componentes antigos)
// ─────────────────────────────────────────────
function normalizeClassItem(t: ClassItem): ClassItem {
  return {
    ...t,
    // Compatibilidade com código legado que usa campos em inglês
    name: t.nome,
    room: t.sala || "",
    activeExerciseId: t.exercicio_ativo_id,
  };
}

function normalizeStudent(a: Student): Student {
  return {
    ...a,
    name: a.nome,
    classId: a.turma_id,
    avatar: a.foto || "default",
    // Campos legacy que não existem mais no DB
    status: "IDLE",
    lastUpdate: a.updated_at || new Date().toISOString(),
    progress: 0,
    grade: null,
    notes: "",
  };
}

function normalizeExercise(e: Exercise): Exercise {
  const nivelMap: Record<string, "EASY" | "MEDIUM" | "HARD"> = {
    "Fácil": "EASY", "Médio": "MEDIUM", "Difícil": "HARD",
  };
  return {
    ...e,
    title: e.titulo,
    module: e.modulo,
    description: e.descricao,
    difficulty: nivelMap[e.nivel] || "EASY",
    estimatedTime: e.tempo_estimado,
  };
}

function denormalizeExercise(e: Partial<Exercise>): object {
  const nivelMap: Record<string, string> = {
    EASY: "Fácil", MEDIUM: "Médio", HARD: "Difícil",
  };
  return {
    titulo: e.titulo || e.title,
    modulo: e.modulo || e.module,
    descricao: e.descricao || e.description,
    nivel: e.nivel || (e.difficulty ? nivelMap[e.difficulty] : undefined),
    tempo_estimado: e.tempo_estimado ?? e.estimatedTime,
    objetivo_aprendizado: e.objetivo_aprendizado,
    enunciado: e.enunciado,
    entrada_esperada: e.entrada_esperada,
    saida_esperada: e.saida_esperada,
    exemplo_entrada: e.exemplo_entrada,
    exemplo_saida: e.exemplo_saida,
    observacoes: e.observacoes,
  };
}

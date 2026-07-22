// ============================================================
// Tipos do CodeTracker ETE — Alinhados com Neon PostgreSQL
// ============================================================

// Usuário autenticado via Neon Auth
export interface AuthUser {
  id: string;          // auth_user_id (Neon Auth)
  email: string;
  displayName: string;
  role: "admin" | "professor" | "aluno";
  entityId: string | null; // ID em alunos ou professores
}

// Turma
export interface ClassItem {
  id: string;
  nome: string;          // era: name
  ano: string;
  curso: string;
  sala: string | null;   // era: room
  exercicio_ativo_id: string | null; // era: activeExerciseId
  total_alunos?: number;
  created_at?: string;
  updated_at?: string;

  // Compatibilidade com componentes antigos
  name?: string;
  room?: string;
  activeExerciseId?: string | null;
}

// Aluno
export interface Student {
  id: string;
  nome: string;           // era: name
  matricula: string;
  email: string;
  foto: string | null;    // era: avatar
  turma_id: string;       // era: classId
  turma_nome?: string;
  auth_user_id?: string;
  primeiro_acesso?: boolean;
  created_at?: string;
  updated_at?: string;

  // Compatibilidade com componentes antigos
  name?: string;
  classId?: string;
  avatar?: string;
  status?: string;
  lastUpdate?: string;
  progress?: number;
  grade?: number | null;
  notes?: string;
}

// Exercício
export interface Exercise {
  id: string;
  titulo: string;                  // era: title
  modulo: string;                  // era: module
  descricao: string;               // era: description
  nivel: "Fácil" | "Médio" | "Difícil"; // era: difficulty (EASY/MEDIUM/HARD)
  tempo_estimado: number;          // era: estimatedTime
  objetivo_aprendizado: string;
  enunciado: string;
  entrada_esperada: string;
  saida_esperada: string;
  exemplo_entrada: string;
  exemplo_saida: string;
  observacoes?: string;
  ativo?: boolean;
  created_at?: string;
  updated_at?: string;

  // Compatibilidade com componentes antigos
  title?: string;
  module?: string;
  description?: string;
  difficulty?: "EASY" | "MEDIUM" | "HARD";
  estimatedTime?: number;
}

// Status de Atividade (aluno × exercício)
export interface StatusAtividade {
  id: string;
  aluno_id: string;
  exercicio_id: string;
  estado_atual: "Não Iniciado" | "Codificando" | "Preciso de Ajuda" | "Pausado" | "Concluído";
  progresso: number;
  codigo_salvo?: string;
  tempo_inicio?: string;
  tempo_fim?: string;
  observacao?: string;
  nota?: number | null;
  created_at?: string;
  updated_at?: string;

  // Campos da view vw_atividades_professor
  aluno_nome?: string;
  matricula?: string;
  aluno_foto?: string;
  turma_id?: string;
  turma_nome?: string;
  exercicio_titulo?: string;
  exercicio_modulo?: string;
  exercicio_nivel?: string;
  tempo_estimado?: number;
  tempo_gasto_segundos?: number;

  // Compatibilidade
  status?: string;
}

// Log de Status (feed ao vivo)
export interface StatusLog {
  id: string;
  aluno_id: string;
  aluno_nome?: string;
  exercicio_id: string;
  exercicio_titulo?: string;
  estado_antigo?: string;
  estado_novo: string;
  timestamp: string;

  // Compatibilidade
  studentId?: string;
  studentName?: string;
  classId?: string;
  exerciseId?: string;
  oldStatus?: string;
  newStatus?: string;
}

// Histórico de status
export interface HistoricoStatus {
  id: string;
  aluno_id: string;
  exercicio_id: string;
  estado_anterior?: string;
  estado_novo: string;
  progresso: number;
  tempo_decorrido?: number;
  observacao?: string;
  timestamp: string;
}

// Professor
export interface Professor {
  id: string;
  usuario: string;
  email: string;
  nome: string;
  auth_user_id?: string;
  created_at?: string;
}

// Audit Log
export interface AuditLog {
  id: string;
  auth_user_id?: string;
  user_type: string;
  user_name: string;
  action: string;
  description: string;
  ip_address?: string;
  timestamp: string;
}

// Dados do dashboard do professor
export interface ProfessorDashboardData {
  turmas: ClassItem[];
  exercicios: Exercise[];
  alunos: Student[];
  atividades: StatusAtividade[];
  historico: HistoricoStatus[];
  stats: TurmaStats[];
}

// Estatísticas por turma
export interface TurmaStats {
  turma_id: string;
  turma_nome: string;
  exercicio_id: string;
  exercicio_titulo: string;
  total_alunos: number;
  concluidos: number;
  codificando: number;
  pedindo_ajuda: number;
  pausados: number;
  nao_iniciados: number;
  progresso_medio: number;
  nota_media: number;
}

// Mensagem do chat com AI Tutor
export interface AIMensagem {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

// Helpers de normalização (compatibilidade com código antigo)
export function normalizarNivel(nivel: string): "Fácil" | "Médio" | "Difícil" {
  const map: Record<string, "Fácil" | "Médio" | "Difícil"> = {
    EASY: "Fácil", Fácil: "Fácil",
    MEDIUM: "Médio", Médio: "Médio",
    HARD: "Difícil", Difícil: "Difícil"
  };
  return map[nivel] || "Médio";
}

export function normalizarEstado(estado: string): StatusAtividade["estado_atual"] {
  const map: Record<string, StatusAtividade["estado_atual"]> = {
    IDLE: "Não Iniciado", "Não Iniciado": "Não Iniciado",
    CODING: "Codificando", Codificando: "Codificando",
    HELP: "Preciso de Ajuda", "Preciso de Ajuda": "Preciso de Ajuda",
    PAUSED: "Pausado", Pausado: "Pausado",
    COMPLETED: "Concluído", Concluído: "Concluído"
  };
  return map[estado] || "Não Iniciado";
}

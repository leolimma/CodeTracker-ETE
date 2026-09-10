-- ============================================================
-- CodeTracker ETE — Schema PostgreSQL Completo (CREATE)
-- Versão: 001
-- Inclui: Extensões, Tabelas, Índices, Triggers e Views
-- ============================================================

-- 0. Tabela de Controle de Versão de Migrações
CREATE TABLE IF NOT EXISTS schema_migrations (
    version     TEXT PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 1. Extensões PostgreSQL
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- 2. Domínio Acadêmico
-- ============================================================

-- Tabela: turmas
CREATE TABLE IF NOT EXISTS turmas (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome        TEXT NOT NULL,
  ano         TEXT NOT NULL,
  curso       TEXT NOT NULL,
  sala        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela: professores
CREATE TABLE IF NOT EXISTS professores (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario       TEXT UNIQUE NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  nome          TEXT NOT NULL DEFAULT '',
  senha_hash    TEXT,
  auth_user_id  TEXT UNIQUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_professores_auth_user_id ON professores(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_professores_email ON professores(email);

-- Tabela: alunos
CREATE TABLE IF NOT EXISTS alunos (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome             TEXT NOT NULL,
  matricula        TEXT UNIQUE NOT NULL,
  email            TEXT UNIQUE NOT NULL,
  foto             TEXT,
  turma_id         UUID NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
  senha_hash       TEXT,
  auth_user_id     TEXT UNIQUE,
  primeiro_acesso  BOOLEAN NOT NULL DEFAULT TRUE,
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alunos_turma_id     ON alunos(turma_id);
CREATE INDEX IF NOT EXISTS idx_alunos_email        ON alunos(email);
CREATE INDEX IF NOT EXISTS idx_alunos_auth_user_id ON alunos(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_alunos_matricula    ON alunos(matricula);

-- Tabela: exercicios
CREATE TABLE IF NOT EXISTS exercicios (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo               TEXT NOT NULL,
  modulo               TEXT NOT NULL,
  descricao            TEXT NOT NULL DEFAULT '',
  nivel                TEXT NOT NULL CHECK (nivel IN ('Fácil', 'Médio', 'Difícil')),
  tempo_estimado       INTEGER NOT NULL DEFAULT 15,
  objetivo_aprendizado TEXT NOT NULL DEFAULT '',
  enunciado            TEXT NOT NULL DEFAULT '',
  entrada_esperada     TEXT NOT NULL DEFAULT '',
  saida_esperada       TEXT NOT NULL DEFAULT '',
  exemplo_entrada      TEXT NOT NULL DEFAULT '',
  exemplo_saida        TEXT NOT NULL DEFAULT '',
  observacoes          TEXT,
  ativo                BOOLEAN NOT NULL DEFAULT TRUE,
  search_vector        TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('portuguese',
      COALESCE(titulo, '') || ' ' ||
      COALESCE(modulo, '') || ' ' ||
      COALESCE(descricao, '') || ' ' ||
      COALESCE(enunciado, '')
    )
  ) STORED,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_exercicios_fts   ON exercicios USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_exercicios_ativo ON exercicios(ativo);

-- Tabela: exercício ativo por turma
CREATE TABLE IF NOT EXISTS turmas_exercicio_ativo (
  turma_id      UUID PRIMARY KEY REFERENCES turmas(id) ON DELETE CASCADE,
  exercicio_id  UUID REFERENCES exercicios(id) ON DELETE SET NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela: status_atividades
CREATE TABLE IF NOT EXISTS status_atividades (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  aluno_id      UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  exercicio_id  UUID NOT NULL REFERENCES exercicios(id) ON DELETE CASCADE,
  estado_atual  TEXT NOT NULL DEFAULT 'Não Iniciado'
    CHECK (estado_atual IN ('Não Iniciado', 'Codificando', 'Preciso de Ajuda', 'Pausado', 'Concluído')),
  progresso     INTEGER NOT NULL DEFAULT 0 CHECK (progresso BETWEEN 0 AND 100),
  codigo_salvo  TEXT,
  tempo_inicio  TIMESTAMPTZ,
  tempo_fim     TIMESTAMPTZ,
  observacao    TEXT,
  nota          NUMERIC(4,1),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(aluno_id, exercicio_id)
);
CREATE INDEX IF NOT EXISTS idx_status_aluno     ON status_atividades(aluno_id);
CREATE INDEX IF NOT EXISTS idx_status_exercicio ON status_atividades(exercicio_id);
CREATE INDEX IF NOT EXISTS idx_status_estado    ON status_atividades(estado_atual);

-- Tabela: historico_status
CREATE TABLE IF NOT EXISTS historico_status (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  aluno_id        UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  exercicio_id    UUID NOT NULL REFERENCES exercicios(id) ON DELETE CASCADE,
  estado_anterior TEXT,
  estado_novo     TEXT NOT NULL,
  progresso       INTEGER NOT NULL DEFAULT 0,
  tempo_decorrido INTEGER,
  observacao      TEXT,
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_historico_aluno     ON historico_status(aluno_id);
CREATE INDEX IF NOT EXISTS idx_historico_exercicio ON historico_status(exercicio_id);
CREATE INDEX IF NOT EXISTS idx_historico_timestamp ON historico_status(timestamp DESC);

-- ============================================================
-- 3. Autenticação e RBAC
-- ============================================================
CREATE TABLE IF NOT EXISTS user_roles (
  auth_user_id  TEXT PRIMARY KEY,
  role          TEXT NOT NULL CHECK (role IN ('admin', 'professor', 'aluno')),
  entity_id     UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. Logs e Auditoria
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id  TEXT,
  user_type     TEXT NOT NULL,
  user_name     TEXT NOT NULL,
  action        TEXT NOT NULL,
  description   TEXT NOT NULL,
  ip_address    TEXT,
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user_type ON audit_logs(user_type);

CREATE TABLE IF NOT EXISTS logs_status (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  aluno_id      UUID REFERENCES alunos(id) ON DELETE SET NULL,
  exercicio_id  UUID REFERENCES exercicios(id) ON DELETE SET NULL,
  estado_antigo TEXT,
  estado_novo   TEXT NOT NULL,
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_logs_status_timestamp ON logs_status(timestamp DESC);

-- ============================================================
-- 5. Views
-- ============================================================
CREATE OR REPLACE VIEW vw_atividades_professor AS
SELECT
  sa.id,
  sa.updated_at                                             AS ultima_atualizacao,
  a.id                                                      AS aluno_id,
  a.nome                                                    AS aluno_nome,
  a.matricula,
  a.foto                                                    AS aluno_foto,
  a.primeiro_acesso,
  t.id                                                      AS turma_id,
  t.nome                                                    AS turma_nome,
  t.sala,
  e.id                                                      AS exercicio_id,
  e.titulo                                                  AS exercicio_titulo,
  e.modulo                                                  AS exercicio_modulo,
  e.nivel                                                   AS exercicio_nivel,
  e.tempo_estimado,
  sa.estado_atual,
  sa.progresso,
  sa.nota,
  sa.tempo_inicio,
  sa.tempo_fim,
  sa.observacao,
  sa.codigo_salvo,
  EXTRACT(EPOCH FROM (COALESCE(sa.tempo_fim, NOW()) - sa.tempo_inicio))::INTEGER
    AS tempo_gasto_segundos
FROM status_atividades sa
JOIN alunos   a ON sa.aluno_id      = a.id
JOIN turmas   t ON a.turma_id       = t.id
JOIN exercicios e ON sa.exercicio_id = e.id;

CREATE OR REPLACE VIEW vw_stats_turma AS
SELECT
  t.id                                           AS turma_id,
  t.nome                                         AS turma_nome,
  e.id                                           AS exercicio_id,
  e.titulo                                       AS exercicio_titulo,
  COUNT(sa.id)                                   AS total_alunos,
  COUNT(*) FILTER (WHERE sa.estado_atual = 'Concluído')       AS concluidos,
  COUNT(*) FILTER (WHERE sa.estado_atual = 'Codificando')     AS codificando,
  COUNT(*) FILTER (WHERE sa.estado_atual = 'Preciso de Ajuda') AS pedindo_ajuda,
  COUNT(*) FILTER (WHERE sa.estado_atual = 'Pausado')         AS pausados,
  COUNT(*) FILTER (WHERE sa.estado_atual = 'Não Iniciado')    AS nao_iniciados,
  ROUND(AVG(sa.progresso), 1)                    AS progresso_medio,
  ROUND(AVG(sa.nota), 1)                         AS nota_media
FROM status_atividades sa
JOIN alunos    a ON sa.aluno_id      = a.id
JOIN turmas    t ON a.turma_id       = t.id
JOIN exercicios e ON sa.exercicio_id = e.id
GROUP BY t.id, t.nome, e.id, e.titulo;

-- ============================================================
-- 6. Função e Triggers de Atualização Automática
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_turmas_updated_at
  BEFORE UPDATE ON turmas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_professores_updated_at
  BEFORE UPDATE ON professores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_alunos_updated_at
  BEFORE UPDATE ON alunos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_exercicios_updated_at
  BEFORE UPDATE ON exercicios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_status_atividades_updated_at
  BEFORE UPDATE ON status_atividades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_user_roles_updated_at
  BEFORE UPDATE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 7. Registro no Controle de Versão
-- ============================================================
INSERT INTO schema_migrations (version) 
VALUES ('001_initial_schema') 
ON CONFLICT (version) DO NOTHING;

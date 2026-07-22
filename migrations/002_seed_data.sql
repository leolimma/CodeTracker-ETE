-- ============================================================
-- CodeTracker ETE — Dados Iniciais de Administração
-- Versão: 002
-- NOTA: Senhas NÃO são inseridas aqui.
--       Usuários são criados via Neon Auth (scripts/create_neon_auth_users.py)
--       e depois vinculados pelo auth_user_id.
-- ============================================================

-- Registro de auditoria inicial
INSERT INTO audit_logs (user_type, user_name, action, description)
VALUES (
  'Sistema',
  'Sistema',
  'Inicialização',
  'Banco de dados CodeTracker ETE inicializado com sucesso. Migração de SQLite → Neon PostgreSQL concluída.'
);

-- Nota: Turmas, Alunos, Exercícios, Professores serão inseridos
-- pelo script scripts/migrate_sqlite_to_neon.py a partir dos dados
-- existentes no codetracker.db (SQLite) e codetracker.json (Node.js).
--
-- Para um ambiente novo (sem dados existentes), o script
-- scripts/seed_initial_data.py pode ser usado para criar dados de demonstração.

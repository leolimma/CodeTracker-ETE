-- ============================================================
-- CodeTracker ETE — Carga Inicial Completa (SEED)
-- Versão: 002
-- Inclui: Administrador, Turmas, Exercícios, Alunos e Status
-- ============================================================

-- 1. Registro de Auditoria Inicial
INSERT INTO audit_logs (user_type, user_name, action, description)
VALUES (
  'Sistema',
  'Sistema',
  'Inicialização',
  'Banco de dados CodeTracker ETE inicializado com sucesso no Neon PostgreSQL.'
);

-- 2. Cadastro do Usuário Administrador
-- Senha inicial: admin123 (hash criptografado com scrypt)
INSERT INTO professores (
  id, 
  usuario, 
  email, 
  nome, 
  senha_hash, 
  auth_user_id
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin',
  'admin@ete.edu.br',
  'Administrador ETE',
  'scrypt:32768:8:1$ToacZXUCw7LktplY$8e754624a38a4b0e496522c194b3d89cee01ba894c053db8300137031c3f0947eb016fa1cf066d5edda0960ee448f624e3e49a6212dfbdd4e35cd567696b6f82',
  '00000000-0000-0000-0000-000000000001'
)
ON CONFLICT (email) DO UPDATE
SET 
  nome = EXCLUDED.nome, 
  usuario = EXCLUDED.usuario, 
  senha_hash = EXCLUDED.senha_hash,
  updated_at = NOW();

-- 3. Concessão de Privilégios de Administrador em user_roles
INSERT INTO user_roles (auth_user_id, role, entity_id)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin',
  '00000000-0000-0000-0000-000000000001'
)
ON CONFLICT (auth_user_id) DO UPDATE
SET role = 'admin', entity_id = EXCLUDED.entity_id, updated_at = NOW();

INSERT INTO user_roles (auth_user_id, role, entity_id)
VALUES (
  'admin@ete.edu.br',
  'admin',
  '00000000-0000-0000-0000-000000000001'
)
ON CONFLICT (auth_user_id) DO UPDATE
SET role = 'admin', entity_id = EXCLUDED.entity_id, updated_at = NOW();

-- 4. Turma de Demonstração
INSERT INTO turmas (id, nome, ano, curso, sala)
VALUES (
  'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
  '3º Ano B - Informática',
  '2026',
  'Técnico em Desenvolvimento de Sistemas',
  'Laboratório 02'
)
ON CONFLICT (id) DO NOTHING;

-- 5. Exercícios de Python
INSERT INTO exercicios (
  id, titulo, modulo, descricao, nivel, tempo_estimado, 
  objetivo_aprendizado, enunciado, entrada_esperada, saida_esperada, 
  exemplo_entrada, exemplo_saida, ativo
)
VALUES 
  (
    'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e',
    'Olá Mundo em Python',
    'Introdução à Sintaxe',
    'Primeiro programa em Python utilizando a função print().',
    'Fácil',
    10,
    'Compreender o uso de saída de dados padrão no Python.',
    'Escreva um programa que imprima na tela exatamente a mensagem: Olá Mundo!',
    'Nenhuma',
    'Olá Mundo!',
    '',
    'Olá Mundo!',
    TRUE
  ),
  (
    'c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f',
    'Soma de Dois Números',
    'Operadores Matemáticos',
    'Receber dois inteiros via input() e exibir a soma.',
    'Fácil',
    15,
    'Trabalhar com conversão de tipos (int) e operadores aritméticos.',
    'Desenvolva um programa que leia dois números inteiros e exiba o resultado da soma entre eles.',
    '5 e 7',
    '12',
    '5\n7',
    '12',
    TRUE
  ),
  (
    'd4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f9a',
    'Verificador de Par ou Ímpar',
    'Estruturas Condicionais',
    'Utilizar a estrutura if/else e o operador de módulo (%).',
    'Médio',
    20,
    'Fixar o conceito de desvios condicionais com if e else.',
    'Crie um programa que leia um número inteiro e informe se ele é "PAR" ou "ÍMPAR".',
    '8',
    'PAR',
    '8',
    'PAR',
    TRUE
  ),
  (
    'e5f6a7b8-c9d0-1e2f-3a4b-5c6d7e8f9a0b',
    'Contador com Loop While',
    'Laços de Repetição',
    'Executar iterações controladas com while.',
    'Médio',
    25,
    'Dominar o controle de repetição com contador e condição de parada.',
    'Escreva um programa que imprima os números de 1 até 5, um por linha, utilizando a estrutura while.',
    'Nenhuma',
    '1\n2\n3\n4\n5',
    '',
    '1\n2\n3\n4\n5',
    TRUE
  )
ON CONFLICT (id) DO NOTHING;

-- Ativar exercício "Olá Mundo" na turma
INSERT INTO turmas_exercicio_ativo (turma_id, exercicio_id, updated_at)
VALUES (
  'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
  'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e',
  NOW()
)
ON CONFLICT (turma_id) DO UPDATE
SET exercicio_id = EXCLUDED.exercicio_id,
    updated_at   = NOW();

-- 6. Alunos de Demonstração (senha padrão é a própria matrícula)
INSERT INTO alunos (id, nome, matricula, email, foto, turma_id, primeiro_acesso)
VALUES 
  (
    'f6a7b8c9-d0e1-2f3a-4b5c-6d7e8f9a0b1c',
    'Lucas Silva',
    'ETE2026001',
    'ete2026001@ete.edu.br',
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    FALSE
  ),
  (
    'a7b8c9d0-e1f2-3a4b-5c6d-7e8f9a0b1c2d',
    'Mariana Santos',
    'ETE2026002',
    'ete2026002@ete.edu.br',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    FALSE
  ),
  (
    'b8c9d0e1-f2a3-4b5c-6d7e-8f9a0b1c2d3e',
    'Carlos Eduardo',
    'ETE2026003',
    'ete2026003@ete.edu.br',
    'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    FALSE
  )
ON CONFLICT (matricula) DO NOTHING;

-- 7. Status de Atividades dos Alunos
INSERT INTO status_atividades (
  id, aluno_id, exercicio_id, estado_atual, progresso, 
  codigo_salvo, tempo_inicio, tempo_fim, nota, observacao
)
VALUES 
  (
    'c9d0e1f2-a3b4-5c6d-7e8f-9a0b1c2d3e4f',
    'f6a7b8c9-d0e1-2f3a-4b5c-6d7e8f9a0b1c',
    'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e',
    'Concluído',
    100,
    'print("Olá Mundo!")',
    NOW() - INTERVAL '30 minutes',
    NOW() - INTERVAL '5 minutes',
    10.0,
    'Código perfeito e sem erros sintáticos.'
  ),
  (
    'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a',
    'a7b8c9d0-e1f2-3a4b-5c6d-7e8f9a0b1c2d',
    'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e',
    'Codificando',
    65,
    '# Em desenvolvimento\nmsg = "Olá Mundo"\nprint(msg)',
    NOW() - INTERVAL '20 minutes',
    NULL,
    NULL,
    'Aluno desenvolvendo a lógica.'
  ),
  (
    'e1f2a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b',
    'b8c9d0e1-f2a3-4b5c-6d7e-8f9a0b1c2d3e',
    'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e',
    'Preciso de Ajuda',
    30,
    'prnt("Ola Mundo")',
    NOW() - INTERVAL '15 minutes',
    NULL,
    NULL,
    'Dúvida de sintaxe na função print.'
  )
ON CONFLICT (aluno_id, exercicio_id) DO NOTHING;

-- 8. Histórico de Status
INSERT INTO historico_status (
  aluno_id, exercicio_id, estado_anterior, estado_novo, progresso, tempo_decorrido, observacao
)
VALUES 
  ('f6a7b8c9-d0e1-2f3a-4b5c-6d7e8f9a0b1c', 'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e', 'Não Iniciado', 'Codificando', 20, 120, 'Iniciou o exercício'),
  ('f6a7b8c9-d0e1-2f3a-4b5c-6d7e8f9a0b1c', 'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e', 'Codificando', 'Concluído', 100, 1500, 'Exercício finalizado'),
  ('a7b8c9d0-e1f2-3a4b-5c6d-7e8f9a0b1c2d', 'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e', 'Não Iniciado', 'Codificando', 65, 1200, 'Codificando'),
  ('b8c9d0e1-f2a3-4b5c-6d7e-8f9a0b1c2d3e', 'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e', 'Codificando', 'Preciso de Ajuda', 30, 900, 'Solicitou suporte do professor');

-- 9. Registro no Controle de Versão
INSERT INTO schema_migrations (version) 
VALUES ('002_seed_data') 
ON CONFLICT (version) DO NOTHING;

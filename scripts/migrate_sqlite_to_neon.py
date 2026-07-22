#!/usr/bin/env python3
"""
migrate_sqlite_to_neon.py
--------------------------
Migra dados do SQLite (codetracker.db) para o Neon PostgreSQL.
Senhas NÃO são migradas — usuários serão recriados via Neon Auth.

Uso:
    python scripts/migrate_sqlite_to_neon.py [--dry-run]

Variáveis de ambiente necessárias:
    DATABASE_URL — connection string do Neon PostgreSQL

O SQLite (codetracker.db) deve estar na raiz do projeto.
"""

import os
import sys
import uuid
import json
import argparse
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# Paths
ROOT_DIR = Path(__file__).parent.parent
SQLITE_PATH = ROOT_DIR / "codetracker.db"
JSON_PATH = ROOT_DIR / "codetracker.json"
MAPPING_PATH = ROOT_DIR / "scripts" / "id_mapping.json"

DATABASE_URL = os.environ.get("DATABASE_URL")


def get_pg_conn():
    import psycopg2
    return psycopg2.connect(DATABASE_URL)


def get_sqlite_conn():
    if not SQLITE_PATH.exists():
        print(f"⚠️  SQLite não encontrado em {SQLITE_PATH}")
        return None
    conn = sqlite3.connect(str(SQLITE_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def load_nodejs_json():
    if not JSON_PATH.exists():
        print(f"⚠️  JSON do Node.js não encontrado em {JSON_PATH}")
        return None
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def normalize_nivel(nivel: str) -> str:
    """Normaliza nível entre os dois sistemas."""
    mapping = {
        "EASY": "Fácil",
        "Fácil": "Fácil",
        "MEDIUM": "Médio",
        "Médio": "Médio",
        "HARD": "Difícil",
        "Difícil": "Difícil",
    }
    return mapping.get(nivel, "Médio")


def normalize_estado(estado: str) -> str:
    """Normaliza estado entre os dois sistemas."""
    mapping = {
        "IDLE": "Não Iniciado",
        "Não Iniciado": "Não Iniciado",
        "CODING": "Codificando",
        "Codificando": "Codificando",
        "HELP": "Preciso de Ajuda",
        "Preciso de Ajuda": "Preciso de Ajuda",
        "PAUSED": "Pausado",
        "Pausado": "Pausado",
        "COMPLETED": "Concluído",
        "Concluído": "Concluído",
    }
    return mapping.get(estado, "Não Iniciado")


def run_migration(dry_run: bool = False):
    if not DATABASE_URL:
        print("❌ DATABASE_URL não definida.")
        sys.exit(1)

    print("=" * 60)
    print("MIGRAÇÃO: SQLite + JSON → Neon PostgreSQL")
    if dry_run:
        print("⚠️  MODO DRY-RUN: nenhuma escrita será realizada.")
    print("=" * 60)

    # Mapeamento de IDs antigos → novos UUIDs
    id_map = {
        "turmas": {},      # int_id → uuid
        "alunos": {},      # int_id → uuid
        "exercicios": {},  # int_id → uuid
        "professores": {}, # int_id → uuid
    }

    sqlite_conn = get_sqlite_conn()
    nodejs_data = load_nodejs_json()
    pg_conn = get_pg_conn() if not dry_run else None

    if not dry_run:
        pg_conn.autocommit = False
        pg_cur = pg_conn.cursor()

    def pg_exec(sql, params=None):
        if dry_run:
            # Apenas exibe o que seria executado
            return None
        pg_cur.execute(sql, params)

    # ----------------------------------------------------------
    # 1. TURMAS (fonte principal: SQLite Python)
    # ----------------------------------------------------------
    print("\n📋 Migrando TURMAS...")
    turmas_migradas = 0

    if sqlite_conn:
        rows = sqlite_conn.execute("SELECT * FROM turmas ORDER BY id").fetchall()
        for row in rows:
            new_id = str(uuid.uuid4())
            id_map["turmas"][row["id"]] = new_id
            nome = row["nome"]
            ano = row["ano"]
            curso = row["curso"]
            sala = None

            # Tentar enriquecer com dados do Node.js (sala)
            if nodejs_data:
                js_class = next(
                    (c for c in nodejs_data.get("classes", [])
                     if c.get("name", "").lower() in nome.lower() or
                        nome.lower() in c.get("name", "").lower()),
                    None
                )
                if js_class:
                    sala = js_class.get("room")

            if not dry_run:
                pg_exec("""
                    INSERT INTO turmas (id, nome, ano, curso, sala)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT DO NOTHING
                """, (new_id, nome, ano, curso, sala))
            print(f"  ✅ Turma '{nome}' → {new_id}")
            turmas_migradas += 1

    # Turmas exclusivas do Node.js (não presentes no SQLite)
    if nodejs_data:
        for js_class in nodejs_data.get("classes", []):
            js_name = js_class.get("name", "")
            already_in = any(
                js_name.lower() in v.lower() or v.lower() in js_name.lower()
                for v in [r["nome"] for r in (sqlite_conn.execute("SELECT nome FROM turmas").fetchall() if sqlite_conn else [])]
            )
            if not already_in:
                new_id = str(uuid.uuid4())
                id_map["turmas"][f"js_{js_class['id']}"] = new_id
                if not dry_run:
                    pg_exec("""
                        INSERT INTO turmas (id, nome, ano, curso, sala)
                        VALUES (%s, %s, %s, %s, %s)
                        ON CONFLICT DO NOTHING
                    """, (new_id, js_name, "1º Ano", "Informática", js_class.get("room")))
                print(f"  ✅ Turma (Node.js) '{js_name}' → {new_id}")
                turmas_migradas += 1

    print(f"  Total: {turmas_migradas} turma(s)")

    # ----------------------------------------------------------
    # 2. PROFESSORES (fonte: SQLite Python)
    # ----------------------------------------------------------
    print("\n👨‍🏫 Migrando PROFESSORES...")
    professores_migrados = 0

    if sqlite_conn:
        rows = sqlite_conn.execute("SELECT * FROM professores ORDER BY id").fetchall()
        for row in rows:
            new_id = str(uuid.uuid4())
            id_map["professores"][row["id"]] = new_id
            usuario = row["usuario"]
            email = f"{usuario.lower().replace(' ', '')}@ete.edu.br"
            nome = usuario.title()

            # Enriquecer com Node.js
            if nodejs_data:
                js_teacher = next(
                    (t for t in nodejs_data.get("teachers", [])
                     if t.get("username", "").lower() == usuario.lower()),
                    None
                )
                if js_teacher:
                    nome = js_teacher.get("name", nome)
                    email = js_teacher.get("email") or email

            if not dry_run:
                pg_exec("""
                    INSERT INTO professores (id, usuario, email, nome)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (usuario) DO NOTHING
                """, (new_id, usuario, email, nome))
            print(f"  ✅ Professor '{usuario}' ({email}) → {new_id}")
            professores_migrados += 1

    print(f"  Total: {professores_migrados} professor(es)")

    # ----------------------------------------------------------
    # 3. ALUNOS (fonte principal: SQLite Python)
    #    SENHAS NÃO MIGRADAS
    # ----------------------------------------------------------
    print("\n👥 Migrando ALUNOS (SEM senhas)...")
    alunos_migrados = 0

    if sqlite_conn:
        rows = sqlite_conn.execute("SELECT * FROM alunos ORDER BY id").fetchall()
        for row in rows:
            new_id = str(uuid.uuid4())
            id_map["alunos"][row["id"]] = new_id
            matricula = row["matricula"]
            nome = row["nome"]
            email = f"{matricula.lower()}@ete.edu.br"
            foto = row["foto"]
            turma_uuid = id_map["turmas"].get(row["turma_id"])

            if not turma_uuid:
                print(f"  ⚠️  Aluno '{nome}' sem turma mapeada — pulando")
                continue

            if not dry_run:
                pg_exec("""
                    INSERT INTO alunos (id, nome, matricula, email, foto, turma_id, primeiro_acesso)
                    VALUES (%s, %s, %s, %s, %s, %s, TRUE)
                    ON CONFLICT (matricula) DO NOTHING
                """, (new_id, nome, matricula, email, foto, turma_uuid))
            print(f"  ✅ Aluno '{nome}' ({matricula}) → {new_id}")
            alunos_migrados += 1

    print(f"  Total: {alunos_migrados} aluno(s)")

    # ----------------------------------------------------------
    # 4. EXERCÍCIOS (fonte principal: SQLite Python, enriquecido pelo Node.js)
    # ----------------------------------------------------------
    print("\n📝 Migrando EXERCÍCIOS...")
    exercicios_migrados = 0

    if sqlite_conn:
        rows = sqlite_conn.execute("SELECT * FROM exercicios ORDER BY id").fetchall()
        for row in rows:
            new_id = str(uuid.uuid4())
            id_map["exercicios"][row["id"]] = new_id

            nivel = normalize_nivel(row["nivel"])

            if not dry_run:
                pg_exec("""
                    INSERT INTO exercicios (
                        id, titulo, modulo, descricao, nivel, tempo_estimado,
                        objetivo_aprendizado, enunciado, entrada_esperada,
                        saida_esperada, exemplo_entrada, exemplo_saida, observacoes
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT DO NOTHING
                """, (
                    new_id,
                    row["titulo"],
                    row["modulo"],
                    row["descricao"] or row["enunciado"] or "",
                    nivel,
                    row["tempo_estimado"],
                    row["objetivo_aprendizado"] or "",
                    row["enunciado"] or row["descricao"] or "",
                    row["entrada_esperada"] or "",
                    row["saida_esperada"] or "",
                    row["exemplo_entrada"] or "",
                    row["exemplo_saida"] or "",
                    row["observacoes"],
                ))
            print(f"  ✅ Exercício '{row['titulo']}' → {new_id}")
            exercicios_migrados += 1

    print(f"  Total: {exercicios_migrados} exercício(s)")

    # ----------------------------------------------------------
    # 5. STATUS ATIVIDADES
    # ----------------------------------------------------------
    print("\n📊 Migrando STATUS ATIVIDADES...")
    status_migrados = 0

    if sqlite_conn:
        rows = sqlite_conn.execute("SELECT * FROM status_atividades ORDER BY id").fetchall()
        for row in rows:
            aluno_uuid = id_map["alunos"].get(row["aluno_id"])
            exercicio_uuid = id_map["exercicios"].get(row["exercicio_id"])

            if not aluno_uuid or not exercicio_uuid:
                continue

            estado = normalize_estado(row["estado_atual"])
            new_id = str(uuid.uuid4())

            if not dry_run:
                pg_exec("""
                    INSERT INTO status_atividades (
                        id, aluno_id, exercicio_id, estado_atual, progresso,
                        tempo_inicio, tempo_fim, observacao
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (aluno_id, exercicio_id) DO NOTHING
                """, (
                    new_id,
                    aluno_uuid,
                    exercicio_uuid,
                    estado,
                    row["progresso"],
                    row["tempo_inicio"],
                    row["tempo_fim"],
                    row["observacao"],
                ))
            status_migrados += 1

    print(f"  Total: {status_migrados} status migrado(s)")

    # ----------------------------------------------------------
    # 6. HISTÓRICO DE STATUS
    # ----------------------------------------------------------
    print("\n📈 Migrando HISTÓRICO DE STATUS...")
    historico_migrado = 0

    if sqlite_conn:
        rows = sqlite_conn.execute("SELECT * FROM historico_status ORDER BY id").fetchall()
        for row in rows:
            aluno_uuid = id_map["alunos"].get(row["aluno_id"])
            exercicio_uuid = id_map["exercicios"].get(row["exercicio_id"])

            if not aluno_uuid or not exercicio_uuid:
                continue

            new_id = str(uuid.uuid4())
            if not dry_run:
                pg_exec("""
                    INSERT INTO historico_status (
                        id, aluno_id, exercicio_id, estado_anterior, estado_novo,
                        progresso, tempo_decorrido, observacao, timestamp
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    new_id,
                    aluno_uuid,
                    exercicio_uuid,
                    normalize_estado(row["estado_anterior"]) if row["estado_anterior"] else None,
                    normalize_estado(row["estado_novo"]),
                    row["progresso"],
                    row["tempo_decorrido"],
                    row["observacao"],
                    row["timestamp"],
                ))
            historico_migrado += 1

    print(f"  Total: {historico_migrado} entradas de histórico migradas")

    # ----------------------------------------------------------
    # Commit e salvar mapeamento de IDs
    # ----------------------------------------------------------
    if not dry_run:
        pg_conn.commit()
        pg_cur.close()
        pg_conn.close()

    if sqlite_conn:
        sqlite_conn.close()

    # Salvar mapeamento para uso nos scripts seguintes
    MAPPING_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(MAPPING_PATH, "w", encoding="utf-8") as f:
        json.dump(id_map, f, indent=2, ensure_ascii=False)
    print(f"\n💾 Mapeamento de IDs salvo em: {MAPPING_PATH}")

    print("\n" + "=" * 60)
    print("✅ MIGRAÇÃO CONCLUÍDA!" if not dry_run else "✅ DRY-RUN CONCLUÍDO — nenhuma alteração realizada.")
    print(f"  Turmas:           {turmas_migradas}")
    print(f"  Professores:      {professores_migrados}")
    print(f"  Alunos:           {alunos_migrados}")
    print(f"  Exercícios:       {exercicios_migrados}")
    print(f"  Status:           {status_migrados}")
    print(f"  Histórico:        {historico_migrado}")
    print("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrar dados SQLite → Neon PostgreSQL")
    parser.add_argument("--dry-run", action="store_true", help="Simula a migração sem escrever no banco")
    args = parser.parse_args()
    run_migration(dry_run=args.dry_run)

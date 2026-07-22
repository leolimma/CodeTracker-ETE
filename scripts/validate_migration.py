#!/usr/bin/env python3
"""
validate_migration.py
----------------------
Valida a integridade dos dados migrados para o Neon PostgreSQL.
Compara contagens entre SQLite e PostgreSQL e verifica integridade referencial.

Uso:
    python scripts/validate_migration.py
"""

import os
import sys
import sqlite3
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

ROOT_DIR = Path(__file__).parent.parent
SQLITE_PATH = ROOT_DIR / "codetracker.db"
DATABASE_URL = os.environ.get("DATABASE_URL")

OK = "✅"
FAIL = "❌"
WARN = "⚠️ "


def run_validation():
    if not DATABASE_URL:
        print(f"{FAIL} DATABASE_URL não definida.")
        sys.exit(1)

    import psycopg2
    pg_conn = psycopg2.connect(DATABASE_URL)
    pg_cur = pg_conn.cursor()

    errors = 0
    warnings = 0

    print("=" * 60)
    print("VALIDAÇÃO DA MIGRAÇÃO — CodeTracker ETE")
    print("=" * 60)

    # --- Verificar integridade referencial no PostgreSQL ---
    print("\n🔍 Verificando integridade referencial...")

    checks = [
        ("Alunos sem turma", "SELECT COUNT(*) FROM alunos a LEFT JOIN turmas t ON a.turma_id = t.id WHERE t.id IS NULL"),
        ("Status sem aluno", "SELECT COUNT(*) FROM status_atividades sa LEFT JOIN alunos a ON sa.aluno_id = a.id WHERE a.id IS NULL"),
        ("Status sem exercício", "SELECT COUNT(*) FROM status_atividades sa LEFT JOIN exercicios e ON sa.exercicio_id = e.id WHERE e.id IS NULL"),
        ("Histórico sem aluno", "SELECT COUNT(*) FROM historico_status h LEFT JOIN alunos a ON h.aluno_id = a.id WHERE a.id IS NULL"),
        ("Histórico sem exercício", "SELECT COUNT(*) FROM historico_status h LEFT JOIN exercicios e ON h.exercicio_id = e.id WHERE e.id IS NULL"),
    ]

    for label, sql in checks:
        pg_cur.execute(sql)
        count = pg_cur.fetchone()[0]
        if count > 0:
            print(f"  {FAIL} {label}: {count} registro(s) órfão(s)")
            errors += 1
        else:
            print(f"  {OK} {label}: OK")

    # --- Comparar contagens com SQLite ---
    print("\n📊 Comparando contagens SQLite × PostgreSQL...")

    if SQLITE_PATH.exists():
        sqlite_conn = sqlite3.connect(str(SQLITE_PATH))

        tabelas = [
            ("turmas", "turmas", "Turmas"),
            ("alunos", "alunos", "Alunos"),
            ("exercicios", "exercicios", "Exercícios"),
            ("status_atividades", "status_atividades", "Status Atividades"),
            ("historico_status", "historico_status", "Histórico Status"),
            ("professores", "professores", "Professores"),
        ]

        for sqlite_table, pg_table, label in tabelas:
            try:
                sqlite_count = sqlite_conn.execute(f"SELECT COUNT(*) FROM {sqlite_table}").fetchone()[0]
                pg_cur.execute(f"SELECT COUNT(*) FROM {pg_table}")
                pg_count = pg_cur.fetchone()[0]

                if sqlite_count == pg_count:
                    print(f"  {OK} {label}: SQLite={sqlite_count} | Neon={pg_count}")
                elif pg_count >= sqlite_count:
                    print(f"  {OK} {label}: SQLite={sqlite_count} | Neon={pg_count} (Neon tem mais — esperado, Node.js também foi migrado)")
                else:
                    print(f"  {WARN} {label}: SQLite={sqlite_count} | Neon={pg_count} (diferença: {sqlite_count - pg_count})")
                    warnings += 1
            except Exception as e:
                print(f"  {WARN} {label}: erro ao comparar — {e}")
                warnings += 1

        sqlite_conn.close()
    else:
        print(f"  {WARN} SQLite não encontrado — comparação ignorada.")
        warnings += 1

    # --- Verificar constraints ---
    print("\n🔒 Verificando constraints...")

    pg_cur.execute("SELECT COUNT(*) FROM status_atividades WHERE progresso < 0 OR progresso > 100")
    inv_progress = pg_cur.fetchone()[0]
    if inv_progress > 0:
        print(f"  {FAIL} Progresso inválido: {inv_progress} registro(s)")
        errors += 1
    else:
        print(f"  {OK} Progresso: todos entre 0 e 100")

    pg_cur.execute("""
        SELECT COUNT(*) FROM status_atividades
        WHERE estado_atual NOT IN ('Não Iniciado','Codificando','Preciso de Ajuda','Pausado','Concluído')
    """)
    inv_state = pg_cur.fetchone()[0]
    if inv_state > 0:
        print(f"  {FAIL} Estado inválido: {inv_state} registro(s)")
        errors += 1
    else:
        print(f"  {OK} Estados: todos válidos")

    # --- Resultado final ---
    print("\n" + "=" * 60)
    if errors == 0 and warnings == 0:
        print(f"{OK} VALIDAÇÃO PASSOU — banco de dados íntegro!")
    elif errors == 0:
        print(f"{WARN} VALIDAÇÃO COM AVISOS — {warnings} aviso(s), sem erros críticos.")
    else:
        print(f"{FAIL} VALIDAÇÃO FALHOU — {errors} erro(s), {warnings} aviso(s).")
        sys.exit(1)
    print("=" * 60)

    pg_cur.close()
    pg_conn.close()


if __name__ == "__main__":
    run_validation()

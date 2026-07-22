#!/usr/bin/env python3
"""
run_migrations.py
-----------------
Runner de migrations para o banco Neon PostgreSQL.
Executa todos os arquivos .sql da pasta migrations/ em ordem alfabética.

Uso:
    python scripts/run_migrations.py

Variáveis de ambiente necessárias:
    DATABASE_URL — connection string do Neon PostgreSQL
"""

import os
import sys
import glob
import psycopg2
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")
MIGRATIONS_DIR = Path(__file__).parent.parent / "migrations"


def run_migrations():
    if not DATABASE_URL:
        print("❌ DATABASE_URL não definida. Configure no .env ou como variável de ambiente.")
        sys.exit(1)

    print(f"🔗 Conectando ao banco de dados Neon...")
    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = False
        cur = conn.cursor()
        print("✅ Conexão estabelecida.")
    except Exception as e:
        print(f"❌ Falha na conexão: {e}")
        sys.exit(1)

    # Criar tabela de controle de migrations se não existir
    cur.execute("""
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version     TEXT PRIMARY KEY,
            applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    conn.commit()

    # Listar migrations já aplicadas
    cur.execute("SELECT version FROM schema_migrations ORDER BY version")
    applied = {row[0] for row in cur.fetchall()}

    # Listar todos os arquivos .sql em ordem
    sql_files = sorted(glob.glob(str(MIGRATIONS_DIR / "*.sql")))

    if not sql_files:
        print("⚠️  Nenhum arquivo de migration encontrado em migrations/")
        return

    new_migrations = 0
    for sql_file in sql_files:
        version = Path(sql_file).stem  # ex: "001_initial_schema"
        if version in applied:
            print(f"⏭️  {version} — já aplicado, pulando.")
            continue

        print(f"🚀 Aplicando migration: {version}...")
        try:
            with open(sql_file, "r", encoding="utf-8") as f:
                sql = f.read()
            cur.execute(sql)
            cur.execute(
                "INSERT INTO schema_migrations (version) VALUES (%s)",
                (version,)
            )
            conn.commit()
            print(f"✅ {version} — aplicado com sucesso.")
            new_migrations += 1
        except Exception as e:
            conn.rollback()
            print(f"❌ Erro ao aplicar {version}: {e}")
            cur.close()
            conn.close()
            sys.exit(1)

    cur.close()
    conn.close()

    if new_migrations == 0:
        print("\n✅ Banco de dados já está atualizado. Nenhuma migration pendente.")
    else:
        print(f"\n✅ {new_migrations} migration(s) aplicada(s) com sucesso!")


if __name__ == "__main__":
    run_migrations()

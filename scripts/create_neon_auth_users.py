#!/usr/bin/env python3
"""
create_neon_auth_users.py
--------------------------
Cria contas de todos os usuários (alunos e professores) no Neon Auth
e vincula o auth_user_id nas tabelas do banco de dados.

SENHAS PADRÃO:
  - Alunos: matrícula (ex: ETE2026101)
  - Professores: definida interativamente

Uso:
    python scripts/create_neon_auth_users.py [--dry-run]

Variáveis de ambiente:
    DATABASE_URL            — Neon PostgreSQL connection string
    NEON_AUTH_PROJECT_ID    — ID do projeto no Neon Auth (Stack Auth)
    NEON_AUTH_SECRET        — Secret key para a Management API
"""

import os
import sys
import json
import argparse
import requests
import getpass
import psycopg2
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")
NEON_AUTH_PROJECT_ID = os.environ.get("NEON_AUTH_PROJECT_ID")
NEON_AUTH_SECRET = os.environ.get("NEON_AUTH_SECRET")

# Stack Auth Management API base URL
STACK_AUTH_API = "https://api.stack-auth.com/api/v1"


def stack_auth_headers():
    return {
        "x-stack-access-type": "server",
        "x-stack-project-id": NEON_AUTH_PROJECT_ID,
        "x-stack-secret-server-key": NEON_AUTH_SECRET,
        "Content-Type": "application/json",
    }


def create_user_neon_auth(email: str, password: str, display_name: str) -> str | None:
    """Cria um usuário no Neon Auth (Stack Auth) e retorna o user_id."""
    url = f"{STACK_AUTH_API}/users"
    payload = {
        "primary_email": email,
        "password": password,
        "display_name": display_name,
        "primary_email_verified": True,
    }
    resp = requests.post(url, json=payload, headers=stack_auth_headers())

    if resp.status_code in (200, 201):
        data = resp.json()
        return data.get("id") or data.get("user_id")
    elif resp.status_code == 409:
        # Usuário já existe — buscar pelo email
        print(f"    ℹ️  Usuário {email} já existe no Neon Auth — buscando ID...")
        return get_user_id_by_email(email)
    else:
        print(f"    ❌ Erro ao criar {email}: {resp.status_code} — {resp.text[:200]}")
        return None


def get_user_id_by_email(email: str) -> str | None:
    """Busca o user_id de um usuário pelo email no Neon Auth."""
    url = f"{STACK_AUTH_API}/users?primary_email={requests.utils.quote(email)}"
    resp = requests.get(url, headers=stack_auth_headers())
    if resp.ok:
        users = resp.json().get("items", [])
        if users:
            return users[0].get("id")
    return None


def run(dry_run: bool = False):
    if not DATABASE_URL:
        print("❌ DATABASE_URL não definida.")
        sys.exit(1)
    if not NEON_AUTH_PROJECT_ID or not NEON_AUTH_SECRET:
        print("❌ NEON_AUTH_PROJECT_ID ou NEON_AUTH_SECRET não definidos.")
        print("   Configure essas variáveis no .env antes de rodar este script.")
        sys.exit(1)

    print("=" * 60)
    print("CRIAÇÃO DE USUÁRIOS NO NEON AUTH")
    if dry_run:
        print("⚠️  MODO DRY-RUN: nenhuma alteração será realizada.")
    print("=" * 60)

    pg_conn = psycopg2.connect(DATABASE_URL)
    pg_conn.autocommit = False
    pg_cur = pg_conn.cursor()

    criados = 0
    erros = 0

    # ----------------------------------------------------------
    # 1. CRIAR USUÁRIO ADMIN
    # ----------------------------------------------------------
    print("\n👑 Criando conta ADMIN...")
    admin_email = input("  Email do administrador [admin@ete.edu.br]: ").strip() or "admin@ete.edu.br"
    admin_password = getpass.getpass("  Senha do administrador: ")
    admin_name = input("  Nome do administrador [Administrador]: ").strip() or "Administrador"

    if not dry_run:
        auth_id = create_user_neon_auth(admin_email, admin_password, admin_name)
        if auth_id:
            pg_cur.execute("""
                INSERT INTO user_roles (auth_user_id, role)
                VALUES (%s, 'admin')
                ON CONFLICT (auth_user_id) DO UPDATE SET role = 'admin'
            """, (auth_id,))
            print(f"  ✅ Admin '{admin_name}' criado — auth_id: {auth_id}")
            criados += 1
        else:
            print(f"  ❌ Falha ao criar admin.")
            erros += 1
    else:
        print(f"  [DRY-RUN] Criaria admin: {admin_email}")

    # ----------------------------------------------------------
    # 2. CRIAR PROFESSORES
    # ----------------------------------------------------------
    print("\n👨‍🏫 Criando contas de PROFESSORES...")
    pg_cur.execute("SELECT id, usuario, email, nome FROM professores ORDER BY usuario")
    professores = pg_cur.fetchall()

    if not professores:
        print("  ⚠️  Nenhum professor encontrado no banco.")
    else:
        print(f"  Encontrados {len(professores)} professor(es).")
        print("  Senha padrão para professores: 'ETE@2026!' (troque no primeiro acesso)")
        prof_password = input(f"  Senha padrão para todos os professores [ETE@2026!]: ").strip() or "ETE@2026!"

        for prof_id, usuario, email, nome in professores:
            display_name = nome or usuario.title()
            if not dry_run:
                auth_id = create_user_neon_auth(email, prof_password, display_name)
                if auth_id:
                    pg_cur.execute(
                        "UPDATE professores SET auth_user_id = %s WHERE id = %s",
                        (auth_id, prof_id)
                    )
                    pg_cur.execute("""
                        INSERT INTO user_roles (auth_user_id, role, entity_id)
                        VALUES (%s, 'professor', %s)
                        ON CONFLICT (auth_user_id) DO UPDATE SET role = 'professor', entity_id = %s
                    """, (auth_id, prof_id, prof_id))
                    print(f"  ✅ Prof. '{display_name}' ({email}) → {auth_id}")
                    criados += 1
                else:
                    print(f"  ❌ Falha: {email}")
                    erros += 1
            else:
                print(f"  [DRY-RUN] Criaria professor: {email}")

    # ----------------------------------------------------------
    # 3. CRIAR ALUNOS (senha = matrícula)
    # ----------------------------------------------------------
    print("\n👥 Criando contas de ALUNOS (senha padrão = matrícula)...")
    pg_cur.execute("SELECT id, nome, matricula, email FROM alunos ORDER BY nome")
    alunos = pg_cur.fetchall()

    if not alunos:
        print("  ⚠️  Nenhum aluno encontrado no banco.")
    else:
        print(f"  Encontrados {len(alunos)} aluno(s).")
        print("  Senha padrão: matrícula do aluno (ex: ETE2026101)")
        confirma = input(f"  Confirmar criação de {len(alunos)} conta(s)? [s/N]: ").strip().lower()
        if confirma != "s":
            print("  ⏭️  Criação de alunos cancelada pelo usuário.")
        else:
            for aluno_id, nome, matricula, email in alunos:
                senha_padrao = matricula  # matrícula como senha inicial
                if not dry_run:
                    auth_id = create_user_neon_auth(email, senha_padrao, nome)
                    if auth_id:
                        pg_cur.execute(
                            "UPDATE alunos SET auth_user_id = %s WHERE id = %s",
                            (auth_id, aluno_id)
                        )
                        pg_cur.execute("""
                            INSERT INTO user_roles (auth_user_id, role, entity_id)
                            VALUES (%s, 'aluno', %s)
                            ON CONFLICT (auth_user_id) DO UPDATE SET role = 'aluno', entity_id = %s
                        """, (auth_id, aluno_id, aluno_id))
                        criados += 1
                    else:
                        erros += 1
                else:
                    print(f"  [DRY-RUN] Criaria aluno: {email} (senha: {matricula})")

            if not dry_run:
                print(f"  ✅ {criados} aluno(s) criados, {erros} erro(s)")

    # ----------------------------------------------------------
    # Commit
    # ----------------------------------------------------------
    if not dry_run:
        pg_conn.commit()
        print("\n💾 Banco de dados atualizado com auth_user_ids.")

    pg_cur.close()
    pg_conn.close()

    print("\n" + "=" * 60)
    print(f"✅ CONCLUÍDO: {criados} usuário(s) criados, {erros} erro(s).")
    print("\n⚠️  IMPORTANTE:")
    print("  • Alunos devem trocar a senha no primeiro acesso (senha = matrícula)")
    print("  • Professores devem trocar a senha no primeiro acesso")
    print("  • Admin: guarde a senha com segurança!")
    print("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Criar usuários no Neon Auth")
    parser.add_argument("--dry-run", action="store_true", help="Simula sem criar usuários")
    args = parser.parse_args()
    run(dry_run=args.dry_run)

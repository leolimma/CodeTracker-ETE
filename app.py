"""
CodeTracker ETE — Backend Flask Unificado
==========================================
Serve:
  • React SPA (arquivos estáticos do dist/)
  • API REST completa (substitui server.ts Node.js)
  • Autenticação via Neon Auth (JWT)
  • AI Tutor via Gemini API
"""
import os
import re
import datetime
import csv
import io
import uuid
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory, g
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from dotenv import load_dotenv

from database import get_db_connection
from auth import require_auth, get_current_user, create_access_token, hash_password, verify_password

load_dotenv()

# ─────────────────────────────────────────────
# Configuração do App
# ─────────────────────────────────────────────
DIST_DIR = Path(__file__).parent / "dist"
FLASK_ENV = os.environ.get("FLASK_ENV", "development")

app = Flask(__name__, static_folder=None)
app.secret_key = os.environ.get("SESSION_SECRET", os.urandom(64).hex())

# CORS — permite o frontend React acessar a API em desenvolvimento
CORS(app, resources={r"/api/*": {"origins": os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000"
).split(",")}})

# Rate Limiting
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per minute"],
    storage_uri="memory://"
)


# ─────────────────────────────────────────────
# Utilitários
# ─────────────────────────────────────────────
def add_audit_log(user_type: str, user_name: str, action: str, description: str):
    """Registra um evento no log de auditoria."""
    auth_user_id = getattr(g, "auth_user_id", None)
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO audit_logs (auth_user_id, user_type, user_name, action, description, ip_address)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (auth_user_id, user_type, user_name, action, description,
                      request.remote_addr))
    except Exception as e:
        app.logger.error(f"Falha ao registrar audit log: {e}")


def paginate(query_result: list, page: int = 1, per_page: int = 100) -> dict:
    """Paginação simples."""
    total = len(query_result)
    start = (page - 1) * per_page
    end = start + per_page
    return {
        "items": query_result[start:end],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page
    }


# ─────────────────────────────────────────────
# ROTA: Servir React SPA (produção)
# ─────────────────────────────────────────────
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_react_spa(path):
    """Serve os arquivos estáticos do build React ou o index.html para rotas SPA."""
    if path.startswith("api/"):
        return jsonify({"error": "Not found"}), 404

    if DIST_DIR.exists():
        file_path = DIST_DIR / path
        if path and file_path.exists() and file_path.is_file():
            return send_from_directory(str(DIST_DIR), path)
        return send_from_directory(str(DIST_DIR), "index.html")
    else:
        # Em desenvolvimento, o Vite serve o frontend na porta 5173
        return jsonify({
            "message": "CodeTracker ETE API está rodando.",
            "mode": FLASK_ENV,
            "hint": "Em desenvolvimento, acesse o frontend em http://localhost:5173"
        })


# ─────────────────────────────────────────────
# HEALTH CHECK
# ─────────────────────────────────────────────
@app.route("/api/health")
def health_check():
    """Health check para Render e monitoramento."""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
        db_status = "ok"
    except Exception as e:
        db_status = f"error: {e}"

    return jsonify({
        "status": "ok" if db_status == "ok" else "degraded",
        "database": db_status,
        "environment": FLASK_ENV,
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z"
    }), 200 if db_status == "ok" else 503


# ─────────────────────────────────────────────
# AUTENTICAÇÃO NATIVA (Login / Logout / Senha)
# ─────────────────────────────────────────────
@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    """Autentica usuário (professor, admin ou aluno) direto no banco de dados."""
    data = request.json or {}
    identifier = (data.get("email") or data.get("identifier") or "").strip()
    password = (data.get("password") or "").strip()

    if not identifier or not password:
        return jsonify({"success": False, "error": "E-mail/matrícula e senha são obrigatórios."}), 400

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # 1. Tentar buscar em professores / admin
            cur.execute("""
                SELECT id, usuario, email, nome, senha_hash, auth_user_id
                FROM professores
                WHERE LOWER(email) = LOWER(%s) OR LOWER(usuario) = LOWER(%s)
            """, (identifier, identifier))
            prof = cur.fetchone()

            if prof:
                # Se for o admin e ainda não tiver hash salvo no banco, inicializa com admin123
                if not prof.get("senha_hash"):
                    if prof["email"] == "admin@ete.edu.br" or prof["usuario"] == "admin":
                        if password == "admin123":
                            novo_hash = hash_password("admin123")
                            cur.execute("UPDATE professores SET senha_hash = %s WHERE id = %s", (novo_hash, prof["id"]))
                            prof["senha_hash"] = novo_hash

                if verify_password(password, prof.get("senha_hash")):
                    # Determinar papel em user_roles
                    cur.execute("""
                        SELECT role FROM user_roles
                        WHERE entity_id = %s OR auth_user_id = %s OR auth_user_id = %s
                    """, (prof["id"], prof.get("auth_user_id"), prof["email"]))
                    role_row = cur.fetchone()
                    role = role_row["role"] if role_row else ("admin" if (prof["email"] == "admin@ete.edu.br" or prof["usuario"] == "admin") else "professor")

                    token = create_access_token(
                        user_id=prof.get("auth_user_id") or str(prof["id"]),
                        role=role,
                        email=prof["email"],
                        name=prof["nome"] or prof["usuario"],
                        entity_id=str(prof["id"])
                    )
                    add_audit_log(role, prof["nome"] or prof["usuario"], "Login", "Login realizado com sucesso.")
                    return jsonify({
                        "success": True,
                        "token": token,
                        "user": {
                            "id": prof.get("auth_user_id") or str(prof["id"]),
                            "email": prof["email"],
                            "displayName": prof["nome"] or prof["usuario"],
                            "role": role,
                            "entityId": str(prof["id"])
                        }
                    })

            # 2. Tentar buscar em alunos
            cur.execute("""
                SELECT id, nome, matricula, email, turma_id, senha_hash, primeiro_acesso
                FROM alunos
                WHERE LOWER(email) = LOWER(%s) OR UPPER(matricula) = UPPER(%s)
            """, (identifier, identifier))
            aluno = cur.fetchone()

            if aluno:
                is_valid = False
                if aluno.get("senha_hash"):
                    is_valid = verify_password(password, aluno["senha_hash"])
                else:
                    # Senha padrão do aluno é a própria matrícula
                    if password.strip() == aluno["matricula"].strip():
                        is_valid = True
                        novo_hash = hash_password(password)
                        cur.execute("UPDATE alunos SET senha_hash = %s WHERE id = %s", (novo_hash, aluno["id"]))

                if is_valid:
                    token = create_access_token(
                        user_id=str(aluno["id"]),
                        role="aluno",
                        email=aluno["email"],
                        name=aluno["nome"],
                        entity_id=str(aluno["id"])
                    )
                    add_audit_log("aluno", aluno["nome"], "Login", f"Aluno {aluno['matricula']} logou no sistema.")
                    return jsonify({
                        "success": True,
                        "token": token,
                        "user": {
                            "id": str(aluno["id"]),
                            "email": aluno["email"],
                            "displayName": aluno["nome"],
                            "role": "aluno",
                            "entityId": str(aluno["id"]),
                            "turmaId": str(aluno["turma_id"]),
                            "primeiroAcesso": aluno["primeiro_acesso"]
                        }
                    })

    return jsonify({"success": False, "error": "Credenciais inválidas. Verifique seu e-mail/matrícula e senha."}), 401


@app.route("/api/auth/alterar-senha", methods=["POST"])
@require_auth()
def auth_alterar_senha():
    """Permite alterar a senha do usuário autenticado."""
    data = request.json or {}
    old_password = (data.get("old_password") or "").strip()
    new_password = (data.get("new_password") or "").strip()

    if not old_password or not new_password:
        return jsonify({"success": False, "error": "Senha atual e nova senha são obrigatórias."}), 400

    if len(new_password) < 6:
        return jsonify({"success": False, "error": "A nova senha deve ter no mínimo 6 caracteres."}), 400

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            if g.user_role in ("admin", "professor"):
                cur.execute("SELECT id, senha_hash FROM professores WHERE id = %s", (g.entity_id,))
                user = cur.fetchone()
                if not user or not verify_password(old_password, user.get("senha_hash")):
                    return jsonify({"success": False, "error": "Senha atual incorreta."}), 400
                cur.execute("UPDATE professores SET senha_hash = %s, updated_at = NOW() WHERE id = %s",
                            (hash_password(new_password), g.entity_id))
            else:
                cur.execute("SELECT id, senha_hash, matricula FROM alunos WHERE id = %s", (g.entity_id,))
                user = cur.fetchone()
                current_hash = user.get("senha_hash") if user else None
                valid = verify_password(old_password, current_hash) if current_hash else (old_password == user.get("matricula"))
                if not user or not valid:
                    return jsonify({"success": False, "error": "Senha atual incorreta."}), 400
                cur.execute("UPDATE alunos SET senha_hash = %s, primeiro_acesso = FALSE, updated_at = NOW() WHERE id = %s",
                            (hash_password(new_password), g.entity_id))

    return jsonify({"success": True, "message": "Senha atualizada com sucesso."})


@app.route("/api/auth/logout", methods=["POST"])
def auth_logout():
    return jsonify({"success": True, "message": "Sessão encerrada com sucesso."})


# ─────────────────────────────────────────────
# ME (Perfil Básico)
# ─────────────────────────────────────────────
@app.route("/api/me", methods=["GET"])
@require_auth()
def get_me():
    """Retorna o role e os identificadores do usuário atual logado."""
    return jsonify({
        "success": True,
        "auth_user_id": g.auth_user_id,
        "role": g.user_role,
        "entity_id": g.entity_id,
        "email": getattr(g, "email", None),
        "nome": getattr(g, "user_name", None)
    })


# ─────────────────────────────────────────────
# TURMAS
# ─────────────────────────────────────────────
@app.route("/api/turmas", methods=["GET"])
@require_auth()
def listar_turmas():
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT t.*, tea.exercicio_id AS exercicio_ativo_id,
                       COUNT(a.id) AS total_alunos
                FROM turmas t
                LEFT JOIN turmas_exercicio_ativo tea ON tea.turma_id = t.id
                LEFT JOIN alunos a ON a.turma_id = t.id
                GROUP BY t.id, tea.exercicio_id
                ORDER BY t.nome
            """)
            turmas = [dict(r) for r in cur.fetchall()]
    return jsonify({"success": True, "turmas": turmas})


@app.route("/api/turmas", methods=["POST"])
@require_auth("professor", "admin")
def criar_turma():
    data = request.json or {}
    nome = data.get("nome", "").strip()
    ano = data.get("ano", "").strip()
    curso = data.get("curso", "").strip()
    sala = data.get("sala", "").strip() or None

    if not nome or not ano or not curso:
        return jsonify({"success": False, "error": "nome, ano e curso são obrigatórios."}), 400

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO turmas (nome, ano, curso, sala)
                VALUES (%s, %s, %s, %s)
                RETURNING *
            """, (nome, ano, curso, sala))
            turma = dict(cur.fetchone())

    add_audit_log(g.user_role, g.entity_id or g.auth_user_id, "Cadastro",
                  f"Criou a turma '{nome}'")
    return jsonify({"success": True, "turma": turma}), 201


@app.route("/api/turmas/<turma_id>", methods=["PUT"])
@require_auth("professor", "admin")
def editar_turma(turma_id):
    data = request.json or {}
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE turmas
                SET nome  = COALESCE(%s, nome),
                    ano   = COALESCE(%s, ano),
                    curso = COALESCE(%s, curso),
                    sala  = COALESCE(%s, sala),
                    updated_at = NOW()
                WHERE id = %s
                RETURNING *
            """, (data.get("nome"), data.get("ano"), data.get("curso"),
                  data.get("sala"), turma_id))
            turma = cur.fetchone()
    if not turma:
        return jsonify({"success": False, "error": "Turma não encontrada."}), 404
    return jsonify({"success": True, "turma": dict(turma)})


@app.route("/api/turmas/<turma_id>", methods=["DELETE"])
@require_auth("admin")
def excluir_turma(turma_id):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT nome FROM turmas WHERE id = %s", (turma_id,))
            turma = cur.fetchone()
            if not turma:
                return jsonify({"success": False, "error": "Turma não encontrada."}), 404
            cur.execute("DELETE FROM turmas WHERE id = %s", (turma_id,))
    add_audit_log(g.user_role, g.entity_id or g.auth_user_id, "Exclusão",
                  f"Excluiu a turma '{turma['nome']}'")
    return jsonify({"success": True})


@app.route("/api/turmas/<turma_id>/exercicio-ativo", methods=["POST"])
@require_auth("professor", "admin")
def definir_exercicio_ativo(turma_id):
    """Define o exercício ativo de uma turma (equivalente ao 'assign' do Node.js)."""
    data = request.json or {}
    exercicio_id = data.get("exercicio_id")  # pode ser None para desativar

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO turmas_exercicio_ativo (turma_id, exercicio_id, updated_at)
                VALUES (%s, %s, NOW())
                ON CONFLICT (turma_id) DO UPDATE
                SET exercicio_id = EXCLUDED.exercicio_id,
                    updated_at   = NOW()
            """, (turma_id, exercicio_id))
    return jsonify({"success": True, "exercicio_id": exercicio_id})


# ─────────────────────────────────────────────
# EXERCÍCIOS
# ─────────────────────────────────────────────
@app.route("/api/exercicios", methods=["GET"])
@require_auth()
def listar_exercicios():
    q = request.args.get("q")
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            if q:
                cur.execute("""
                    SELECT * FROM exercicios
                    WHERE ativo = TRUE
                      AND search_vector @@ plainto_tsquery('portuguese', %s)
                    ORDER BY ts_rank(search_vector, plainto_tsquery('portuguese', %s)) DESC
                """, (q, q))
            else:
                cur.execute("SELECT * FROM exercicios WHERE ativo = TRUE ORDER BY titulo")
            exercicios = [dict(r) for r in cur.fetchall()]
    return jsonify({"success": True, "exercicios": exercicios})


@app.route("/api/exercicios", methods=["POST"])
@require_auth("professor", "admin")
def criar_exercicio():
    data = request.json or request.form.to_dict()
    campos_obrigatorios = ["titulo", "modulo", "nivel", "tempo_estimado",
                           "objetivo_aprendizado", "enunciado",
                           "entrada_esperada", "saida_esperada",
                           "exemplo_entrada", "exemplo_saida"]
    for campo in campos_obrigatorios:
        if not data.get(campo, "").strip() if isinstance(data.get(campo), str) else not data.get(campo):
            return jsonify({"success": False, "error": f"Campo obrigatório ausente: {campo}"}), 400

    nivel_map = {"EASY": "Fácil", "MEDIUM": "Médio", "HARD": "Difícil"}
    nivel = nivel_map.get(data["nivel"], data["nivel"])
    if nivel not in ("Fácil", "Médio", "Difícil"):
        return jsonify({"success": False, "error": "nivel deve ser Fácil, Médio ou Difícil"}), 400

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO exercicios (
                    titulo, modulo, descricao, nivel, tempo_estimado,
                    objetivo_aprendizado, enunciado, entrada_esperada,
                    saida_esperada, exemplo_entrada, exemplo_saida, observacoes
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                RETURNING *
            """, (
                data["titulo"], data["modulo"],
                data.get("descricao") or data["enunciado"],
                nivel, int(data["tempo_estimado"]),
                data["objetivo_aprendizado"], data["enunciado"],
                data["entrada_esperada"], data["saida_esperada"],
                data["exemplo_entrada"], data["exemplo_saida"],
                data.get("observacoes")
            ))
            exercicio = dict(cur.fetchone())

            # Criar status "Não Iniciado" para todos os alunos existentes
            cur.execute("SELECT id FROM alunos")
            alunos = cur.fetchall()
            for aluno in alunos:
                cur.execute("""
                    INSERT INTO status_atividades (aluno_id, exercicio_id, estado_atual, progresso)
                    VALUES (%s, %s, 'Não Iniciado', 0)
                    ON CONFLICT (aluno_id, exercicio_id) DO NOTHING
                """, (aluno["id"], exercicio["id"]))

    add_audit_log(g.user_role, g.entity_id or g.auth_user_id, "Cadastro",
                  f"Criou o exercício '{exercicio['titulo']}'")
    return jsonify({"success": True, "exercicio": exercicio}), 201


@app.route("/api/exercicios/<exercicio_id>", methods=["PUT"])
@require_auth("professor", "admin")
def editar_exercicio(exercicio_id):
    data = request.json or request.form.to_dict()
    nivel = data.get("nivel")
    if nivel:
        nivel_map = {"EASY": "Fácil", "MEDIUM": "Médio", "HARD": "Difícil"}
        nivel = nivel_map.get(nivel, nivel)

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE exercicios SET
                    titulo               = COALESCE(%s, titulo),
                    modulo               = COALESCE(%s, modulo),
                    descricao            = COALESCE(%s, descricao),
                    nivel                = COALESCE(%s, nivel),
                    tempo_estimado       = COALESCE(%s, tempo_estimado),
                    objetivo_aprendizado = COALESCE(%s, objetivo_aprendizado),
                    enunciado            = COALESCE(%s, enunciado),
                    entrada_esperada     = COALESCE(%s, entrada_esperada),
                    saida_esperada       = COALESCE(%s, saida_esperada),
                    exemplo_entrada      = COALESCE(%s, exemplo_entrada),
                    exemplo_saida        = COALESCE(%s, exemplo_saida),
                    observacoes          = COALESCE(%s, observacoes),
                    updated_at           = NOW()
                WHERE id = %s
                RETURNING *
            """, (
                data.get("titulo"), data.get("modulo"),
                data.get("descricao") or data.get("enunciado"),
                nivel, data.get("tempo_estimado") and int(data["tempo_estimado"]),
                data.get("objetivo_aprendizado"), data.get("enunciado"),
                data.get("entrada_esperada"), data.get("saida_esperada"),
                data.get("exemplo_entrada"), data.get("exemplo_saida"),
                data.get("observacoes"),
                exercicio_id
            ))
            ex = cur.fetchone()
    if not ex:
        return jsonify({"success": False, "error": "Exercício não encontrado."}), 404
    return jsonify({"success": True, "exercicio": dict(ex)})


@app.route("/api/exercicios/<exercicio_id>", methods=["DELETE"])
@require_auth("professor", "admin")
def deletar_exercicio(exercicio_id):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT titulo FROM exercicios WHERE id = %s", (exercicio_id,))
            ex = cur.fetchone()
            if not ex:
                return jsonify({"success": False, "error": "Exercício não encontrado."}), 404
            cur.execute("DELETE FROM exercicios WHERE id = %s", (exercicio_id,))
    add_audit_log(g.user_role, g.entity_id or g.auth_user_id, "Exclusão",
                  f"Excluiu o exercício '{ex['titulo']}'")
    return jsonify({"success": True})


# ─────────────────────────────────────────────
# ALUNOS
# ─────────────────────────────────────────────
@app.route("/api/alunos", methods=["GET"])
@require_auth()
def listar_alunos():
    turma_id = request.args.get("turma_id")
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            if turma_id:
                cur.execute("""
                    SELECT a.*, t.nome AS turma_nome
                    FROM alunos a
                    JOIN turmas t ON a.turma_id = t.id
                    WHERE a.turma_id = %s
                    ORDER BY a.nome
                """, (turma_id,))
            else:
                cur.execute("""
                    SELECT a.*, t.nome AS turma_nome
                    FROM alunos a
                    JOIN turmas t ON a.turma_id = t.id
                    ORDER BY t.nome, a.nome
                """)
            alunos = [dict(r) for r in cur.fetchall()]
    return jsonify({"success": True, "alunos": alunos})


@app.route("/api/alunos", methods=["POST"])
@require_auth("professor", "admin")
def criar_aluno():
    data = request.json or {}
    nome = data.get("nome", "").strip()
    matricula = data.get("matricula", "").strip()
    turma_id = data.get("turma_id")

    if not nome or not turma_id:
        return jsonify({"success": False, "error": "nome e turma_id são obrigatórios."}), 400

    if not matricula:
        matricula = f"ETE{datetime.datetime.now().strftime('%Y')}{str(uuid.uuid4().int)[:6]}"

    email = data.get("email") or f"{matricula.lower()}@ete.edu.br"

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM turmas WHERE id = %s", (turma_id,))
            if not cur.fetchone():
                return jsonify({"success": False, "error": "Turma não encontrada."}), 404

            cur.execute("""
                INSERT INTO alunos (nome, matricula, email, turma_id, foto, primeiro_acesso)
                VALUES (%s, %s, %s, %s, %s, TRUE)
                RETURNING *
            """, (nome, matricula, email, turma_id, data.get("foto")))
            aluno = dict(cur.fetchone())

            # Criar status para exercícios existentes
            cur.execute("SELECT id FROM exercicios WHERE ativo = TRUE")
            exercicios = cur.fetchall()
            for ex in exercicios:
                cur.execute("""
                    INSERT INTO status_atividades (aluno_id, exercicio_id, estado_atual, progresso)
                    VALUES (%s, %s, 'Não Iniciado', 0)
                    ON CONFLICT DO NOTHING
                """, (aluno["id"], ex["id"]))

    add_audit_log(g.user_role, g.entity_id or g.auth_user_id, "Cadastro",
                  f"Cadastrou o aluno '{nome}' (matrícula: {matricula})")
    return jsonify({"success": True, "aluno": aluno}), 201


@app.route("/api/alunos/importar-csv", methods=["POST"])
@require_auth("professor", "admin")
def importar_alunos_csv():
    """Importa alunos via CSV. Colunas: nome[,matricula[,email]]"""
    data = request.json or {}
    csv_text = data.get("csv_text", "")
    turma_id = data.get("turma_id")

    if not csv_text or not turma_id:
        return jsonify({"success": False, "error": "csv_text e turma_id são obrigatórios."}), 400

    importados = 0
    ignorados = 0
    erros = []

    reader = csv.DictReader(io.StringIO(csv_text), fieldnames=["nome", "matricula", "email"])
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM turmas WHERE id = %s", (turma_id,))
            if not cur.fetchone():
                return jsonify({"success": False, "error": "Turma não encontrada."}), 404

            for i, row in enumerate(reader):
                if i == 0 and (not row.get("nome") or row["nome"].lower() in ("nome", "name")):
                    continue  # pular header

                nome = (row.get("nome") or "").strip()
                if not nome:
                    ignorados += 1
                    continue

                matricula = (row.get("matricula") or "").strip()
                if not matricula:
                    matricula = f"ETE{datetime.datetime.now().strftime('%Y')}{str(uuid.uuid4().int)[:6]}"

                email = (row.get("email") or f"{matricula.lower()}@ete.edu.br").strip()

                try:
                    cur.execute("""
                        INSERT INTO alunos (nome, matricula, email, turma_id, primeiro_acesso)
                        VALUES (%s, %s, %s, %s, TRUE)
                        ON CONFLICT (matricula) DO NOTHING
                        RETURNING id
                    """, (nome, matricula, email, turma_id))
                    aluno = cur.fetchone()
                    if aluno:
                        # Status para exercícios existentes
                        cur.execute("SELECT id FROM exercicios WHERE ativo = TRUE")
                        for ex in cur.fetchall():
                            cur.execute("""
                                INSERT INTO status_atividades (aluno_id, exercicio_id, estado_atual, progresso)
                                VALUES (%s, %s, 'Não Iniciado', 0)
                                ON CONFLICT DO NOTHING
                            """, (aluno["id"], ex["id"]))
                        importados += 1
                    else:
                        ignorados += 1
                except Exception as e:
                    erros.append(f"Linha {i+1} ({nome}): {str(e)[:100]}")
                    ignorados += 1

    add_audit_log(g.user_role, g.entity_id or g.auth_user_id, "Importação",
                  f"Importou {importados} alunos via CSV para turma {turma_id}")
    return jsonify({"success": True, "importados": importados, "ignorados": ignorados, "erros": erros})


@app.route("/api/alunos/<aluno_id>", methods=["PUT"])
@require_auth("professor", "admin")
def editar_aluno(aluno_id):
    data = request.json or {}
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE alunos SET
                    nome     = COALESCE(%s, nome),
                    turma_id = COALESCE(%s, turma_id),
                    foto     = COALESCE(%s, foto),
                    updated_at = NOW()
                WHERE id = %s
                RETURNING *
            """, (data.get("nome"), data.get("turma_id"), data.get("foto"), aluno_id))
            aluno = cur.fetchone()
    if not aluno:
        return jsonify({"success": False, "error": "Aluno não encontrado."}), 404
    return jsonify({"success": True, "aluno": dict(aluno)})


@app.route("/api/alunos/<aluno_id>", methods=["DELETE"])
@require_auth("admin")
def excluir_aluno(aluno_id):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT nome, matricula FROM alunos WHERE id = %s", (aluno_id,))
            aluno = cur.fetchone()
            if not aluno:
                return jsonify({"success": False, "error": "Aluno não encontrado."}), 404
            cur.execute("DELETE FROM alunos WHERE id = %s", (aluno_id,))
    add_audit_log(g.user_role, g.entity_id or g.auth_user_id, "Exclusão",
                  f"Excluiu o aluno '{aluno['nome']}' (matrícula: {aluno['matricula']})")
    return jsonify({"success": True})


# ─────────────────────────────────────────────
# PROFESSORES
# ─────────────────────────────────────────────
@app.route("/api/professores", methods=["GET"])
@require_auth("admin")
def listar_professores():
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, usuario, email, nome, created_at FROM professores ORDER BY nome")
            professores = [dict(r) for r in cur.fetchall()]
    return jsonify({"success": True, "professores": professores})


@app.route("/api/professores", methods=["POST"])
@require_auth("admin")
def criar_professor():
    data = request.json or {}
    usuario = data.get("usuario", "").strip().lower()
    email = data.get("email", "").strip().lower()
    nome = data.get("nome", "").strip()

    if not usuario or not email or not nome:
        return jsonify({"success": False, "error": "usuario, email e nome são obrigatórios."}), 400

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO professores (usuario, email, nome)
                VALUES (%s, %s, %s)
                RETURNING *
            """, (usuario, email, nome))
            prof = dict(cur.fetchone())
    add_audit_log(g.user_role, g.entity_id or g.auth_user_id, "Cadastro",
                  f"Cadastrou o professor '{nome}' ({usuario})")
    return jsonify({"success": True, "professor": prof}), 201


@app.route("/api/professores/<prof_id>", methods=["PUT"])
@require_auth("admin")
def editar_professor(prof_id):
    data = request.json or {}
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE professores SET
                    usuario    = COALESCE(%s, usuario),
                    email      = COALESCE(%s, email),
                    nome       = COALESCE(%s, nome),
                    updated_at = NOW()
                WHERE id = %s RETURNING *
            """, (data.get("usuario"), data.get("email"), data.get("nome"), prof_id))
            prof = cur.fetchone()
    if not prof:
        return jsonify({"success": False, "error": "Professor não encontrado."}), 404
    return jsonify({"success": True, "professor": dict(prof)})


@app.route("/api/professores/<prof_id>", methods=["DELETE"])
@require_auth("admin")
def excluir_professor(prof_id):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT nome FROM professores WHERE id = %s", (prof_id,))
            prof = cur.fetchone()
            if not prof:
                return jsonify({"success": False, "error": "Professor não encontrado."}), 404
            cur.execute("DELETE FROM professores WHERE id = %s", (prof_id,))
    add_audit_log(g.user_role, g.entity_id or g.auth_user_id, "Exclusão",
                  f"Excluiu o professor '{prof['nome']}'")
    return jsonify({"success": True})


# ─────────────────────────────────────────────
# STATUS ATIVIDADES (Aluno atualiza o próprio)
# ─────────────────────────────────────────────
@app.route("/api/atividades/status", methods=["POST"])
@require_auth()
def atualizar_status():
    """
    Aluno atualiza o próprio estado/progresso.
    Professor/Admin pode atualizar qualquer aluno.
    """
    data = request.json or request.form.to_dict()
    atividade_id = data.get("atividade_id")
    exercicio_id = data.get("exercicio_id")
    novo_estado = data.get("estado_atual")
    novo_progresso = data.get("progresso")
    observacao = data.get("observacao")

    if not atividade_id and not exercicio_id:
        return jsonify({"success": False, "error": "atividade_id ou exercicio_id são obrigatórios."}), 400
    if not novo_estado:
        return jsonify({"success": False, "error": "estado_atual é obrigatório."}), 400

    estados_validos = ["Não Iniciado", "Codificando", "Preciso de Ajuda", "Pausado", "Concluído"]
    if novo_estado not in estados_validos:
        return jsonify({"success": False, "error": f"Estado inválido. Use: {estados_validos}"}), 400

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # Se vier exercicio_id e for aluno, buscar atividade_id
            if not atividade_id and exercicio_id and g.user_role == "aluno":
                cur.execute("SELECT id FROM alunos WHERE auth_user_id = %s", (g.auth_user_id,))
                aluno_row = cur.fetchone()
                if aluno_row:
                    cur.execute("SELECT id FROM status_atividades WHERE aluno_id = %s AND exercicio_id = %s", (aluno_row["id"], exercicio_id))
                    ativ = cur.fetchone()
                    if ativ:
                        atividade_id = ativ["id"]

            if not atividade_id:
                return jsonify({"success": False, "error": "Atividade não encontrada ou não especificada."}), 404

            # Buscar atividade
            cur.execute("SELECT * FROM status_atividades WHERE id = %s", (atividade_id,))
            atividade = cur.fetchone()
            if not atividade:
                return jsonify({"success": False, "error": "Atividade não encontrada."}), 404

            # Aluno só pode atualizar as próprias atividades
            if g.user_role == "aluno":
                cur.execute(
                    "SELECT id FROM alunos WHERE auth_user_id = %s",
                    (g.auth_user_id,)
                )
                aluno_row = cur.fetchone()
                if not aluno_row or str(atividade["aluno_id"]) != str(aluno_row["id"]):
                    return jsonify({"success": False, "error": "Acesso não autorizado a esta atividade."}), 403

            estado_anterior = atividade["estado_atual"]
            progresso = int(novo_progresso) if novo_progresso is not None else atividade["progresso"]
            tempo_inicio = atividade["tempo_inicio"]
            tempo_fim = atividade["tempo_fim"]
            tempo_gasto_str = None

            now = datetime.datetime.utcnow()
            if novo_estado == "Codificando" and estado_anterior != "Codificando":
                tempo_inicio = now
                tempo_fim = None
            elif novo_estado == "Concluído":
                tempo_fim = now
                progresso = 100
                if tempo_inicio:
                    delta = int((tempo_fim - tempo_inicio).total_seconds())
                    minutos, segundos = divmod(delta, 60)
                    tempo_gasto_str = f"{minutos} min e {segundos} s" if minutos > 0 else f"{segundos} segundos"

            cur.execute("""
                UPDATE status_atividades SET
                    estado_atual = %s,
                    progresso    = %s,
                    tempo_inicio = %s,
                    tempo_fim    = %s,
                    observacao   = COALESCE(%s, observacao),
                    updated_at   = NOW()
                WHERE id = %s
                RETURNING *
            """, (novo_estado, progresso, tempo_inicio, tempo_fim,
                  observacao, atividade_id))
            updated = dict(cur.fetchone())

            # Registrar no histórico se houve mudança de estado
            if estado_anterior != novo_estado:
                tempo_decorrido = None
                if tempo_inicio:
                    fim_calc = tempo_fim or now
                    tempo_decorrido = int((fim_calc - tempo_inicio).total_seconds())

                cur.execute("""
                    INSERT INTO historico_status (
                        aluno_id, exercicio_id, estado_anterior, estado_novo,
                        progresso, tempo_decorrido, observacao
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (
                    atividade["aluno_id"], atividade["exercicio_id"],
                    estado_anterior, novo_estado,
                    progresso, tempo_decorrido, observacao
                ))

                # Log de status rápido
                cur.execute("""
                    INSERT INTO logs_status (aluno_id, exercicio_id, estado_antigo, estado_novo)
                    VALUES (%s, %s, %s, %s)
                """, (atividade["aluno_id"], atividade["exercicio_id"],
                      estado_anterior, novo_estado))

    return jsonify({
        "success": True,
        "estado_atual": updated["estado_atual"],
        "progresso": updated["progresso"],
        "tempo_gasto": tempo_gasto_str
    })


@app.route("/api/atividades/observacao", methods=["POST"])
@require_auth()
def salvar_observacao():
    """Auto-save de observações (chamado a cada 10s pelo frontend)."""
    data = request.json or {}
    atividade_id = data.get("atividade_id")
    exercicio_id = data.get("exercicio_id")
    observacao = data.get("observacao", "")

    if not atividade_id and not exercicio_id:
        return jsonify({"success": False, "error": "atividade_id ou exercicio_id são obrigatórios."}), 400

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            if not atividade_id and exercicio_id and g.user_role == "aluno":
                cur.execute("SELECT id FROM alunos WHERE auth_user_id = %s", (g.auth_user_id,))
                aluno_row = cur.fetchone()
                if aluno_row:
                    cur.execute("SELECT id FROM status_atividades WHERE aluno_id = %s AND exercicio_id = %s", (aluno_row["id"], exercicio_id))
                    ativ = cur.fetchone()
                    if ativ:
                        atividade_id = ativ["id"]

            if not atividade_id:
                return jsonify({"success": False, "error": "Atividade não encontrada."}), 404

            cur.execute("""
                UPDATE status_atividades
                SET observacao = %s, updated_at = NOW()
                WHERE id = %s
                RETURNING id
            """, (observacao, atividade_id))
            if not cur.fetchone():
                return jsonify({"success": False, "error": "Atividade não encontrada."}), 404

    return jsonify({"success": True})


@app.route("/api/atividades/codigo", methods=["POST"])
@require_auth()
def salvar_codigo():
    """Salva o código Python atual do aluno (auto-save)."""
    data = request.json or {}
    atividade_id = data.get("atividade_id")
    exercicio_id = data.get("exercicio_id")
    codigo = data.get("codigo", "")

    if not atividade_id and not exercicio_id:
        return jsonify({"success": False, "error": "atividade_id ou exercicio_id são obrigatórios."}), 400

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            if not atividade_id and exercicio_id and g.user_role == "aluno":
                cur.execute("SELECT id FROM alunos WHERE auth_user_id = %s", (g.auth_user_id,))
                aluno_row = cur.fetchone()
                if aluno_row:
                    cur.execute("SELECT id FROM status_atividades WHERE aluno_id = %s AND exercicio_id = %s", (aluno_row["id"], exercicio_id))
                    ativ = cur.fetchone()
                    if ativ:
                        atividade_id = ativ["id"]

            if not atividade_id:
                return jsonify({"success": False, "error": "Atividade não encontrada."}), 404

            cur.execute("""
                UPDATE status_atividades
                SET codigo_salvo = %s, updated_at = NOW()
                WHERE id = %s
                RETURNING id
            """, (codigo, atividade_id))
            if not cur.fetchone():
                return jsonify({"success": False, "error": "Atividade não encontrada."}), 404

    return jsonify({"success": True})


@app.route("/api/atividades/nota", methods=["POST"])
@require_auth("professor", "admin")
def atribuir_nota():
    """Professor atribui nota e observações a um aluno."""
    data = request.json or {}
    atividade_id = data.get("atividade_id")
    nota = data.get("nota")
    observacao = data.get("observacao")

    if not atividade_id:
        return jsonify({"success": False, "error": "atividade_id é obrigatório."}), 400

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE status_atividades SET
                    nota       = %s,
                    observacao = COALESCE(%s, observacao),
                    updated_at = NOW()
                WHERE id = %s
                RETURNING *
            """, (nota, observacao, atividade_id))
            atividade = cur.fetchone()
    if not atividade:
        return jsonify({"success": False, "error": "Atividade não encontrada."}), 404
    return jsonify({"success": True, "atividade": dict(atividade)})


# ─────────────────────────────────────────────
# DASHBOARD DO PROFESSOR — Dados Consolidados
# ─────────────────────────────────────────────
@app.route("/api/professor/dados", methods=["GET"])
@require_auth("professor", "admin")
def get_professor_dados():
    """Retorna todos os dados necessários para o dashboard do professor."""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM turmas ORDER BY nome")
            turmas = [dict(r) for r in cur.fetchall()]

            cur.execute("SELECT * FROM exercicios WHERE ativo = TRUE ORDER BY titulo")
            exercicios = [dict(r) for r in cur.fetchall()]

            cur.execute("""
                SELECT a.*, t.nome AS turma_nome
                FROM alunos a JOIN turmas t ON a.turma_id = t.id
                ORDER BY t.nome, a.nome
            """)
            alunos = [dict(r) for r in cur.fetchall()]

            cur.execute("SELECT * FROM vw_atividades_professor ORDER BY ultima_atualizacao DESC")
            atividades = [dict(r) for r in cur.fetchall()]

            cur.execute("""
                SELECT h.*, a.nome AS aluno_nome, e.titulo AS exercicio_titulo
                FROM historico_status h
                JOIN alunos a ON h.aluno_id = a.id
                JOIN exercicios e ON h.exercicio_id = e.id
                ORDER BY h.timestamp DESC
                LIMIT 100
            """)
            historico = [dict(r) for r in cur.fetchall()]

            cur.execute("SELECT * FROM vw_stats_turma")
            stats = [dict(r) for r in cur.fetchall()]

    return jsonify({
        "success": True,
        "turmas": turmas,
        "exercicios": exercicios,
        "alunos": alunos,
        "atividades": atividades,
        "historico": historico,
        "stats": stats
    })


# ─────────────────────────────────────────────
# DASHBOARD DO ALUNO — Dados Pessoais
# ─────────────────────────────────────────────
@app.route("/api/aluno/dados", methods=["GET"])
@require_auth("aluno")
def get_aluno_dados():
    """Retorna dados do aluno autenticado e suas atividades."""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT a.*, t.nome AS turma_nome FROM alunos a JOIN turmas t ON a.turma_id = t.id WHERE a.auth_user_id = %s",
                (g.auth_user_id,)
            )
            aluno = cur.fetchone()
            if not aluno:
                return jsonify({"success": False, "error": "Perfil de aluno não encontrado."}), 404

            aluno = dict(aluno)

            cur.execute("""
                SELECT sa.*, e.titulo, e.modulo, e.nivel, e.tempo_estimado,
                       e.objetivo_aprendizado, e.enunciado, e.entrada_esperada,
                       e.saida_esperada, e.exemplo_entrada, e.exemplo_saida, e.observacoes
                FROM status_atividades sa
                JOIN exercicios e ON sa.exercicio_id = e.id
                WHERE sa.aluno_id = %s
                ORDER BY e.titulo
            """, (aluno["id"],))
            atividades = [dict(r) for r in cur.fetchall()]

            # Exercício ativo da turma
            cur.execute("""
                SELECT exercicio_id FROM turmas_exercicio_ativo WHERE turma_id = %s
            """, (aluno["turma_id"],))
            row = cur.fetchone()
            exercicio_ativo_id = row["exercicio_id"] if row else None

    return jsonify({
        "success": True,
        "aluno": aluno,
        "atividades": atividades,
        "exercicio_ativo_id": exercicio_ativo_id
    })


@app.route("/api/aluno/primeiro-acesso", methods=["POST"])
@require_auth("aluno")
def marcar_primeiro_acesso():
    """Marca que o aluno já completou o primeiro acesso (trocou a senha)."""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE alunos SET primeiro_acesso = FALSE, updated_at = NOW() WHERE auth_user_id = %s",
                (g.auth_user_id,)
            )
    return jsonify({"success": True})


# ─────────────────────────────────────────────
# AUDIT LOGS
# ─────────────────────────────────────────────
@app.route("/api/admin/audits", methods=["GET"])
@require_auth("admin")
def listar_audits():
    limit = min(int(request.args.get("limit", 100)), 500)
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT %s",
                (limit,)
            )
            audits = [dict(r) for r in cur.fetchall()]
    return jsonify(audits)


@app.route("/api/admin/audits", methods=["POST"])
@require_auth("admin", "professor")
def criar_audit():
    data = request.json or {}
    add_audit_log(
        data.get("user_type", g.user_role),
        data.get("user_name", g.auth_user_id),
        data.get("action", "Manual"),
        data.get("description", "")
    )
    return jsonify({"success": True})


# ─────────────────────────────────────────────
# LOGS DE STATUS (feed ao vivo)
# ─────────────────────────────────────────────
@app.route("/api/logs", methods=["GET"])
@require_auth("professor", "admin")
def listar_logs():
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT ls.*, a.nome AS aluno_nome, e.titulo AS exercicio_titulo
                FROM logs_status ls
                LEFT JOIN alunos a ON ls.aluno_id = a.id
                LEFT JOIN exercicios e ON ls.exercicio_id = e.id
                ORDER BY ls.timestamp DESC
                LIMIT 30
            """)
            logs = [dict(r) for r in cur.fetchall()]
    return jsonify(logs)


# ─────────────────────────────────────────────
# BACKUP & EXPORT (Admin)
# ─────────────────────────────────────────────
@app.route("/api/admin/export", methods=["GET"])
@require_auth("admin")
def exportar_dados():
    """Exporta todos os dados em JSON para backup."""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM turmas ORDER BY nome")
            turmas = [dict(r) for r in cur.fetchall()]
            cur.execute("SELECT id, nome, matricula, email, turma_id, created_at FROM alunos ORDER BY nome")
            alunos = [dict(r) for r in cur.fetchall()]
            cur.execute("SELECT * FROM exercicios ORDER BY titulo")
            exercicios = [dict(r) for r in cur.fetchall()]
            cur.execute("SELECT * FROM status_atividades")
            status = [dict(r) for r in cur.fetchall()]

    from flask import Response
    import json

    def json_serial(obj):
        if isinstance(obj, (datetime.datetime, datetime.date)):
            return obj.isoformat()
        if isinstance(obj, uuid.UUID):
            return str(obj)
        raise TypeError(f"Type {type(obj)} not serializable")

    payload = json.dumps({
        "exported_at": datetime.datetime.utcnow().isoformat(),
        "turmas": turmas,
        "alunos": alunos,
        "exercicios": exercicios,
        "status_atividades": status
    }, default=json_serial, indent=2, ensure_ascii=False)

    add_audit_log("admin", g.auth_user_id, "Backup", "Exportou dados completos do banco")
    return Response(
        payload,
        mimetype="application/json",
        headers={"Content-Disposition": "attachment; filename=codetracker_backup.json"}
    )


# ─────────────────────────────────────────────
# GESTÃO DE USUÁRIOS / ROLES (Admin)
# ─────────────────────────────────────────────
@app.route("/api/usuarios", methods=["GET"])
@require_auth("admin")
def listar_usuarios():
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT ur.auth_user_id, ur.role, ur.entity_id, ur.created_at,
                       COALESCE(a.nome, p.nome, 'Admin') AS nome,
                       COALESCE(a.email, p.email) AS email
                FROM user_roles ur
                LEFT JOIN alunos a ON ur.entity_id = a.id AND ur.role = 'aluno'
                LEFT JOIN professores p ON ur.entity_id = p.id AND ur.role = 'professor'
                ORDER BY ur.role, nome
            """)
            usuarios = [dict(r) for r in cur.fetchall()]
    return jsonify({"success": True, "usuarios": usuarios})


@app.route("/api/usuarios/<auth_user_id>/role", methods=["PUT"])
@require_auth("admin")
def atualizar_role(auth_user_id):
    data = request.json or {}
    novo_role = data.get("role")
    if novo_role not in ("admin", "professor", "aluno"):
        return jsonify({"success": False, "error": "role inválido. Use: admin, professor, aluno"}), 400

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE user_roles SET role = %s, updated_at = NOW()
                WHERE auth_user_id = %s
                RETURNING *
            """, (novo_role, auth_user_id))
            updated = cur.fetchone()
    if not updated:
        return jsonify({"success": False, "error": "Usuário não encontrado."}), 404
    add_audit_log("admin", g.auth_user_id, "Edição",
                  f"Alterou o papel do usuário {auth_user_id} para '{novo_role}'")
    return jsonify({"success": True, "role": novo_role})


# ─────────────────────────────────────────────
# GEMINI AI TUTOR
# ─────────────────────────────────────────────
@app.route("/api/ai/tutor", methods=["POST"])
@require_auth()
@limiter.limit("10 per hour", key_func=lambda: g.get("auth_user_id", get_remote_address()))
def ai_tutor():
    """
    Tutor IA pedagógico baseado no método socrático.
    Guia o aluno sem revelar a resposta direta.
    """
    data = request.json or {}
    exercicio_id = data.get("exercicio_id")
    codigo_atual = (data.get("codigo_atual") or "")[:5000]  # limite de segurança
    duvida = (data.get("duvida") or "").strip()
    historico_conversa = data.get("historico_conversa", [])[-6:]  # últimas 6 mensagens

    if not exercicio_id or not duvida:
        return jsonify({"success": False, "error": "exercicio_id e duvida são obrigatórios."}), 400

    # Buscar dados do exercício (SEM saida_esperada e exemplo_saida por segurança)
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT titulo, modulo, nivel, objetivo_aprendizado, enunciado, entrada_esperada
                FROM exercicios WHERE id = %s AND ativo = TRUE
            """, (exercicio_id,))
            exercicio = cur.fetchone()

    if not exercicio:
        return jsonify({"success": False, "error": "Exercício não encontrado."}), 404

    exercicio = dict(exercicio)

    # Construir prompt do sistema
    system_prompt = f"""Você é um tutor de programação Python especializado para alunos do Ensino Médio Técnico (ETE Pedro Leão Leal).
Seu papel é GUIAR o raciocínio do aluno usando o método socrático — nunca dê a resposta direta.

EXERCÍCIO ATUAL:
- Título: {exercicio['titulo']}
- Módulo: {exercicio['modulo']}
- Nível: {exercicio['nivel']}
- Objetivo: {exercicio['objetivo_aprendizado']}
- Enunciado: {exercicio['enunciado']}
- Entrada esperada: {exercicio['entrada_esperada']}

REGRAS ABSOLUTAS (nunca quebre estas regras):
1. NUNCA escreva o código solução completo ou parcial que resolva o problema
2. NUNCA diga exatamente qual linha está errada e o que trocar
3. Use PERGUNTAS para guiar o raciocínio (ex: "O que acontece quando você tenta...?")
4. Aponte CONCEITOS Python para o aluno estudar (ex: "Você conhece o operador %?")
5. Parabenize tentativas e progressos genuinamente
6. Seja encorajador, empático e paciente — use linguagem simples e acessível
7. Máximo 3 parágrafos por resposta — seja conciso
8. Se o código tiver um erro de sintaxe óbvio, APENAS aponte que há um problema de sintaxe naquela área, sem corrigi-lo

Responda em Português Brasileiro."""

    # Montar histórico de conversa
    mensagens = []
    for msg in historico_conversa:
        role = "user" if msg.get("role") == "user" else "model"
        mensagens.append({"role": role, "parts": [{"text": msg.get("content", "")}]})

    # Adicionar pergunta atual com contexto do código
    user_message = f"Minha dúvida: {duvida}"
    if codigo_atual.strip():
        user_message += f"\n\nMeu código atual:\n```python\n{codigo_atual}\n```"
    mensagens.append({"role": "user", "parts": [{"text": user_message}]})

    # Chamar Gemini
    gemini_api_key = os.environ.get("GEMINI_API_KEY")
    if not gemini_api_key:
        return jsonify({"success": False, "error": "Gemini AI não configurado neste ambiente."}), 503

    try:
        import google.generativeai as genai
        genai.configure(api_key=gemini_api_key)

        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            system_instruction=system_prompt
        )

        chat = model.start_chat(history=mensagens[:-1])
        response = chat.send_message(mensagens[-1]["parts"][0]["text"])
        resposta_texto = response.text

    except Exception as e:
        app.logger.error(f"Erro na chamada Gemini: {e}")
        return jsonify({"success": False, "error": "Falha ao consultar o tutor IA. Tente novamente."}), 503

    return jsonify({
        "success": True,
        "resposta": resposta_texto,
        "exercicio_titulo": exercicio["titulo"]
    })


# ─────────────────────────────────────────────
# INICIALIZAÇÃO
# ─────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = FLASK_ENV == "development"
    app.run(host="0.0.0.0", port=port, debug=debug)

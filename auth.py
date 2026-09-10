import os
import datetime
import jwt
from functools import wraps
from flask import request, jsonify, g
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash, check_password_hash

load_dotenv()

SESSION_SECRET = os.environ.get("SESSION_SECRET", "codetracker-ete-super-secret-key-2026-fallback")


# ─────────────────────────────────────────────
# Criptografia de Senhas (scrypt / pbkdf2)
# ─────────────────────────────────────────────
def hash_password(password: str) -> str:
    """Gera hash seguro para a senha fornecida."""
    return generate_password_hash(password)


def verify_password(plain_password: str, hashed_password: str | None) -> bool:
    """Verifica se a senha em texto puro confere com o hash armazenado."""
    if not hashed_password or not plain_password:
        return False
    return check_password_hash(hashed_password, plain_password)


# ─────────────────────────────────────────────
# Tokens JWT Locais (HS256)
# ─────────────────────────────────────────────
def create_access_token(
    user_id: str,
    role: str,
    email: str,
    name: str = "",
    entity_id: str | None = None,
    expires_in_days: int = 7
) -> str:
    """Gera um token de acesso JWT assinado com SESSION_SECRET."""
    now = datetime.datetime.now(datetime.timezone.utc)
    payload = {
        "sub": str(user_id),
        "role": role,
        "email": email,
        "name": name,
        "entity_id": str(entity_id) if entity_id else None,
        "iat": now,
        "exp": now + datetime.timedelta(days=expires_in_days)
    }
    return jwt.encode(payload, SESSION_SECRET, algorithm="HS256")


def decode_jwt(token: str) -> dict:
    """Decodifica e valida o token JWT usando SESSION_SECRET."""
    return jwt.decode(token, SESSION_SECRET, algorithms=["HS256"])


def get_current_user() -> dict | None:
    """
    Extrai e valida o token JWT do header Authorization.
    Retorna o payload do token ou None se não autenticado.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header[7:].strip()
    try:
        payload = decode_jwt(token)
        return payload
    except Exception:
        return None


# ─────────────────────────────────────────────
# Decorador de Proteção de Rotas (RBAC)
# ─────────────────────────────────────────────
def require_auth(*roles: str):
    """
    Decorador que protege uma rota Flask exigindo autenticação JWT.
    Opcionalmente verifica se o usuário tem um dos papéis especificados.

    Uso:
        @require_auth()                    # qualquer usuário autenticado
        @require_auth("professor", "admin") # apenas professor ou admin
        @require_auth("admin")             # apenas admin
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            payload = get_current_user()
            if payload is None:
                return jsonify({"success": False, "error": "Não autenticado. Token JWT inválido ou expirado."}), 401

            auth_user_id = payload.get("sub")
            if not auth_user_id:
                return jsonify({"success": False, "error": "Token inválido: sem identificador de usuário."}), 401

            user_role = payload.get("role")
            entity_id = payload.get("entity_id")

            # Se o token não tiver o papel gravado, consulta o banco de dados
            if not user_role:
                from database import get_db_connection
                with get_db_connection() as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            "SELECT role, entity_id FROM user_roles WHERE auth_user_id = %s",
                            (auth_user_id,)
                        )
                        row = cur.fetchone()
                        if row:
                            user_role = row["role"] if isinstance(row, dict) else row[0]
                            entity_id = row["entity_id"] if isinstance(row, dict) else row[1]

            if not user_role:
                return jsonify({"success": False, "error": "Usuário sem papel atribuído. Contate o administrador."}), 403

            # Verificar se o papel é permitido
            if roles and user_role not in roles:
                return jsonify({
                    "success": False,
                    "error": f"Acesso negado. Papel '{user_role}' não tem permissão para esta operação."
                }), 403

            # Disponibilizar dados do usuário via flask.g
            g.auth_user_id = auth_user_id
            g.user_role = user_role
            g.entity_id = entity_id
            g.email = payload.get("email")
            g.user_name = payload.get("name")

            return f(*args, **kwargs)
        return decorated_function
    return decorator

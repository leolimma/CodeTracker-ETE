import os
import jwt
import requests
from functools import wraps
from flask import request, jsonify, g
from dotenv import load_dotenv

load_dotenv()

NEON_AUTH_JWKS_URL = os.environ.get(
    "NEON_AUTH_JWKS_URL",
    "https://api.stack-auth.com/api/v1/projects/{}/well-known/jwks.json".format(
        os.environ.get("NEON_AUTH_PROJECT_ID", "")
    )
)

# Cache simples da chave pública JWKS
_jwks_cache: dict | None = None


def _get_jwks() -> dict:
    """Obtém as chaves públicas JWKS do Neon Auth (com cache simples)."""
    global _jwks_cache
    if _jwks_cache is None:
        try:
            resp = requests.get(NEON_AUTH_JWKS_URL, timeout=5)
            resp.raise_for_status()
            _jwks_cache = resp.json()
        except Exception as e:
            raise RuntimeError(f"Falha ao obter JWKS: {e}")
    return _jwks_cache


def decode_jwt(token: str) -> dict:
    """
    Decodifica e valida um JWT do Neon Auth usando as chaves JWKS públicas.
    Retorna o payload do token ou lança exceção em caso de erro.
    """
    jwks = _get_jwks()
    public_keys = {}
    for key_data in jwks.get("keys", []):
        kid = key_data.get("kid")
        if kid:
            public_keys[kid] = jwt.algorithms.RSAAlgorithm.from_jwk(key_data)

    # Decodificar o header para obter o kid
    header = jwt.get_unverified_header(token)
    kid = header.get("kid")
    if not kid or kid not in public_keys:
        raise jwt.InvalidTokenError("kid não encontrado nas chaves JWKS")

    public_key = public_keys[kid]
    payload = jwt.decode(
        token,
        public_key,
        algorithms=["RS256"],
        options={"verify_exp": True}
    )
    return payload


def get_current_user() -> dict | None:
    """
    Extrai e valida o token JWT do header Authorization.
    Retorna o payload do token ou None se não autenticado.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header[7:]
    try:
        payload = decode_jwt(token)
        return payload
    except Exception:
        return None


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
                return jsonify({"success": False, "error": "Não autenticado. Token JWT inválido ou ausente."}), 401

            # O Neon Auth coloca o user ID em 'sub'
            auth_user_id = payload.get("sub")
            if not auth_user_id:
                return jsonify({"success": False, "error": "Token inválido: sem sub"}), 401

            # Buscar role do usuário no banco
            from database import get_db_connection
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT role, entity_id FROM user_roles WHERE auth_user_id = %s",
                        (auth_user_id,)
                    )
                    row = cur.fetchone()

            if not row:
                return jsonify({"success": False, "error": "Usuário sem papel atribuído. Contate o administrador."}), 403

            user_role = row[0]
            entity_id = row[1]

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

            return f(*args, **kwargs)
        return decorated_function
    return decorator

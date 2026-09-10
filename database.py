import os
import psycopg2
import psycopg2.extras
from contextlib import contextmanager
from dotenv import load_dotenv

load_dotenv()

def get_database_url() -> str:
    """Retorna a URL do banco garantindo formatação adequada e suporte a SSL para o Neon."""
    url = (os.environ.get("DATABASE_URL") or "").strip()
    if not url:
        return ""
    # Suporte a strings que começam com postgres://
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    # Garante parâmetro sslmode=require para conexões seguras com o Neon
    if "sslmode=" not in url:
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}sslmode=require"
    return url


@contextmanager
def get_db_connection():
    """
    Context manager que fornece uma conexão psycopg2 ao Neon PostgreSQL.
    Faz commit automático ao sair sem exceção, rollback em caso de erro.
    Retorna dicts nos cursores via RealDictCursor.

    Uso:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM turmas")
                rows = cur.fetchall()
    """
    db_url = get_database_url()
    if not db_url:
        raise EnvironmentError(
            "DATABASE_URL não definida. Configure a variável de ambiente no Render "
            "com a connection string do Neon PostgreSQL."
        )

    conn = psycopg2.connect(
        db_url,
        cursor_factory=psycopg2.extras.RealDictCursor
    )
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_db():
    """
    Versão geradora para compatibilidade com Flask dependency injection.
    Uso nos endpoints: db = next(get_db())
    """
    with get_db_connection() as conn:
        yield conn

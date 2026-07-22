import os
import psycopg2
import psycopg2.extras
from contextlib import contextmanager
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")

if not DATABASE_URL:
    raise EnvironmentError(
        "DATABASE_URL não definida. Configure a variável de ambiente com a "
        "connection string do Neon PostgreSQL."
    )


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
    conn = psycopg2.connect(
        DATABASE_URL,
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

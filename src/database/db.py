"""
Family Guardian 360° - Database Manager (SQLiteCloud Online + Ping)
Desenvolvido por: João Layon - Desenvolvedor Full Stack
Sistema com SQLiteCloud ONLINE + Ping automático a cada 5 minutos
"""

import os
import threading
import time
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

# Configurar timezone de Brasília
BRASILIA_TZ = ZoneInfo('America/Sao_Paulo')

def now_brasilia():
    """Retorna datetime atual no horário de Brasília"""
    return datetime.now(BRASILIA_TZ)

try:
    import sqlitecloud
    CLOUD_AVAILABLE = True
except ImportError:
    CLOUD_AVAILABLE = False
    raise Exception("⚠️ SQLite Cloud não instalado. Este sistema requer SQLiteCloud!")

# Caminho do banco de dados (mantido para compatibilidade com código existente)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

print(f"📂 Diretório base: {BASE_DIR}")
print("☁️ Modo: SQLiteCloud ONLINE com ping a cada 5 minutos")

# Configuração do SQLite Cloud
CLOUD_CONNECTION_STRING = os.environ.get(
    'SQLITE_CLOUD_URL',
    'sqlitecloud://cmq6frwshz.g4.sqlite.cloud:8860/family_guardian.db?apikey=Dor8OwUECYmrbcS5vWfsdGpjCpdm9ecSDJtywgvRw8k'
)

# Ping service
_ping_thread = None
_ping_running = False
_last_ping_time = None

def get_db_connection():
    """Retorna uma NOVA conexão com o banco de dados (SQLiteCloud)
    IMPORTANTE: Sempre feche a conexão após o uso com conn.close()
    """
    try:
        conn = sqlitecloud.connect(CLOUD_CONNECTION_STRING)
        conn.row_factory = dict_factory
        return conn
    except Exception as e:
        print(f"❌ Erro ao conectar: {e}")
        raise Exception(f"❌ Não foi possível conectar ao SQLite Cloud: {e}")

def dict_factory(cursor, row):
    """Converte linhas do banco em dicionários"""
    fields = [column[0] for column in cursor.description]
    return {key: value for key, value in zip(fields, row)}

def ping_database():
    """Executa ping no banco para manter conexão ativa"""
    global _last_ping_time

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        cursor.fetchone()
        cursor.close()
        conn.close()
        _last_ping_time = datetime.now()
        return True
    except Exception as e:
        print(f"⚠️ Erro no ping: {e}")
        return False

def _ping_loop():
    """Loop de ping em background - a cada 5 minutos"""
    global _ping_running, _last_ping_time

    print("🏓 Sistema de ping iniciado (intervalo: 5 minutos)")

    while _ping_running:
        try:
            success = ping_database()
            if success:
                if _last_ping_time:
                    elapsed = (datetime.now() - _last_ping_time).total_seconds()
                    print(f"✅ Ping OK às {_last_ping_time.strftime('%H:%M:%S')}")
                else:
                    print("✅ Primeiro ping OK")

        except Exception as e:
            print(f"❌ Erro no loop de ping: {e}")

        # Espera 5 minutos (300 segundos) antes do próximo ping
        time.sleep(300)

def start_ping_service():
    """Inicia serviço de ping em background"""
    global _ping_thread, _ping_running

    if _ping_running:
        print("⚠️ Serviço de ping já está rodando")
        return

    _ping_running = True
    _ping_thread = threading.Thread(target=_ping_loop, daemon=True)
    _ping_thread.start()
    print("🚀 Serviço de ping iniciado com sucesso! (intervalo: 5 minutos)")

def stop_ping_service():
    """Para serviço de ping"""
    global _ping_running

    if not _ping_running:
        return

    _ping_running = False
    print("🛑 Serviço de ping parado")

def get_ping_status():
    """Retorna status do serviço de ping"""
    global _last_ping_time, _ping_running

    return {
        'running': _ping_running,
        'last_ping': _last_ping_time.isoformat() if _last_ping_time else None,
        'seconds_since_ping': (datetime.now() - _last_ping_time).total_seconds() if _last_ping_time else None
    }

def init_database():
    """Inicializa o banco de dados com o schema no Cloud"""
    print("🔧 Inicializando banco de dados no SQLiteCloud...")

    schema_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'schema.sql')
    print(f"📄 Carregando schema de: {schema_path}")

    with open(schema_path, 'r', encoding='utf-8') as f:
        schema = f.read()

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Executar statements um por um
        statements = [s.strip() for s in schema.split(';') if s.strip()]

        for statement in statements:
            try:
                cursor.execute(statement)
            except Exception as stmt_error:
                error_msg = str(stmt_error).lower()
                # Ignora erros de tabela/índice já existente
                if 'already exists' not in error_msg and 'duplicate' not in error_msg:
                    print(f"⚠️ Erro ao executar statement: {stmt_error}")

        conn.commit()
        cursor.close()
        conn.close()
        print("✅ Banco de dados SQLiteCloud inicializado com sucesso!")
    except Exception as e:
        print(f"⚠️ Erro ao criar schema no Cloud: {e}")

def cleanup_old_locations():
    """Remove localizações antigas (mais de 24 horas)"""
    try:
        conn = get_db_connection()
        cutoff_time = datetime.now(BRASILIA_TZ) - timedelta(hours=24)

        cursor = conn.cursor()
        cursor.execute(
            "DELETE FROM locations WHERE timestamp < ?",
            (cutoff_time,)
        )
        deleted = cursor.rowcount if hasattr(cursor, 'rowcount') else 0
        conn.commit()
        cursor.close()
        conn.close()

        return deleted
    except Exception as e:
        print(f"⚠️ Erro ao limpar localizações antigas: {e}")
        return 0

def run_migrations_on_db(conn, db_name="Cloud"):
    """Executa migrações em uma conexão específica"""
    cursor = conn.cursor()

    try:
        cursor.execute("PRAGMA table_info(users)")
        columns = [column[1] for column in cursor.fetchall()]

        if 'user_type' not in columns:
            print(f"🔄 [{db_name}] Adicionando coluna user_type...")
            cursor.execute("ALTER TABLE users ADD COLUMN user_type TEXT DEFAULT 'member'")
            cursor.execute("UPDATE users SET user_type = 'member' WHERE user_type IS NULL")
            conn.commit()
            print(f"✅ [{db_name}] Coluna user_type adicionada")
        else:
            print(f"✅ [{db_name}] Coluna user_type já existe")

        if 'user_category' not in columns:
            print(f"🔄 [{db_name}] Adicionando coluna user_category...")
            cursor.execute("ALTER TABLE users ADD COLUMN user_category TEXT DEFAULT NULL")
            conn.commit()
            print(f"✅ [{db_name}] Coluna user_category adicionada")
        else:
            print(f"✅ [{db_name}] Coluna user_category já existe")

        if 'cpf' not in columns:
            print(f"🔄 [{db_name}] Adicionando coluna cpf...")
            cursor.execute("ALTER TABLE users ADD COLUMN cpf TEXT")
            conn.commit()
            print(f"✅ [{db_name}] Coluna cpf adicionada")
        else:
            print(f"✅ [{db_name}] Coluna cpf já existe")

        if 'birth_date' not in columns:
            print(f"🔄 [{db_name}] Adicionando coluna birth_date...")
            cursor.execute("ALTER TABLE users ADD COLUMN birth_date DATE")
            conn.commit()
            print(f"✅ [{db_name}] Coluna birth_date adicionada")
        else:
            print(f"✅ [{db_name}] Coluna birth_date já existe")

        if 'updated_at' not in columns:
            print(f"🔄 [{db_name}] Adicionando coluna updated_at...")
            cursor.execute("ALTER TABLE users ADD COLUMN updated_at TIMESTAMP")
            cursor.execute("UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL")
            conn.commit()
            print(f"✅ [{db_name}] Coluna updated_at adicionada")
        else:
            print(f"✅ [{db_name}] Coluna updated_at já existe")

        # Migração 2: Adicionar first_access à tabela users
        if 'first_access' not in columns:
            print("⚙️ Executando migração: Adicionar first_access")
            cursor.execute("ALTER TABLE users ADD COLUMN first_access INTEGER DEFAULT 0")
            conn.commit()
            print("✅ Migração first_access concluída")
        else:
            print("✅ Coluna first_access já existe")

        # Migração 3: Adicionar campos de trial
        if 'is_trial' not in columns:
            print("⚙️ Executando migração: Adicionar is_trial")
            cursor.execute("ALTER TABLE users ADD COLUMN is_trial INTEGER DEFAULT 0")
            conn.commit()
            print("✅ Migração is_trial concluída")
        else:
            print("✅ Coluna is_trial já existe")

        if 'trial_started_at' not in columns:
            print("⚙️ Executando migração: Adicionar trial_started_at")
            cursor.execute("ALTER TABLE users ADD COLUMN trial_started_at TIMESTAMP")
            conn.commit()
            print("✅ Migração trial_started_at concluída")
        else:
            print("✅ Coluna trial_started_at já existe")

        if 'trial_expired' not in columns:
            print("⚙️ Executando migração: Adicionar trial_expired")
            cursor.execute("ALTER TABLE users ADD COLUMN trial_expired INTEGER DEFAULT 0")
            conn.commit()
            print("✅ Migração trial_expired concluída")
        else:
            print("✅ Coluna trial_expired já existe")

        if 'has_paid' not in columns:
            print("⚙️ Executando migração: Adicionar has_paid")
            cursor.execute("ALTER TABLE users ADD COLUMN has_paid INTEGER DEFAULT 0")
            conn.commit()
            print("✅ Migração has_paid concluída")
        else:
            print("✅ Coluna has_paid já existe")

        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='supervisor_permissions'")
        table_exists = cursor.fetchone()

        if not table_exists:
            print(f"🔄 [{db_name}] Criando tabela supervisor_permissions...")
            cursor.execute('''
                CREATE TABLE supervisor_permissions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    family_member_id INTEGER NOT NULL,
                    target_user_id INTEGER NOT NULL,
                    can_view_location INTEGER DEFAULT 0,
                    can_view_battery INTEGER DEFAULT 0,
                    can_view_history INTEGER DEFAULT 0,
                    can_receive_alerts INTEGER DEFAULT 0,
                    can_view_messages INTEGER DEFAULT 0,
                    can_send_messages INTEGER DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (family_member_id) REFERENCES family_members(id) ON DELETE CASCADE,
                    FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE,
                    UNIQUE(family_member_id, target_user_id)
                )
            ''')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_supervisor_permissions_family_member_id ON supervisor_permissions(family_member_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_supervisor_permissions_target_user_id ON supervisor_permissions(target_user_id)')
            conn.commit()
            print(f"✅ [{db_name}] Tabela supervisor_permissions criada com sucesso!")
        else:
            print(f"✅ [{db_name}] Tabela supervisor_permissions já existe")

        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='camera_photos'")
        table_exists = cursor.fetchone()

        if not table_exists:
            print(f"🔄 [{db_name}] Criando tabela camera_photos...")
            cursor.execute('''
                CREATE TABLE camera_photos (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    camera_type TEXT,
                    filepath TEXT,
                    captured_at TEXT,
                    created_at TEXT,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            ''')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_camera_photos_user_id ON camera_photos(user_id)')
            conn.commit()
            print(f"✅ [{db_name}] Tabela camera_photos criada com sucesso!")
        else:
            print(f"✅ [{db_name}] Tabela camera_photos já existe")

        cursor.close()
        print(f"✅ [{db_name}] Migrações concluídas")
        return True
    except Exception as e:
        print(f"⚠️ [{db_name}] Erro na migração: {e}")
        return False

def run_migrations():
    """Executa migrações do banco de dados Cloud"""
    try:
        conn = get_db_connection()
        run_migrations_on_db(conn, "Cloud")
        conn.close()
    except Exception as e:
        print(f"⚠️ [Cloud] Erro ao executar migrações: {e}")

def create_super_admin():
    """Cria o Super Admin padrão se não existir"""
    import bcrypt

    admin_email = os.environ.get('SUPER_ADMIN_EMAIL', 'admin@gmail.com')
    admin_password = os.environ.get('SUPER_ADMIN_PASSWORD', '30031936Vo.')

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        admin_exists = cursor.execute(
            "SELECT id FROM users WHERE email = ? OR username = ?",
            (admin_email, 'superadmin')
        ).fetchone()

        if not admin_exists:
            print("🔄 Criando Super Admin padrão...")
            password_hash = bcrypt.hashpw(admin_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

            cursor.execute(
                '''INSERT INTO users (username, email, password_hash, full_name, phone, user_type)
                   VALUES (?, ?, ?, ?, ?, ?)''',
                ('superadmin', admin_email, password_hash, 'Super Administrador', '', 'super_admin')
            )
            user_id = cursor.lastrowid

            cursor.execute(
                'INSERT INTO user_settings (user_id) VALUES (?)',
                (user_id,)
            )

            conn.commit()
            print("✅ Super Admin criado com sucesso!")
            print(f"   Email: {admin_email}")
        else:
            # Atualizar credenciais do Super Admin existente
            print("🔄 Atualizando credenciais do Super Admin...")
            password_hash = bcrypt.hashpw(admin_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

            try:
                cursor.execute(
                    '''UPDATE users
                       SET email = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP
                       WHERE username = 'superadmin' OR user_type = 'super_admin' ''',
                    (admin_email, password_hash)
                )
            except:
                cursor.execute(
                    '''UPDATE users
                       SET email = ?, password_hash = ?
                       WHERE username = 'superadmin' OR user_type = 'super_admin' ''',
                    (admin_email, password_hash)
                )
            conn.commit()
            print("✅ Credenciais do Super Admin atualizadas!")
            print(f"   Email: {admin_email}")

        cursor.close()
        conn.close()
    except Exception as e:
        print(f"⚠️ Erro ao criar Super Admin: {e}")
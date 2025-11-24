"""
Family Guardian 360° - Sistema Profissional de Gestão Familiar
Desenvolvido por: João Layon - Desenvolvedor Full Stack
"""

from flask import Flask, render_template, request, jsonify, session, redirect, url_for, send_file, make_response
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
from functools import wraps
import bcrypt
import secrets
import os
import sqlite3
import threading
import csv
import io
import json
import hashlib
import hmac
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

# Configurar timezone de Brasília
BRASILIA_TZ = ZoneInfo('America/Sao_Paulo')

def now_brasilia():
    """Retorna datetime atual no horário de Brasília"""
    return datetime.now(BRASILIA_TZ)

from database.db import get_db_connection, init_database, cleanup_old_locations, run_migrations, create_super_admin, start_ping_service, get_ping_status
from ai_engine import ai_engine
from encryption import encryption_engine
from relationship_profiles import relationship_profiles
from history_manager import history_manager
from widget_system import widget_system

app = Flask(__name__, static_folder='static', template_folder='templates')
app.secret_key = os.environ.get('SESSION_SECRET', secrets.token_hex(32))
app.config['SECRET_KEY'] = app.secret_key
CORS(app)

socketio = SocketIO(app, cors_allowed_origins="*", async_mode='gevent', logger=True, engineio_logger=True)

_db_initialized = False
_init_lock = threading.Lock()

@app.before_request
def ensure_database():
    """Garante que o banco de dados está inicializado antes do primeiro request"""
    global _db_initialized
    if not _db_initialized:
        with _init_lock:
            if not _db_initialized:
                try:
                    print("🚀 Inicializando sistema com SQLiteCloud...")
                    
                    # Verificar conexão e inicializar banco
                    try:
                        conn = get_db_connection()
                        cursor = conn.cursor()
                        cursor.execute('SELECT 1 FROM users LIMIT 1')
                        print("✅ Banco de dados já existe e está acessível")
                    except Exception as db_error:
                        print(f"⚠️ Criando estrutura do banco: {db_error}")
                        init_database()
                        print("✅ Banco de dados inicializado!")

                    run_migrations()
                    print("✅ Migrações executadas")

                    create_super_admin()

                    cleanup_old_locations()
                    print("✅ Cleanup de localizações antigas executado")

                    # Iniciar serviço de ping
                    start_ping_service()

                    _db_initialized = True
                    print("✅ Sistema inicializado com sucesso!")

                except Exception as e:
                    print(f"❌ ERRO CRÍTICO ao inicializar sistema: {e}")
                    import traceback
                    traceback.print_exc()
                    # Marcar como inicializado para não bloquear o sistema
                    _db_initialized = True

def login_required(f):
    """Decorator para proteger rotas que precisam de autenticação"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

def super_admin_required(f):
    """Decorator para proteger rotas que precisam de Super Admin"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))

        if session.get('user_type') != 'super_admin':
            return jsonify({
                'success': False, 
                'message': 'Acesso negado. Apenas Super Administradores podem acessar esta área.'
            }), 403

        return f(*args, **kwargs)
    return decorated_function

def family_admin_required(f):
    """Decorator para proteger rotas que precisam de Admin de Família ou superior"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))

        user_type = session.get('user_type', 'member')
        if user_type not in ['super_admin', 'family_admin']:
            return jsonify({
                'success': False, 
                'message': 'Acesso negado. Apenas Administradores podem acessar esta área.'
            }), 403

        return f(*args, **kwargs)
    return decorated_function

@app.route('/')
def index():
    """Página inicial - redireciona para dashboard se logado"""
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    """Página de login"""
    if request.method == 'POST':
        try:
            # Garantir que o banco de dados está inicializado
            global _db_initialized
            if not _db_initialized:
                with _init_lock:
                    if not _db_initialized:
                        if not os.path.exists(DATABASE_PATH):
                            init_database()
                        run_migrations()
                        create_super_admin()
                        _db_initialized = True

            data = request.get_json()
            if not data:
                return jsonify({'success': False, 'message': 'Dados inválidos'}), 400

            email = data.get('email', '').strip()
            password = data.get('password', '')

            if not email or not password:
                return jsonify({'success': False, 'message': 'Email e senha são obrigatórios'}), 400

            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute(
                'SELECT id, username, email, password_hash, full_name, user_type FROM users WHERE email = ?', (email,)
            )
            user = cursor.fetchone()

            if not user:
                cursor.close()
                conn.close()
                return jsonify({'success': False, 'message': 'Email ou senha incorretos'}), 401

            # user já é um dicionário devido ao dict_factory
            if not bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
                cursor.close()
                conn.close()
                return jsonify({'success': False, 'message': 'Email ou senha incorretos'}), 401

            # Verificar se é primeiro acesso
            if user.get('first_access') == 1:
                session['temp_user_id'] = user['id']
                session['temp_user_email'] = user['email']
                cursor.close()
                conn.close()
                return jsonify({
                    'success': True,
                    'first_access': True,
                    'message': 'Primeiro acesso detectado. Por favor, defina sua nova senha.',
                    'redirect': url_for('first_access')
                })

            session['user_id'] = user['id']
            session['username'] = user['username']
            session['full_name'] = user['full_name']
            session['user_type'] = user['user_type'] if user['user_type'] else 'member'
            
            cursor.close()

            conn.execute(
                'UPDATE users SET last_seen = ? WHERE id = ?',
                (now_brasilia(), user['id'])
            )
            conn.commit()
            conn.close()

            return jsonify({
                'success': True,
                'message': 'Login realizado com sucesso!',
                'redirect': url_for('dashboard')
            })
        except sqlite3.OperationalError as e:
            if 'no such table' in str(e):
                # Banco de dados não inicializado, tentar criar
                print(f"⚠️ Tabela não encontrada, reinicializando banco: {e}")
                try:
                    init_database()
                    run_migrations()
                    create_super_admin()
                    return jsonify({'success': False, 'message': 'Banco de dados inicializado. Tente fazer login novamente.'}), 500
                except Exception as init_error:
                    print(f"❌ Erro ao inicializar banco: {init_error}")
                    return jsonify({'success': False, 'message': 'Erro crítico ao inicializar sistema. Contate o administrador.'}), 500
            else:
                print(f"Erro no login: {e}")
                return jsonify({'success': False, 'message': f'Erro ao processar login: {str(e)}'}), 500
        except Exception as e:
            print(f"Erro no login: {e}")
            return jsonify({'success': False, 'message': f'Erro ao processar login: {str(e)}'}), 500

    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    """Página de registro - BLOQUEADA: Registro apenas via pagamento Kirvano ou criação por admin"""
    if request.method == 'POST':
        return jsonify({
            'success': False, 
            'message': 'O cadastro público está desabilitado. Para criar uma conta, realize o pagamento através da nossa plataforma Kirvano ou solicite a um administrador.'
        }), 403

    return render_template('register.html')

@app.route('/first-access', methods=['GET', 'POST'])
def first_access():
    """Página de primeiro acesso para definir nova senha"""
    if 'temp_user_id' not in session:
        return redirect(url_for('login'))
    
    if request.method == 'POST':
        try:
            data = request.get_json()
            new_password = data.get('new_password', '')
            confirm_password = data.get('confirm_password', '')
            
            if not new_password or not confirm_password:
                return jsonify({'success': False, 'message': 'Preencha todos os campos'}), 400
            
            if len(new_password) < 6:
                return jsonify({'success': False, 'message': 'A senha deve ter no mínimo 6 caracteres'}), 400
            
            if new_password != confirm_password:
                return jsonify({'success': False, 'message': 'As senhas não coincidem'}), 400
            
            user_id = session['temp_user_id']
            
            # Gerar hash da nova senha
            password_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
            # Atualizar senha e remover flag de primeiro acesso
            conn = get_db_connection()
            conn.execute(
                'UPDATE users SET password_hash = ?, first_access = 0, updated_at = ? WHERE id = ?',
                (password_hash, now_brasilia(), user_id)
            )
            
            user = conn.execute(
                'SELECT id, username, email, full_name, user_type FROM users WHERE id = ?',
                (user_id,)
            ).fetchone()
            
            conn.commit()
            conn.close()
            
            # Fazer login automático
            session.pop('temp_user_id', None)
            session.pop('temp_user_email', None)
            session['user_id'] = user['id']
            session['username'] = user['username']
            session['full_name'] = user['full_name']
            session['user_type'] = user['user_type'] if user['user_type'] else 'member'
            
            return jsonify({
                'success': True,
                'message': 'Senha definida com sucesso! Bem-vindo ao Family Guardian 360°',
                'redirect': url_for('dashboard')
            })
            
        except Exception as e:
            print(f"Erro ao definir nova senha: {e}")
            return jsonify({'success': False, 'message': f'Erro ao definir senha: {str(e)}'}), 500
    
    return render_template('first_access.html', email=session.get('temp_user_email'))

@app.route('/logout')
def logout():
    """Logout do usuário"""
    session.clear()
    return redirect(url_for('login'))

@app.route('/dashboard')
@login_required
def dashboard():
    """Dashboard principal"""
    return render_template('dashboard.html')

@app.route('/map')
@login_required
def map_view():
    """Visualização do mapa com localizações"""
    return render_template('map.html')

@app.route('/messages')
@login_required
def messages():
    """Página de mensagens"""
    return render_template('messages.html')

@app.route('/settings')
@login_required
def settings():
    """Página de configurações"""
    return render_template('settings.html')

@app.route('/subscription')
@login_required
def subscription_page():
    """Página de gerenciamento de assinatura"""
    return render_template('subscription.html')

@app.route('/admin')
@super_admin_required
def admin_panel():
    """Painel administrativo - apenas Super Admin"""
    return render_template('admin.html')

@app.route('/api/user/profile', methods=['GET'])
@login_required
def get_user_profile():
    """Retorna perfil do usuário logado"""
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'success': False, 'message': 'Usuário não autenticado'}), 401

        conn = get_db_connection()
        user = conn.execute(
            'SELECT id, username, email, full_name, phone, profile_image, user_type, created_at, last_seen FROM users WHERE id = ?',
            (user_id,)
        ).fetchone()

        settings = conn.execute(
            'SELECT * FROM user_settings WHERE user_id = ?',
            (user_id,)
        ).fetchone()
        conn.close()

        if not user:
            return jsonify({'success': False, 'message': 'Usuário não encontrado'}), 404

        return jsonify({
            'success': True,
            'user': dict(user),
            'settings': dict(settings) if settings else None
        })
    except Exception as e:
        print(f"Erro ao buscar perfil: {e}")
        return jsonify({'success': False, 'message': f'Erro ao buscar perfil: {str(e)}'}), 500

@app.route('/api/location/update', methods=['POST'])
@login_required
def update_location():
    """Atualiza localização do usuário em tempo real"""
    data = request.get_json()
    user_id = session['user_id']

    latitude = data.get('latitude')
    longitude = data.get('longitude')
    accuracy = data.get('accuracy')
    altitude = data.get('altitude')
    speed = data.get('speed')
    heading = data.get('heading')
    battery_level = data.get('battery_level')
    is_charging = data.get('is_charging', 0)
    status_message = data.get('status_message', '')

    if not latitude or not longitude:
        return jsonify({'success': False, 'message': 'Latitude e longitude são obrigatórias'}), 400

    conn = get_db_connection()
    try:
        conn.execute(
            '''INSERT INTO locations 
               (user_id, latitude, longitude, accuracy, altitude, speed, heading, battery_level, is_charging, status_message, timestamp)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
            (user_id, latitude, longitude, accuracy, altitude, speed, heading, battery_level, is_charging, status_message, now_brasilia())
        )
        conn.commit()

        user = conn.execute('SELECT full_name FROM users WHERE id = ?', (user_id,)).fetchone()
        families = conn.execute('SELECT family_id FROM family_members WHERE user_id = ?', (user_id,)).fetchall()

        if battery_level and battery_level < 20:
            conn.execute(
                '''INSERT INTO alerts (user_id, alert_type, alert_message, severity, timestamp)
                   VALUES (?, ?, ?, ?, ?)''',
                (user_id, 'battery_low', f'Bateria baixa: {battery_level}%', 'warning', now_brasilia())
            )
            conn.commit()

            socketio.emit('battery_alert', {
                'user_id': user_id,
                'user_name': user['full_name'] if user else 'Unknown',
                'battery_level': battery_level
            })

        abnormal = ai_engine.detect_abnormal_trajectory(user_id)
        if abnormal.get('is_abnormal'):
            conn.execute(
                '''INSERT INTO alerts (user_id, alert_type, alert_message, severity, latitude, longitude, timestamp)
                   VALUES (?, ?, ?, ?, ?, ?, ?)''',
                (user_id, 'abnormal_trajectory', abnormal['reason'], abnormal.get('severity', 'medium'), latitude, longitude, now_brasilia())
            )
            conn.commit()

            for family in families:
                socketio.emit('ai_alert', {
                    'user_id': user_id,
                    'user_name': user['full_name'] if user else 'Unknown',
                    'alert_type': 'abnormal_trajectory',
                    'message': abnormal['reason'],
                    'severity': abnormal.get('severity', 'medium')
                }, to=f'family_{family["family_id"]}')

        prolonged = ai_engine.detect_prolonged_stop(user_id)
        if prolonged.get('is_prolonged_stop'):
            conn.execute(
                '''INSERT INTO alerts (user_id, alert_type, alert_message, severity, latitude, longitude, timestamp)
                   VALUES (?, ?, ?, ?, ?, ?, ?)''',
                (user_id, 'prolonged_stop', f'Parado por {prolonged["minutes"]} minutos em local incomum', 'medium', latitude, longitude, now_brasilia())
            )
            conn.commit()

            for family in families:
                socketio.emit('ai_alert', {
                    'user_id': user_id,
                    'user_name': user['full_name'] if user else 'Unknown',
                    'alert_type': 'prolonged_stop',
                    'message': f'Parado por {prolonged["minutes"]} minutos em local incomum',
                    'severity': 'medium'
                }, to=f'family_{family["family_id"]}')

        dangerous = ai_engine.check_dangerous_area(latitude, longitude)
        if dangerous.get('is_dangerous'):
            conn.execute(
                '''INSERT INTO alerts (user_id, alert_type, alert_message, severity, latitude, longitude, timestamp)
                   VALUES (?, ?, ?, ?, ?, ?, ?)''',
                (user_id, 'dangerous_area', f'Área de risco: {dangerous["area_name"]}', 'critical', latitude, longitude, now_brasilia())
            )
            conn.commit()

            for family in families:
                socketio.emit('ai_alert', {
                    'user_id': user_id,
                    'user_name': user['full_name'] if user else 'Unknown',
                    'alert_type': 'dangerous_area',
                    'message': f'Área de risco: {dangerous["area_name"]}',
                    'severity': 'critical'
                }, to=f'family_{family["family_id"]}')

        if battery_level and is_charging:
            charging_analysis = ai_engine.analyze_battery_charging(user_id, battery_level, is_charging, latitude, longitude)
            if charging_analysis.get('is_suspicious'):
                conn.execute(
                    '''INSERT INTO alerts (user_id, alert_type, alert_message, severity, timestamp)
                       VALUES (?, ?, ?, ?, ?)''',
                    (user_id, 'suspicious_charging', charging_analysis['reason'], charging_analysis.get('severity', 'low'), now_brasilia())
                )
                conn.commit()

                for family in families:
                    socketio.emit('ai_alert', {
                        'user_id': user_id,
                        'user_name': user['full_name'] if user else 'Unknown',
                        'alert_type': 'suspicious_charging',
                        'message': charging_analysis['reason'],
                        'severity': charging_analysis.get('severity', 'low')
                    }, to=f'family_{family["family_id"]}')

        location_data = {
            'user_id': user_id,
            'user_name': user['full_name'] if user else 'Unknown',
            'latitude': latitude,
            'longitude': longitude,
            'battery_level': battery_level,
            'is_charging': is_charging,
            'timestamp': now_brasilia().isoformat()
        }

        for family in families:
            socketio.emit('location_update', location_data, to=f'family_{family["family_id"]}')

        return jsonify({'success': True, 'message': 'Localização atualizada com sucesso'})
    finally:
        conn.close()

@app.route('/api/location/family', methods=['GET'])
@login_required
def get_family_locations():
    """Retorna localizações de todos os membros da família"""
    user_id = session['user_id']

    conn = get_db_connection()

    family_members = conn.execute(
        '''SELECT DISTINCT u.id, u.username, u.full_name, u.profile_image
           FROM users u
           INNER JOIN family_members fm1 ON u.id = fm1.user_id
           INNER JOIN family_members fm2 ON fm1.family_id = fm2.family_id
           WHERE fm2.user_id = ? AND u.id != ?''',
        (user_id, user_id)
    ).fetchall()

    locations = []
    for member in family_members:
        perm = conn.execute(
            'SELECT * FROM permissions WHERE user_id = ? AND target_user_id = ?',
            (member['id'], user_id)
        ).fetchone()

        if not perm or perm['can_view_location']:
            latest_location = conn.execute(
                '''SELECT * FROM locations 
                   WHERE user_id = ? 
                   ORDER BY timestamp DESC LIMIT 1''',
                (member['id'],)
            ).fetchone()

            if latest_location:
                locations.append({
                    'user': dict(member),
                    'location': dict(latest_location)
                })

    own_location = conn.execute(
        'SELECT * FROM locations WHERE user_id = ? ORDER BY timestamp DESC LIMIT 1',
        (user_id,)
    ).fetchone()

    conn.close()

    return jsonify({
        'family_locations': locations,
        'own_location': dict(own_location) if own_location else None
    })

@app.route('/api/location/user/<int:user_id>', methods=['GET'])
@login_required
def get_user_location(user_id):
    """Retorna a localização de um usuário específico - apenas Admin ou Supervisor"""
    current_user_id = session['user_id']
    user_type = session.get('user_type', 'member')

    conn = get_db_connection()

    # Verificar se é Super Admin
    if user_type == 'super_admin':
        location = conn.execute(
            'SELECT * FROM locations WHERE user_id = ? ORDER BY timestamp DESC LIMIT 1',
            (user_id,)
        ).fetchone()
        conn.close()
        return jsonify({'location': dict(location) if location else None})

    # Verificar se é Admin da mesma família
    is_family_admin = conn.execute(
        '''SELECT 1 FROM family_members fm1
           INNER JOIN family_members fm2 ON fm1.family_id = fm2.family_id
           WHERE fm1.user_id = ? AND fm2.user_id = ? AND fm1.role = 'admin'
           LIMIT 1''',
        (current_user_id, user_id)
    ).fetchone()

    # Verificar se é Supervisor com permissões
    is_supervisor = conn.execute(
        '''SELECT sp.* FROM supervisor_permissions sp
           INNER JOIN family_members fm ON sp.family_member_id = fm.id
           WHERE fm.user_id = ? AND sp.target_user_id = ? AND sp.can_view_location = 1
           LIMIT 1''',
        (current_user_id, user_id)
    ).fetchone()

    # Verificar permissões gerais
    has_permission = conn.execute(
        'SELECT can_view_location FROM permissions WHERE user_id = ? AND target_user_id = ?',
        (current_user_id, user_id)
    ).fetchone()

    if is_family_admin or is_supervisor or (has_permission and has_permission['can_view_location']):
        location = conn.execute(
            'SELECT * FROM locations WHERE user_id = ? ORDER BY timestamp DESC LIMIT 1',
            (user_id,)
        ).fetchone()
        conn.close()
        return jsonify({'location': dict(location) if location else None})

    conn.close()
    return jsonify({
        'success': False, 
        'message': 'Você não tem permissão para visualizar a localização deste usuário'
    }), 403

@app.route('/api/families', methods=['GET', 'POST'])
@login_required
def manage_families():
    """Gerencia famílias do usuário"""
    user_id = session['user_id']
    user_type = session.get('user_type', 'member')

    if request.method == 'POST':
        if user_type not in ['super_admin', 'family_admin']:
            return jsonify({
                'success': False, 
                'message': 'Apenas Administradores de Família podem criar famílias'
            }), 403

        data = request.get_json()
        name = data.get('name')
        description = data.get('description', '')

        if not name:
            return jsonify({'success': False, 'message': 'Nome da família é obrigatório'}), 400

        conn = get_db_connection()
        cursor = conn.execute(
            'INSERT INTO families (name, created_by, description) VALUES (?, ?, ?)',
            (name, user_id, description)
        )
        family_id = cursor.lastrowid

        conn.execute(
            'INSERT INTO family_members (family_id, user_id, role) VALUES (?, ?, ?)',
            (family_id, user_id, 'admin')
        )
        conn.commit()
        conn.close()

        return jsonify({'success': True, 'family_id': family_id})

    conn = get_db_connection()
    families = conn.execute(
        '''SELECT f.*, fm.role, COUNT(DISTINCT fm2.user_id) as member_count
           FROM families f
           INNER JOIN family_members fm ON f.id = fm.family_id
           LEFT JOIN family_members fm2 ON f.id = fm2.family_id
           WHERE fm.user_id = ?
           GROUP BY f.id''',
        (user_id,)
    ).fetchall()
    conn.close()

    return jsonify({'families': [dict(f) for f in families]})

@app.route('/api/families/<int:family_id>/members', methods=['GET', 'POST'])
@login_required
def manage_family_members(family_id):
    """Gerencia membros de uma família"""
    user_id = session['user_id']

    if request.method == 'POST':
        conn = get_db_connection()

        user_role = conn.execute(
            'SELECT role FROM family_members WHERE family_id = ? AND user_id = ?',
            (family_id, user_id)
        ).fetchone()

        if not user_role or user_role['role'] != 'admin':
            conn.close()
            return jsonify({
                'success': False, 
                'message': 'Apenas o admin da família pode adicionar membros'
            }), 403

        data = request.get_json()
        member_email = data.get('email')
        member_role = data.get('role', 'member')

        if not member_email:
            conn.close()
            return jsonify({'success': False, 'message': 'Email do membro é obrigatório'}), 400

        if member_role not in ['member', 'supervisor']:
            conn.close()
            return jsonify({'success': False, 'message': 'Role inválido. Use "member" ou "supervisor"'}), 400

        member = conn.execute(
            'SELECT id FROM users WHERE email = ?',
            (member_email,)
        ).fetchone()

        if not member:
            conn.close()
            return jsonify({'success': False, 'message': 'Usuário não encontrado'}), 404

        try:
            conn.execute(
                'INSERT INTO family_members (family_id, user_id, role) VALUES (?, ?, ?)',
                (family_id, member['id'], member_role)
            )

            conn.execute(
                'INSERT OR REPLACE INTO permissions (user_id, target_user_id, can_view_location, can_view_battery) VALUES (?, ?, 1, 1)',
                (member['id'], user_id)
            )
            conn.execute(
                'INSERT OR REPLACE INTO permissions (user_id, target_user_id, can_view_location, can_view_battery) VALUES (?, ?, 1, 1)',
                (user_id, member['id'])
            )

            conn.commit()
            conn.close()
            return jsonify({'success': True, 'message': 'Membro adicionado com sucesso'})
        except Exception as e:
            conn.close()
            return jsonify({'success': False, 'message': 'Erro ao adicionar membro'}), 500

    conn = get_db_connection()

    user_type = session.get('user_type', 'member')
    if user_type != 'super_admin':
        user_role = conn.execute(
            'SELECT role FROM family_members WHERE family_id = ? AND user_id = ?',
            (family_id, user_id)
        ).fetchone()

        if not user_role or user_role['role'] != 'admin':
            conn.close()
            return jsonify({
                'success': False, 
                'message': 'Apenas o admin da família pode visualizar membros'
            }), 403

    members = conn.execute(
        '''SELECT u.id, u.username, u.full_name, u.email, u.profile_image, fm.role, fm.joined_at
           FROM users u
           INNER JOIN family_members fm ON u.id = fm.user_id
           WHERE fm.family_id = ?''',
        (family_id,)
    ).fetchall()
    conn.close()

    return jsonify({'members': [dict(m) for m in members]})

@app.route('/api/families/<int:family_id>/members/create', methods=['POST'])
@login_required
def create_and_add_family_member(family_id):
    """Cria um novo usuário e adiciona à família - apenas Admin da Família"""
    user_id = session['user_id']

    conn = get_db_connection()

    user_role = conn.execute(
        'SELECT role FROM family_members WHERE family_id = ? AND user_id = ?',
        (family_id, user_id)
    ).fetchone()

    if not user_role or user_role['role'] != 'admin':
        conn.close()
        return jsonify({
            'success': False, 
            'message': 'Apenas o admin da família pode criar e adicionar membros'
        }), 403

    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    full_name = data.get('full_name')
    cpf = data.get('cpf', '')
    birth_date = data.get('birth_date', '')
    member_role = data.get('role', 'member')
    user_category = data.get('user_category', None)
    grant_full_access = data.get('grant_full_access', False)

    if not all([email, password, full_name]):
        conn.close()
        return jsonify({'success': False, 'message': 'Nome completo, email e senha são obrigatórios'}), 400

    username = email.split('@')[0]

    if member_role not in ['member', 'supervisor']:
        conn.close()
        return jsonify({'success': False, 'message': 'Role inválido. Use "member" ou "supervisor"'}), 400

    if user_category and user_category not in ['filho', 'idoso', 'outro']:
        conn.close()
        return jsonify({'success': False, 'message': 'Categoria inválida. Use "filho", "idoso" ou "outro"'}), 400

    existing_user = conn.execute(
        'SELECT id FROM users WHERE email = ?',
        (email,)
    ).fetchone()

    if existing_user:
        conn.close()
        return jsonify({'success': False, 'message': 'Email já cadastrado'}), 400

    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    try:
        # Criar usuário com categoria (se for member)
        cursor = conn.execute(
            '''INSERT INTO users (username, email, password_hash, full_name, cpf, birth_date, user_type, user_category)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
            (username, email, password_hash, full_name, cpf, birth_date, 'member', user_category)
        )
        new_user_id = cursor.lastrowid

        conn.execute(
            'INSERT INTO user_settings (user_id) VALUES (?)',
            (new_user_id,)
        )

        cursor = conn.execute(
            'INSERT INTO family_members (family_id, user_id, role) VALUES (?, ?, ?)',
            (family_id, new_user_id, member_role)
        )
        family_member_id = cursor.lastrowid

        # Permissões básicas entre admin e novo usuário
        conn.execute(
            'INSERT OR REPLACE INTO permissions (user_id, target_user_id, can_view_location, can_view_battery, can_view_history) VALUES (?, ?, 1, 1, 1)',
            (new_user_id, user_id)
        )
        conn.execute(
            'INSERT OR REPLACE INTO permissions (user_id, target_user_id, can_view_location, can_view_battery, can_view_history) VALUES (?, ?, 1, 1, 1)',
            (user_id, new_user_id)
        )

        # Se for supervisor com acesso total, criar permissões completas para TODOS os membros
        if member_role == 'supervisor' and grant_full_access:
            family_members = conn.execute(
                'SELECT user_id FROM family_members WHERE family_id = ? AND user_id != ?',
                (family_id, new_user_id)
            ).fetchall()

            for member in family_members:
                target_user_id = member['user_id']

                # Criar permissões completas do supervisor para cada membro na tabela supervisor_permissions
                # Esta tabela tem TODOS os campos necessários para supervisores
                conn.execute(
                    '''INSERT INTO supervisor_permissions 
                       (family_member_id, target_user_id, can_view_location, can_view_battery, 
                        can_view_history, can_receive_alerts, can_view_messages, can_send_messages)
                       VALUES (?, ?, 1, 1, 1, 1, 1, 1)''',
                    (family_member_id, target_user_id)
                )

                # Também criar permissões na tabela permissions (para compatibilidade com código legado)
                # ATENÇÃO: esta tabela só tem: can_view_location, can_view_battery, can_view_history, can_send_messages
                conn.execute(
                    '''INSERT OR REPLACE INTO permissions 
                       (user_id, target_user_id, can_view_location, can_view_battery, 
                        can_view_history, can_send_messages, privacy_mode)
                       VALUES (?, ?, 1, 1, 1, 1, 'full')''',
                    (new_user_id, target_user_id)
                )

        conn.commit()
        conn.close()

        role_text = 'Supervisor com acesso total' if member_role == 'supervisor' else 'Usuário Comum'
        category_text = f' ({user_category})' if user_category else ''

        return jsonify({
            'success': True, 
            'message': f'Usuário criado como {role_text}{category_text} e adicionado à família!',
            'user_id': new_user_id
        })
    except Exception as e:
        conn.close()
        return jsonify({'success': False, 'message': f'Erro ao criar usuário: {str(e)}'}), 500

@app.route('/api/families/<int:family_id>/permissions', methods=['GET'])
@login_required
def get_family_permissions(family_id):
    """Lista todas as permissões dos membros de uma família - apenas Admin da Família ou Super Admin"""
    user_id = session['user_id']
    user_type = session.get('user_type', 'member')

    conn = get_db_connection()

    if user_type != 'super_admin':
        user_role = conn.execute(
            'SELECT role FROM family_members WHERE family_id = ? AND user_id = ?',
            (family_id, user_id)
        ).fetchone()

        if not user_role or user_role['role'] != 'admin':
            conn.close()
            return jsonify({
                'success': False, 
                'message': 'Apenas o admin da família pode visualizar permissões'
            }), 403

    members = conn.execute(
        '''SELECT u.id, u.username, u.full_name, u.email, fm.role
           FROM users u
           INNER JOIN family_members fm ON u.id = fm.user_id
           WHERE fm.family_id = ?''',
        (family_id,)
    ).fetchall()

    permissions_data = []
    for member in members:
        permissions = conn.execute(
            '''SELECT target_user_id, can_view_location, can_view_battery, 
                      can_view_history, can_send_messages, privacy_mode
               FROM permissions 
               WHERE user_id = ? AND target_user_id IN (
                   SELECT user_id FROM family_members WHERE family_id = ?
               )''',
            (member['id'], family_id)
        ).fetchall()

        permissions_data.append({
            'user_id': member['id'],
            'username': member['username'],
            'full_name': member['full_name'],
            'email': member['email'],
            'role': member['role'],
            'permissions': [dict(p) for p in permissions]
        })

    conn.close()
    return jsonify({'permissions': permissions_data})

@app.route('/api/families/<int:family_id>/permissions/update', methods=['POST'])
@login_required
def update_member_permissions(family_id):
    """Atualiza permissões de um membro - apenas Admin da Família ou Super Admin"""
    user_id = session['user_id']
    user_type = session.get('user_type', 'member')

    conn = get_db_connection()

    if user_type != 'super_admin':
        user_role = conn.execute(
            'SELECT role FROM family_members WHERE family_id = ? AND user_id = ?',
            (family_id, user_id)
        ).fetchone()

        if not user_role or user_role['role'] != 'admin':
            conn.close()
            return jsonify({
                'success': False, 
                'message': 'Apenas o admin da família pode modificar permissões'
            }), 403

    data = request.get_json()
    member_id = data.get('member_id')
    target_id = data.get('target_id')
    can_view_location = data.get('can_view_location', 0)
    can_view_battery = data.get('can_view_battery', 0)
    can_view_history = data.get('can_view_history', 0)

    if not member_id or not target_id:
        conn.close()
        return jsonify({'success': False, 'message': 'IDs dos membros são obrigatórios'}), 400

    is_member = conn.execute(
        'SELECT 1 FROM family_members WHERE family_id = ? AND user_id = ?',
        (family_id, member_id)
    ).fetchone()

    is_target = conn.execute(
        'SELECT 1 FROM family_members WHERE family_id = ? AND user_id = ?',
        (family_id, target_id)
    ).fetchone()

    if not is_member or not is_target:
        conn.close()
        return jsonify({'success': False, 'message': 'Usuários não pertencem a esta família'}), 404

    try:
        conn.execute(
            '''INSERT OR REPLACE INTO permissions 
               (user_id, target_user_id, can_view_location, can_view_battery, can_view_history, updated_at)
               VALUES (?, ?, ?, ?, ?, ?)''',
            (member_id, target_id, can_view_location, can_view_battery, can_view_history, now_brasilia())
        )
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Permissões atualizadas com sucesso'})
    except Exception as e:
        conn.close()
        return jsonify({'success': False, 'message': f'Erro ao atualizar permissões: {str(e)}'}), 500

@app.route('/api/families/<int:family_id>/permissions/grant-all', methods=['POST'])
@login_required
def grant_all_permissions(family_id):
    """Concede todas as permissões a um membro para visualizar todos os outros - apenas Admin da Família ou Super Admin"""
    user_id = session['user_id']
    user_type = session.get('user_type', 'member')

    conn = get_db_connection()

    if user_type != 'super_admin':
        user_role = conn.execute(
            'SELECT role FROM family_members WHERE family_id = ? AND user_id = ?',
            (family_id, user_id)
        ).fetchone()

        if not user_role or user_role['role'] != 'admin':
            conn.close()
            return jsonify({
                'success': False, 
                'message': 'Apenas o admin da família pode conceder permissões'
            }), 403

    data = request.get_json()
    member_id = data.get('member_id')

    if not member_id:
        conn.close()
        return jsonify({'success': False, 'message': 'ID do membro é obrigatório'}), 400

    is_member = conn.execute(
        'SELECT 1 FROM family_members WHERE family_id = ? AND user_id = ?',
        (family_id, member_id)
    ).fetchone()

    if not is_member:
        conn.close()
        return jsonify({'success': False, 'message': 'Usuário não pertence a esta família'}), 404

    try:
        all_members = conn.execute(
            'SELECT user_id FROM family_members WHERE family_id = ? AND user_id != ?',
            (family_id, member_id)
        ).fetchall()

        for target in all_members:
            conn.execute(
                '''INSERT OR REPLACE INTO permissions 
                   (user_id, target_user_id, can_view_location, can_view_battery, can_view_history, updated_at)
                   VALUES (?, ?, 1, 1, 1, ?)''',
                (member_id, target['user_id'], now_brasilia())
            )

        conn.commit()
        conn.close()
        return jsonify({
            'success': True, 
            'message': f'Permissões completas concedidas! O membro agora pode visualizar todos os {len(all_members)} membros da família.'
        })
    except Exception as e:
        conn.close()
        return jsonify({'success': False, 'message': f'Erro ao conceder permissões: {str(e)}'}), 500

@app.route('/api/families/<int:family_id>/permissions/revoke-all', methods=['POST'])
@login_required
def revoke_all_permissions(family_id):
    """Remove todas as permissões de um membro - apenas Admin da Família ou Super Admin"""
    user_id = session['user_id']
    user_type = session.get('user_type', 'member')

    conn = get_db_connection()

    if user_type != 'super_admin':
        user_role = conn.execute(
            'SELECT role FROM family_members WHERE family_id = ? AND user_id = ?',
            (family_id, user_id)
        ).fetchone()

        if not user_role or user_role['role'] != 'admin':
            conn.close()
            return jsonify({
                'success': False, 
                'message': 'Apenas o admin da família pode revogar permissões'
            }), 403

    data = request.get_json()
    member_id = data.get('member_id')

    if not member_id:
        conn.close()
        return jsonify({'success': False, 'message': 'ID do membro é obrigatório'}), 400

    is_member = conn.execute(
        'SELECT 1 FROM family_members WHERE family_id = ? AND user_id = ?',
        (family_id, member_id)
    ).fetchone()

    if not is_member:
        conn.close()
        return jsonify({'success': False, 'message': 'Usuário não pertence a esta família'}), 404

    try:
        all_members = conn.execute(
            'SELECT user_id FROM family_members WHERE family_id = ? AND user_id != ?',
            (family_id, member_id)
        ).fetchall()

        for target in all_members:
            conn.execute(
                '''INSERT OR REPLACE INTO permissions 
                   (user_id, target_user_id, can_view_location, can_view_battery, can_view_history, updated_at)
                   VALUES (?, ?, 0, 0, 0, ?)''',
                (member_id, target['user_id'], now_brasilia())
            )

        conn.commit()
        conn.close()
        return jsonify({
            'success': True, 
            'message': 'Todas as permissões foram removidas!'
        })
    except Exception as e:
        conn.close()
        return jsonify({'success': False, 'message': f'Erro ao revogar permissões: {str(e)}'}), 500

@app.route('/api/admin/database-status', methods=['GET'])
@super_admin_required
def database_status():
    """Verifica status do SQLiteCloud e sistema de ping"""
    
    # Status do Cloud (única fonte de dados)
    cloud_status = {
        'connected': False,
        'users_count': 0,
        'families_count': 0,
        'locations_count': 0
    }
    
    try:
        conn = get_db_connection()
        cloud_status['connected'] = True
        
        cursor = conn.cursor()
        
        cursor.execute('SELECT COUNT(*) FROM users')
        result = cursor.fetchone()
        cloud_status['users_count'] = result[0] if result else 0
        
        cursor.execute('SELECT COUNT(*) FROM families')
        result = cursor.fetchone()
        cloud_status['families_count'] = result[0] if result else 0
        
        cursor.execute('SELECT COUNT(*) FROM locations')
        result = cursor.fetchone()
        cloud_status['locations_count'] = result[0] if result else 0
        
    except Exception as e:
        cloud_status['error'] = str(e)
    
    # Status do Ping
    ping_status = get_ping_status()
    
    return jsonify({
        'success': True,
        'cloud': cloud_status,
        'ping': ping_status,
        'mode': 'SQLiteCloud Only'
    })

@app.route('/api/admin/ping-status', methods=['GET'])
@super_admin_required
def ping_status():
    """Retorna status do sistema de ping"""
    status = get_ping_status()
    return jsonify({
        'success': True,
        'ping': status
    })

@app.route('/api/messages', methods=['GET', 'POST'])
@login_required
def manage_messages():
    """Gerencia mensagens"""
    user_id = session['user_id']

    if request.method == 'POST':
        data = request.get_json()
        family_id = data.get('family_id')
        message_text = data.get('message')
        message_type = data.get('type', 'normal')

        if not all([family_id, message_text]):
            return jsonify({'success': False, 'message': 'Família e mensagem são obrigatórias'}), 400

        conn = get_db_connection()
        conn.execute(
            'INSERT INTO messages (family_id, sender_id, message_text, message_type, sent_at) VALUES (?, ?, ?, ?, ?)',
            (family_id, user_id, message_text, message_type, now_brasilia())
        )

        user = conn.execute('SELECT full_name FROM users WHERE id = ?', (user_id,)).fetchone()
        conn.commit()
        conn.close()

        socketio.emit('new_message', {
            'family_id': family_id,
            'sender_id': user_id,
            'sender_name': user['full_name'] if user else 'Unknown',
            'message_text': message_text,
            'message_type': message_type,
            'timestamp': now_brasilia().isoformat()
        }, to=f'family_{family_id}')

        return jsonify({'success': True, 'message': 'Mensagem enviada'})

    family_id = request.args.get('family_id')
    if not family_id:
        return jsonify({'success': False, 'message': 'ID da família é obrigatório'}), 400

    conn = get_db_connection()
    messages = conn.execute(
        '''SELECT m.*, u.username, u.full_name, u.profile_image
           FROM messages m
           INNER JOIN users u ON m.sender_id = u.id
           WHERE m.family_id = ?
           ORDER BY m.sent_at DESC
           LIMIT 100''',
        (family_id,)
    ).fetchall()
    conn.close()

    return jsonify({'messages': [dict(m) for m in messages]})

@app.route('/api/panic', methods=['POST'])
@login_required
def panic_button():
    """Botão de pânico - envia alerta de emergência"""
    data = request.get_json()
    user_id = session['user_id']

    latitude = data.get('latitude')
    longitude = data.get('longitude')

    if not latitude or not longitude:
        return jsonify({'success': False, 'message': 'Localização é obrigatória'}), 400

    conn = get_db_connection()

    cursor = conn.execute(
        'INSERT INTO panic_alerts (user_id, latitude, longitude, status, timestamp) VALUES (?, ?, ?, ?, ?)',
        (user_id, latitude, longitude, 'active', now_brasilia())
    )
    panic_id = cursor.lastrowid

    conn.execute(
        '''INSERT INTO alerts (user_id, alert_type, alert_message, latitude, longitude, severity, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?)''',
        (user_id, 'panic', '🚨 ALERTA DE EMERGÊNCIA! Um membro precisa de ajuda!', latitude, longitude, 'critical', now_brasilia())
    )

    family_ids = conn.execute(
        'SELECT DISTINCT family_id FROM family_members WHERE user_id = ?',
        (user_id,)
    ).fetchall()

    for family in family_ids:
        conn.execute(
            '''INSERT INTO messages (family_id, sender_id, message_text, message_type, sent_at)
               VALUES (?, ?, ?, ?, ?)''',
            (family['family_id'], user_id, f'🚨 EMERGÊNCIA! Localização: {latitude}, {longitude}', 'panic', now_brasilia())
        )

    user = conn.execute('SELECT full_name FROM users WHERE id = ?', (user_id,)).fetchone()

    conn.commit()
    conn.close()

    alert_data = {
        'user_id': user_id,
        'user_name': user['full_name'] if user else 'Unknown',
        'latitude': latitude,
        'longitude': longitude,
        'timestamp': now_brasilia().isoformat()
    }

    for family in family_ids:
        socketio.emit('panic_alert', alert_data, to=f'family_{family["family_id"]}')

    return jsonify({
        'success': True,
        'panic_id': panic_id,
        'message': 'Alerta de emergência enviado para todos os membros da família!'
    })

@app.route('/api/alerts', methods=['GET'])
@login_required
def get_alerts():
    """Retorna alertas do usuário"""
    user_id = session['user_id']

    conn = get_db_connection()
    alerts = conn.execute(
        'SELECT * FROM alerts WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
        (user_id,)
    ).fetchall()
    conn.close()

    return jsonify({'alerts': [dict(a) for a in alerts]})

@app.route('/api/settings', methods=['GET', 'PUT'])
@login_required
def user_settings():
    """Gerencia configurações do usuário"""
    user_id = session['user_id']

    if request.method == 'PUT':
        data = request.get_json()

        conn = get_db_connection()
        conn.execute(
            '''UPDATE user_settings SET
               location_update_interval = ?,
               battery_alert_threshold = ?,
               privacy_mode = ?,
               share_battery_status = ?,
               share_location = ?,
               notification_enabled = ?,
               updated_at = ?
               WHERE user_id = ?''',
            (
                data.get('location_update_interval', 5),
                data.get('battery_alert_threshold', 20),
                data.get('privacy_mode', 'full'),
                data.get('share_battery_status', 1),
                data.get('share_location', 1),
                data.get('notification_enabled', 1),
                now_brasilia(),
                user_id
            )
        )
        conn.commit()
        conn.close()

        return jsonify({'success': True, 'message': 'Configurações atualizadas'})

    conn = get_db_connection()
    settings = conn.execute(
        'SELECT * FROM user_settings WHERE user_id = ?',
        (user_id,)
    ).fetchone()
    conn.close()

    return jsonify({'settings': dict(settings) if settings else None})

@app.route('/api/admin/users', methods=['GET'])
@super_admin_required
def list_all_users():
    """Lista todos os usuários - apenas Super Admin"""
    conn = get_db_connection()
    users = conn.execute(
        '''SELECT id, username, email, full_name, user_type, created_at, last_seen, is_active
           FROM users
           ORDER BY created_at DESC'''
    ).fetchall()
    conn.close()

    return jsonify({'users': [dict(u) for u in users]})

@app.route('/api/admin/promote-family-admin', methods=['POST'])
@super_admin_required
def promote_to_family_admin():
    """Promove um usuário para Admin de Família - apenas Super Admin"""
    data = request.get_json()
    user_id = data.get('user_id')

    if not user_id:
        return jsonify({'success': False, 'message': 'ID do usuário é obrigatório'}), 400

    conn = get_db_connection()
    try:
        user = conn.execute(
            'SELECT * FROM users WHERE id = ?', (user_id,)
        ).fetchone()

        if not user:
            return jsonify({'success': False, 'message': 'Usuário não encontrado'}), 404

        if user['user_type'] == 'super_admin':
            return jsonify({'success': False, 'message': 'Não é possível modificar um Super Admin'}), 400

        conn.execute(
            'UPDATE users SET user_type = ?, updated_at = ? WHERE id = ?',
            ('family_admin', now_brasilia(), user_id)
        )
        conn.commit()

        return jsonify({
            'success': True,
            'message': f'{user["full_name"]} foi promovido para Admin de Família!'
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'Erro ao promover usuário: {str(e)}'}), 500
    finally:
        conn.close()

@app.route('/api/admin/demote-user', methods=['POST'])
@super_admin_required
def demote_user():
    """Rebaixa um Admin de Família para Membro - apenas Super Admin"""
    data = request.get_json()
    user_id = data.get('user_id')

    if not user_id:
        return jsonify({'success': False, 'message': 'ID do usuário é obrigatório'}), 400

    conn = get_db_connection()
    try:
        user = conn.execute(
            'SELECT * FROM users WHERE id = ?', (user_id,)
        ).fetchone()

        if not user:
            return jsonify({'success': False, 'message': 'Usuário não encontrado'}), 404

        if user['user_type'] == 'super_admin':
            return jsonify({'success': False, 'message': 'Não é possível modificar um Super Admin'}), 400

        conn.execute(
            'UPDATE users SET user_type = ?, updated_at = ? WHERE id = ?',
            ('member', now_brasilia(), user_id)
        )
        conn.commit()

        return jsonify({
            'success': True,
            'message': f'{user["full_name"]} foi rebaixado para Membro!'
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'Erro ao rebaixar usuário: {str(e)}'}), 500
    finally:
        conn.close()

@app.route('/api/admin/family-admins', methods=['GET'])
@super_admin_required
def list_family_admins():
    """Lista todos os Admins de Família - apenas Super Admin"""
    conn = get_db_connection()
    admins = conn.execute(
        '''SELECT id, username, email, full_name, created_at, last_seen
           FROM users
           WHERE user_type = 'family_admin'
           ORDER BY created_at DESC'''
    ).fetchall()
    conn.close()

    return jsonify({'family_admins': [dict(a) for a in admins]})

@app.route('/api/admin/all-locations', methods=['GET'])
@super_admin_required
def get_all_user_locations():
    """Obtém localizações de TODOS os usuários - apenas Super Admin"""
    conn = get_db_connection()

    # Buscar todos os usuários com suas últimas localizações
    users = conn.execute(
        '''SELECT u.id, u.username, u.full_name, u.email, u.user_type, u.user_category,
                  u.last_seen, u.is_active
           FROM users u
           WHERE u.user_type != 'super_admin'
           ORDER BY u.full_name ASC'''
    ).fetchall()

    all_locations = []

    for user in users:
        # Buscar última localização de cada usuário
        location = conn.execute(
            '''SELECT * FROM locations 
               WHERE user_id = ? 
               ORDER BY timestamp DESC LIMIT 1''',
            (user['id'],)
        ).fetchone()

        # Buscar família do usuário
        families = conn.execute(
            '''SELECT f.id, f.name 
               FROM families f
               INNER JOIN family_members fm ON f.id = fm.family_id
               WHERE fm.user_id = ?''',
            (user['id'],)
        ).fetchall()

        all_locations.append({
            'user': dict(user),
            'location': dict(location) if location else None,
            'families': [dict(f) for f in families]
        })

    conn.close()

    return jsonify({
        'success': True,
        'total_users': len(all_locations),
        'users_with_location': sum(1 for u in all_locations if u['location']),
        'locations': all_locations
    })

@app.route('/api/admin/user/<int:user_id>/details', methods=['GET'])
@super_admin_required
def get_user_full_details(user_id):
    """Obtém todos os detalhes de um usuário específico - apenas Super Admin"""
    conn = get_db_connection()

    # Dados do usuário
    user = conn.execute(
        'SELECT * FROM users WHERE id = ?',
        (user_id,)
    ).fetchone()

    if not user:
        conn.close()
        return jsonify({'success': False, 'message': 'Usuário não encontrado'}), 404

    # Última localização
    location = conn.execute(
        'SELECT * FROM locations WHERE user_id = ? ORDER BY timestamp DESC LIMIT 1',
        (user_id,)
    ).fetchone()

    # Histórico de localizações (últimas 50)
    location_history = conn.execute(
        'SELECT * FROM locations WHERE user_id = ? ORDER BY timestamp DESC LIMIT 50',
        (user_id,)
    ).fetchall()

    # Alertas recentes
    alerts = conn.execute(
        'SELECT * FROM alerts WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
        (user_id,)
    ).fetchall()

    # Famílias
    families = conn.execute(
        '''SELECT f.*, fm.role 
           FROM families f
           INNER JOIN family_members fm ON f.id = fm.family_id
           WHERE fm.user_id = ?''',
        (user_id,)
    ).fetchall()

    # Configurações
    settings = conn.execute(
        'SELECT * FROM user_settings WHERE user_id = ?',
        (user_id,)
    ).fetchone()

    conn.close()

    return jsonify({
        'success': True,
        'user': dict(user),
        'location': dict(location) if location else None,
        'location_history': [dict(loc) for loc in location_history],
        'alerts': [dict(alert) for alert in alerts],
        'families': [dict(f) for f in families],
        'settings': dict(settings) if settings else None
    })

@app.route('/api/admin/create-family-admin', methods=['POST'])
@super_admin_required
def create_family_admin():
    """Cria um novo Family Admin com sua família - apenas Super Admin"""
    data = request.get_json()

    email = data.get('email')
    password = data.get('password')
    full_name = data.get('full_name')
    cpf = data.get('cpf', '')
    birth_date = data.get('birth_date', '')
    family_name = data.get('family_name')
    family_description = data.get('family_description', '')

    if not all([email, password, full_name, family_name]):
        return jsonify({
            'success': False, 
            'message': 'Email, senha, nome completo e nome da família são obrigatórios'
        }), 400

    username = email.split('@')[0]

    conn = get_db_connection()

    try:
        existing_user = conn.execute(
            'SELECT id FROM users WHERE email = ?',
            (email,)
        ).fetchone()

        if existing_user:
            conn.close()
            return jsonify({
                'success': False, 
                'message': 'Email já cadastrado'
            }), 400

        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        cursor = conn.execute(
            '''INSERT INTO users (username, email, password_hash, full_name, cpf, birth_date, user_type)
               VALUES (?, ?, ?, ?, ?, ?, ?)''',
            (username, email, password_hash, full_name, cpf, birth_date, 'family_admin')
        )
        new_user_id = cursor.lastrowid

        conn.execute(
            'INSERT INTO user_settings (user_id) VALUES (?)',
            (new_user_id,)
        )

        cursor = conn.execute(
            'INSERT INTO families (name, created_by, description) VALUES (?, ?, ?)',
            (family_name, new_user_id, family_description)
        )
        family_id = cursor.lastrowid

        conn.execute(
            'INSERT INTO family_members (family_id, user_id, role) VALUES (?, ?, ?)',
            (family_id, new_user_id, 'admin')
        )

        conn.commit()
        conn.close()

        return jsonify({
            'success': True,
            'message': f'Admin de Família criado com sucesso! Família "{family_name}" criada.',
            'user_id': new_user_id,
            'family_id': family_id
        })

    except Exception as e:
        conn.close()
        return jsonify({
            'success': False, 
            'message': f'Erro ao criar Admin de Família: {str(e)}'
        }), 500

@app.route('/api/safe-zones', methods=['GET', 'POST'])
@login_required
def manage_safe_zones():
    user_id = session['user_id']

    if request.method == 'GET':
        try:
            conn = get_db_connection()
            zones = conn.execute(
                'SELECT * FROM safe_zones WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC',
                (user_id,)
            ).fetchall()
            conn.close()

            zones_list = [dict(zone) for zone in zones]
            print(f"Zonas carregadas para usuário {user_id}: {len(zones_list)} zonas")
            
            return jsonify({
                'success': True,
                'zones': zones_list,
                'count': len(zones_list)
            })
        except Exception as e:
            print(f"Erro ao carregar zonas: {e}")
            return jsonify({
                'success': False,
                'zones': [],
                'count': 0,
                'error': str(e)
            }), 500

    elif request.method == 'POST':
        data = request.get_json()
        zone_name = data.get('zone_name')
        latitude = data.get('latitude')
        longitude = data.get('longitude')
        radius = data.get('radius', 100)
        notify_on_enter = data.get('notify_on_enter', 0)
        notify_on_exit = data.get('notify_on_exit', 1)

        if not zone_name or not latitude or not longitude:
            return jsonify({'success': False, 'message': 'Dados incompletos'}), 400

        conn = get_db_connection()
        conn.execute(
            '''INSERT INTO safe_zones 
               (user_id, zone_name, latitude, longitude, radius, notify_on_enter, notify_on_exit, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
            (user_id, zone_name, latitude, longitude, radius, notify_on_enter, notify_on_exit, now_brasilia())
        )
        conn.commit()
        conn.close()

        return jsonify({'success': True, 'message': 'Zona segura criada com sucesso'})

@app.route('/api/safe-zones/<int:zone_id>', methods=['DELETE'])
@login_required
def delete_safe_zone(zone_id):
    user_id = session['user_id']

    conn = get_db_connection()
    conn.execute(
        'UPDATE safe_zones SET is_active = 0, updated_at = ? WHERE id = ? AND user_id = ?',
        (now_brasilia(), zone_id, user_id)
    )
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'message': 'Zona removida com sucesso'})

@app.route('/api/geofence-event', methods=['POST'])
@login_required
def geofence_event():
    data = request.get_json()
    user_id = session['user_id']
    zone_id = data.get('zone_id')
    action = data.get('action')

    conn = get_db_connection()
    zone = conn.execute('SELECT * FROM safe_zones WHERE id = ?', (zone_id,)).fetchone()
    user = conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()

    if zone and user:
        action_text = 'entrou em' if action == 'enter' else 'saiu de'
        alert_message = f'{user["full_name"]} {action_text} {zone["zone_name"]}'

        conn.execute(
            '''INSERT INTO alerts (user_id, alert_type, alert_message, latitude, longitude, severity, timestamp)
               VALUES (?, ?, ?, ?, ?, ?, ?)''',
            (user_id, 'geofence', alert_message, zone['latitude'], zone['longitude'], 'info', now_brasilia())
        )
        conn.commit()

        socketio.emit('geofence_alert', {
            'user_id': user_id,
            'user_name': user['full_name'],
            'zone_name': zone['zone_name'],
            'action': action,
            'latitude': zone['latitude'],
            'longitude': zone['longitude'],
            'timestamp': now_brasilia().isoformat()
        }, to=f'user_{user_id}')

    conn.close()
    return jsonify({'success': True})

@app.route('/api/location/history/<int:user_id>')
@login_required
def location_history(user_id):
    start_date_str = request.args.get('start')
    end_date_str = request.args.get('end')

    try:
        if start_date_str:
            start_date = datetime.fromisoformat(start_date_str)
        else:
            start_date = datetime.now(BRASILIA_TZ) - timedelta(days=1)
        
        if end_date_str:
            end_date = datetime.fromisoformat(end_date_str)
        else:
            end_date = datetime.now(BRASILIA_TZ)

        # Ensure dates are timezone-aware and in Brasília time
        start_date = start_date.astimezone(BRASILIA_TZ)
        end_date = end_date.astimezone(BRASILIA_TZ)

    except ValueError:
        return jsonify({'success': False, 'message': 'Formato de data inválido. Use ISO 8601.'}), 400

    conn = get_db_connection()
    locations = conn.execute(
        '''SELECT * FROM locations 
           WHERE user_id = ? AND timestamp BETWEEN ? AND ?
           ORDER BY timestamp ASC''',
        (user_id, start_date.isoformat(), end_date.isoformat())
    ).fetchall()
    conn.close()

    return jsonify({
        'success': True,
        'locations': [dict(loc) for loc in locations]
    })

@app.route('/api/dashboard/stats')
@login_required
def dashboard_stats():
    user_id = session['user_id']

    conn = get_db_connection()

    families = conn.execute(
        '''SELECT f.* FROM families f
           JOIN family_members fm ON f.id = fm.family_id
           WHERE fm.user_id = ?''',
        (user_id,)
    ).fetchall()

    if not families:
        conn.close()
        return jsonify({'success': False, 'message': 'Usuário não pertence a nenhuma família'}), 400

    family_ids = [f['id'] for f in families]

    # Construir a consulta de forma segura com placeholders
    placeholders = ','.join('?' * len(family_ids))

    members = conn.execute(
        f'SELECT COUNT(DISTINCT user_id) as total FROM family_members WHERE family_id IN ({placeholders})',
        family_ids
    ).fetchone()

    active_members = conn.execute(
        f'SELECT COUNT(DISTINCT fm.user_id) as active FROM family_members fm JOIN users u ON fm.user_id = u.id WHERE fm.family_id IN ({placeholders}) AND datetime(u.last_seen) > datetime(?, \'-15 minutes\')',
        (*family_ids, now_brasilia().isoformat(), *family_ids) # Order matters: family_ids first, then the datetime string
    ).fetchone()


    total_alerts = conn.execute(
        f'SELECT COUNT(*) as total FROM alerts a JOIN family_members fm ON a.user_id = fm.user_id WHERE fm.family_id IN ({placeholders}) AND date(a.created_at) = date(\'now\')',
        family_ids
    ).fetchone()

    avg_battery = conn.execute(
        f'''SELECT AVG(battery_level) as avg FROM (
               SELECT DISTINCT ON (user_id) battery_level 
               FROM locations 
               WHERE user_id IN (
                   SELECT user_id FROM family_members 
                   WHERE family_id IN ({placeholders})
               )
               ORDER BY user_id, timestamp DESC
           )''',
        family_ids
    ).fetchone()

    battery_stats = conn.execute(
        '''SELECT strftime('%H:%M', timestamp) as time, battery_level as level
           FROM locations
           WHERE user_id = ? AND date(timestamp) = date('now')
           ORDER BY timestamp DESC LIMIT 20''',
        (user_id,)
    ).fetchall()

    activity_stats = conn.execute(
        f'''SELECT u.full_name as member_name, COUNT(l.id) as updates_count
           FROM users u
           JOIN family_members fm ON u.id = fm.user_id
           LEFT JOIN locations l ON u.id = l.user_id AND date(l.timestamp) = date('now')
           WHERE fm.family_id IN ({placeholders})
           GROUP BY u.id''',
        family_ids
    ).fetchall()

    location_history = conn.execute(
        f'''SELECT strftime('%H', timestamp) as hour, COUNT(*) as count
           FROM locations
           WHERE user_id IN (
               SELECT user_id FROM family_members 
               WHERE family_id IN ({placeholders})
           )
           AND date(timestamp) = date('now')
           GROUP BY hour
           ORDER BY hour''',
        family_ids
    ).fetchall()

    conn.close()

    return jsonify({
        'success': True,
        'summary': {
            'total_members': members['total'] if members else 0,
            'active_members': active_members['active'] if active_members else 0,
            'total_alerts': total_alerts['total'] if total_alerts else 0,
            'avg_battery': round(avg_battery['avg'], 1) if avg_battery and avg_battery['avg'] else 0
        },
        'battery_stats': [dict(row) for row in battery_stats],
        'activity_stats': [dict(row) for row in activity_stats],
        'location_history': [dict(row) for row in location_history]
    })

@app.route('/api/export/locations-csv')
@login_required
def export_locations_csv():
    user_id = session['user_id']

    conn = get_db_connection()
    locations = conn.execute(
        '''SELECT l.*, u.full_name 
           FROM locations l
           JOIN users u ON l.user_id = u.id
           WHERE l.user_id = ?
           ORDER BY l.timestamp DESC LIMIT 1000''',
        (user_id,)
    ).fetchall()
    conn.close()

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(['Nome', 'Data/Hora', 'Latitude', 'Longitude', 'Bateria', 'Velocidade', 'Precisão'])

    for loc in locations:
        writer.writerow([
            loc['full_name'],
            loc['timestamp'],
            loc['latitude'],
            loc['longitude'],
            f"{loc['battery_level']}%" if loc['battery_level'] else 'N/A',
            f"{round(loc['speed'] * 3.6, 1)} km/h" if loc['speed'] else 'N/A',
            f"{loc['accuracy']}m" if loc['accuracy'] else 'N/A'
        ])

    output.seek(0)
    return send_file(
        io.BytesIO(output.getvalue().encode('utf-8')),
        mimetype='text/csv',
        as_attachment=True,
        download_name=f'localizacoes_{datetime.now().strftime("%Y%m%d")}.csv'
    )

@socketio.on('connect')
def handle_connect():
    if 'user_id' in session:
        join_room(f'user_{session["user_id"]}')
        emit('connected', {'status': 'success'})

@socketio.on('disconnect')
def handle_disconnect():
    if 'user_id' in session:
        leave_room(f'user_{session["user_id"]}')

@socketio.on('update_location')
def handle_location_update(data):
    if 'user_id' not in session:
        emit('error', {'message': 'Não autenticado'})
        return

    user_id = session['user_id']
    
    # Validar dados recebidos
    if not data.get('latitude') or not data.get('longitude'):
        emit('error', {'message': 'Dados de localização inválidos'})
        return

    conn = get_db_connection()
    conn.execute(
        '''INSERT INTO locations 
           (user_id, latitude, longitude, accuracy, altitude, speed, heading, battery_level, is_charging, status_message, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        (user_id, data.get('latitude'), data.get('longitude'), data.get('accuracy'),
         data.get('altitude'), data.get('speed'), data.get('heading'),
         data.get('battery_level'), data.get('is_charging', 0), data.get('status_message', ''), now_brasilia())
    )

    user = conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()

    families = conn.execute(
        '''SELECT family_id FROM family_members WHERE user_id = ?''',
        (user_id,)
    ).fetchall()

    conn.commit()
    conn.close()

    location_data = {
        'user_id': user_id,
        'user_name': user['full_name'] if user else 'Unknown',
        'latitude': data.get('latitude'),
        'longitude': data.get('longitude'),
        'battery_level': data.get('battery_level'),
        'is_charging': data.get('is_charging', 0),
        'timestamp': now_brasilia().isoformat()
    }

    for family in families:
        emit('location_update', location_data, to=f'family_{family["family_id"]}', include_self=False)

@socketio.on('send_message')
def handle_send_message(data):
    if 'user_id' not in session:
        return

    user_id = session['user_id']
    family_id = data.get('family_id')
    message_text = data.get('message_text')

    conn = get_db_connection()
    conn.execute(
        '''INSERT INTO messages (family_id, sender_id, message_text, sent_at)
           VALUES (?, ?, ?, ?)''',
        (family_id, user_id, message_text, now_brasilia())
    )

    user = conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    conn.commit()
    conn.close()

    message_data = {
        'family_id': family_id,
        'sender_id': user_id,
        'sender_name': user['full_name'] if user else 'Unknown',
        'message_text': message_text,
        'timestamp': now_brasilia().isoformat()
    }

    emit('new_message', message_data, to=f'family_{family_id}', include_self=True)

@socketio.on('panic_alert')
def handle_panic_alert(data):
    if 'user_id' not in session:
        return

    user_id = session['user_id']

    conn = get_db_connection()
    conn.execute(
        '''INSERT INTO panic_alerts (user_id, latitude, longitude, status, timestamp)
           VALUES (?, ?, ?, ?, ?)''',
        (user_id, data.get('latitude'), data.get('longitude'), 'active', now_brasilia())
    )

    user = conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()

    families = conn.execute(
        '''SELECT family_id FROM family_members WHERE user_id = ?''',
        (user_id,)
    ).fetchall()

    conn.commit()
    conn.close()

    alert_data = {
        'user_id': user_id,
        'user_name': user['full_name'] if user else 'Unknown',
        'latitude': data.get('latitude'),
        'longitude': data.get('longitude'),
        'timestamp': now_brasilia().isoformat()
    }

    for family in families:
        emit('panic_alert', alert_data, to=f'family_{family["family_id"]}')

@socketio.on('request_camera')
def handle_camera_request(data):
    """Admin solicita acesso à câmera de um usuário"""
    if 'user_id' not in session:
        emit('camera_error', {'message': 'Não autenticado'})
        return
    
    requester_id = session['user_id']
    requester_type = session.get('user_type', 'member')
    target_user_id = data.get('target_user_id')
    
    if not target_user_id:
        emit('camera_error', {'message': 'ID de usuário alvo não fornecido'})
        return
    
    conn = get_db_connection()
    
    has_permission = False
    if requester_type == 'super_admin':
        has_permission = True
    elif requester_type == 'family_admin':
        is_same_family = conn.execute('''
            SELECT 1 FROM family_members fm1
            INNER JOIN family_members fm2 ON fm1.family_id = fm2.family_id
            WHERE fm1.user_id = ? AND fm2.user_id = ? AND fm1.role = 'admin'
            LIMIT 1
        ''', (requester_id, target_user_id)).fetchone()
        has_permission = bool(is_same_family)
    else:
        supervisor_perm = conn.execute('''
            SELECT 1 FROM supervisor_permissions sp
            INNER JOIN family_members fm ON sp.family_member_id = fm.id
            WHERE fm.user_id = ? AND sp.target_user_id = ? AND sp.can_view_location = 1
            LIMIT 1
        ''', (requester_id, target_user_id)).fetchone()
        has_permission = bool(supervisor_perm)
    
    if not has_permission:
        conn.close()
        emit('camera_error', {'message': 'Sem permissão para acessar câmera deste usuário'})
        return
    
    requester = conn.execute('SELECT full_name FROM users WHERE id = ?', (requester_id,)).fetchone()
    conn.close()
    
    requester_name = requester['full_name'] if requester else 'Usuário'
    
    emit('camera_request', {
        'requester_id': requester_id,
        'requester_name': requester_name
    }, to=f'user_{target_user_id}')

@socketio.on('accept_camera')
def handle_accept_camera(data):
    """Usuário aceita solicitação de câmera"""
    if 'user_id' not in session:
        return
    
    user_id = session['user_id']
    requester_id = data.get('requester_id')
    
    emit('camera_accepted', {
        'user_id': user_id
    }, to=f'user_{requester_id}')

@socketio.on('reject_camera')
def handle_reject_camera(data):
    """Usuário rejeita solicitação de câmera"""
    if 'user_id' not in session:
        return
    
    requester_id = data.get('requester_id')
    
    emit('camera_rejected', {}, to=f'user_{requester_id}')

@socketio.on('stop_camera')
def handle_stop_camera():
    """Para transmissão de câmera"""
    if 'user_id' not in session:
        return
    
    user_id = session['user_id']
    
    emit('camera_stopped', {}, broadcast=True, include_self=False)

@socketio.on('camera_error')
def handle_camera_error(data):
    """Erro ao acessar câmera"""
    if 'user_id' not in session:
        return
    
    requester_id = data.get('requester_id')
    
    emit('camera_error', {}, to=f'user_{requester_id}')

@socketio.on('webrtc_offer')
def handle_webrtc_offer(data):
    """Encaminha oferta WebRTC"""
    if 'user_id' not in session:
        return
    
    sender_id = session['user_id']
    target_user_id = data.get('target_user_id')
    offer = data.get('offer')
    
    emit('webrtc_offer', {
        'sender_id': sender_id,
        'offer': offer
    }, to=f'user_{target_user_id}')

@socketio.on('webrtc_answer')
def handle_webrtc_answer(data):
    """Encaminha resposta WebRTC"""
    if 'user_id' not in session:
        return
    
    target_user_id = data.get('target_user_id')
    answer = data.get('answer')
    
    emit('webrtc_answer', {
        'answer': answer
    }, to=f'user_{target_user_id}')

@socketio.on('webrtc_ice_candidate')
def handle_ice_candidate(data):
    """Encaminha candidato ICE"""
    if 'user_id' not in session:
        return
    
    target_user_id = data.get('target_user_id')
    candidate = data.get('candidate')
    
    emit('webrtc_ice_candidate', {
        'candidate': candidate
    }, to=f'user_{target_user_id}')

@app.route('/api/ai/analyze/<int:user_id>', methods=['GET'])
@login_required
def analyze_user_with_ai(user_id):
    """Análise completa de IA para um usuário"""
    current_user_id = session['user_id']
    user_type = session.get('user_type', 'member')

    if current_user_id != user_id and user_type != 'super_admin':
        return jsonify({'success': False, 'message': 'Sem permissão'}), 403

    abnormal = ai_engine.detect_abnormal_trajectory(user_id)
    prolonged = ai_engine.detect_prolonged_stop(user_id)
    dangerous = None

    conn = get_db_connection()
    latest_loc = conn.execute(
        'SELECT latitude, longitude, battery_level, is_charging FROM locations WHERE user_id = ? ORDER BY timestamp DESC LIMIT 1',
        (user_id,)
    ).fetchone()
    conn.close()

    if latest_loc:
        dangerous = ai_engine.check_dangerous_area(latest_loc['latitude'], latest_loc['longitude'])
        charging_analysis = ai_engine.analyze_battery_charging(
            user_id, latest_loc['battery_level'], latest_loc['is_charging'],
            latest_loc['latitude'], latest_loc['longitude']
        )
    else:
        charging_analysis = {'is_suspicious': False}

    prediction = ai_engine.predict_destination(user_id)
    route = ai_engine.get_recent_route(user_id, minutes=30)

    risk_analysis = {
        'abnormal_trajectory': abnormal,
        'prolonged_stop': prolonged,
        'dangerous_area': dangerous or {'is_dangerous': False},
        'charging_analysis': charging_analysis
    }

    suggestions = ai_engine.suggest_actions(user_id, risk_analysis)

    return jsonify({
        'success': True,
        'risk_analysis': risk_analysis,
        'destination_prediction': prediction,
        'recent_route': route,
        'suggested_actions': suggestions
    })

@app.route('/api/profiles/<profile_type>/apply/<int:target_user_id>', methods=['POST'])
@login_required
def apply_relationship_profile(profile_type, target_user_id):
    """Aplica um perfil de relacionamento"""
    user_id = session['user_id']

    result = relationship_profiles.apply_profile_to_relationship(user_id, target_user_id, profile_type)

    if result['success']:
        return jsonify(result)
    else:
        return jsonify(result), 400

@app.route('/api/profiles/suggestions', methods=['GET'])
@login_required
def get_profile_suggestions():
    """Obtém sugestões de perfis baseadas no usuário"""
    user_id = session['user_id']

    conn = get_db_connection()
    user = conn.execute('SELECT user_category FROM users WHERE id = ?', (user_id,)).fetchone()
    conn.close()

    if user and user['user_category']:
        suggestions = relationship_profiles.get_relationship_suggestions(user['user_category'])
        profiles = [relationship_profiles.get_profile(s) for s in suggestions]
        return jsonify({'suggestions': profiles})

    return jsonify({'suggestions': []})

@app.route('/api/tranquility/<int:user_id>', methods=['GET'])
@login_required
def get_tranquility_status(user_id):
    """Obtém status no Modo Tranquilidade"""
    status = relationship_profiles.get_tranquility_status(user_id)
    return jsonify(status)

@app.route('/api/history/retention', methods=['GET', 'POST'])
@login_required
def manage_retention_policy():
    """Gerencia política de retenção de dados"""
    user_id = session['user_id']

    if request.method == 'POST':
        data = request.get_json()
        hours = data.get('hours', 24)
        result = history_manager.set_user_retention_policy(user_id, hours)
        return jsonify(result)
    else:
        hours = history_manager.get_user_retention_policy(user_id)
        return jsonify({'retention_hours': hours})

@app.route('/api/history/cleanup', methods=['POST'])
@login_required
def trigger_history_cleanup():
    """Executa limpeza de histórico"""
    user_id = session['user_id']
    result = history_manager.cleanup_old_data(user_id)
    return jsonify(result)

@app.route('/api/history/<int:user_id>', methods=['GET'])
@login_required
def get_location_history(user_id):
    """Obtém histórico de localizações"""
    current_user_id = session['user_id']

    if current_user_id != user_id:
        return jsonify({'success': False, 'message': 'Sem permissão'}), 403

    hours = request.args.get('hours', default=24, type=int)
    history = history_manager.get_location_history(user_id, hours)

    return jsonify({'history': history})

@app.route('/api/data/export', methods=['GET'])
@login_required
def export_user_data():
    """Exporta todos os dados do usuário (GDPR)"""
    user_id = session['user_id']
    data = history_manager.export_user_data(user_id)
    return jsonify(data)

@app.route('/api/widgets', methods=['GET'])
@login_required
def get_user_widgets():
    """Obtém widgets do usuário"""
    user_id = session['user_id']
    widgets = widget_system.get_user_widgets(user_id)
    return jsonify({'widgets': widgets})

@app.route('/api/widgets/suggestions', methods=['GET'])
@login_required
def get_widget_suggestions():
    """Obtém sugestões de widgets pela IA"""
    user_id = session['user_id']
    suggestions = widget_system.suggest_widgets_for_user(user_id)

    suggested_widgets = []
    for widget_id in suggestions:
        if widget_id in widget_system.widgets:
            widget = widget_system.widgets[widget_id]
            suggested_widgets.append({
                'id': widget_id,
                'name': widget['name'],
                'description': widget['description'],
                'icon': widget['icon'],
                'category': widget['category']
            })

    return jsonify({'suggestions': suggested_widgets})

@app.route('/api/widgets/<widget_id>', methods=['PUT'])
@login_required
def update_widget(widget_id):
    """Atualiza configuração de um widget"""
    user_id = session['user_id']
    data = request.get_json()

    result = widget_system.update_widget_config(user_id, widget_id, data)
    return jsonify(result)

@app.route('/api/widgets/<widget_id>/data', methods=['GET'])
@login_required
def get_widget_data(widget_id):
    """Obtém dados de um widget específico"""
    user_id = session['user_id']
    data = widget_system.get_widget_data(widget_id, user_id)
    return jsonify(data)

@app.route('/api/smart-alerts/configure', methods=['POST'])
@login_required
def configure_smart_alerts():
    """Configura alertas inteligentes"""
    user_id = session['user_id']
    data = request.get_json()

    conn = get_db_connection()

    try:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS smart_alert_config (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                alert_type TEXT NOT NULL,
                enabled INTEGER DEFAULT 1,
                config TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE(user_id, alert_type)
            )
        ''')

        alert_type = data.get('alert_type')
        enabled = data.get('enabled', True)
        config = json.dumps(data.get('config', {}))

        conn.execute('''
            INSERT OR REPLACE INTO smart_alert_config (user_id, alert_type, enabled, config)
            VALUES (?, ?, ?, ?)
        ''', (user_id, alert_type, 1 if enabled else 0, config))

        conn.commit()
        conn.close()

        return jsonify({'success': True, 'message': 'Alerta configurado com sucesso'})
    except Exception as e:
        conn.close()
        return jsonify({'success': False, 'message': str(e)}), 500

# ==================== KIRVANO WEBHOOK & ASSINATURAS ====================

@app.route('/api/subscription/create', methods=['POST'])
@login_required
def create_subscription():
    """Cria uma nova assinatura para o usuário"""
    user_id = session['user_id']
    
    conn = get_db_connection()
    
    # Verificar se já tem assinatura ativa
    existing = conn.execute(
        'SELECT * FROM subscriptions WHERE user_id = ? AND status IN ("active", "pending")',
        (user_id,)
    ).fetchone()
    
    if existing:
        conn.close()
        return jsonify({
            'success': False,
            'message': 'Você já possui uma assinatura ativa'
        }), 400
    
    # Criar nova assinatura
    cursor = conn.execute(
        '''INSERT INTO subscriptions (user_id, plan_name, plan_value, status)
           VALUES (?, ?, ?, ?)''',
        (user_id, 'Mensal', 29.90, 'pending')
    )
    subscription_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    # Aqui você retornaria o link de pagamento da Kirvano
    # Por enquanto, retorno um objeto básico
    return jsonify({
        'success': True,
        'subscription_id': subscription_id,
        'plan_value': 29.90,
        'message': 'Assinatura criada. Proceda com o pagamento.'
    })

@app.route('/api/subscription/status', methods=['GET'])
@login_required
def get_subscription_status():
    """Retorna status da assinatura do usuário"""
    user_id = session['user_id']
    
    conn = get_db_connection()
    subscription = conn.execute(
        'SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
        (user_id,)
    ).fetchone()
    conn.close()
    
    if not subscription:
        return jsonify({
            'success': True,
            'has_subscription': False,
            'status': 'none'
        })
    
    return jsonify({
        'success': True,
        'has_subscription': True,
        'subscription': dict(subscription)
    })

@app.route('/webhook/kirvano', methods=['POST'])
def kirvano_webhook():
    """Processa webhooks da Kirvano"""
    try:
        # Pegar dados do webhook
        payload = request.get_data()
        signature = request.headers.get('X-Kirvano-Signature', '')
        
        # IMPORTANTE: Configure sua chave secreta da Kirvano
        # Adicione KIRVANO_WEBHOOK_SECRET nas variáveis de ambiente
        webhook_secret = os.environ.get('KIRVANO_WEBHOOK_SECRET', '')
        
        # Validar assinatura do webhook (se configurado)
        if webhook_secret:
            expected_signature = hmac.new(
                webhook_secret.encode('utf-8'),
                payload,
                hashlib.sha256
            ).hexdigest()
            
            if not hmac.compare_digest(signature, expected_signature):
                print('⚠️ Assinatura do webhook inválida')
                return jsonify({'error': 'Invalid signature'}), 401
        
        data = request.get_json()
        event_type = data.get('event_type')
        
        print(f'📬 Webhook Kirvano recebido: {event_type}')
        
        conn = get_db_connection()
        
        # Registrar webhook
        conn.execute(
            '''INSERT INTO webhook_logs (event_type, event_data, received_at)
               VALUES (?, ?, ?)''',
            (event_type, json.dumps(data), now_brasilia())
        )
        conn.commit()
        
        # Processar diferentes tipos de eventos
        if event_type == 'subscription.created':
            handle_subscription_created(conn, data)
        elif event_type == 'subscription.activated':
            handle_subscription_activated(conn, data)
        elif event_type == 'payment.approved':
            handle_payment_approved(conn, data)
        elif event_type == 'payment.failed':
            handle_payment_failed(conn, data)
        elif event_type == 'subscription.cancelled':
            handle_subscription_cancelled(conn, data)
        elif event_type == 'subscription.expired':
            handle_subscription_expired(conn, data)
        
        conn.close()
        
        return jsonify({'success': True}), 200
        
    except Exception as e:
        print(f'❌ Erro ao processar webhook: {e}')
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

def handle_subscription_created(conn, data):
    """Processa criação de assinatura"""
    kirvano_sub_id = data.get('subscription_id')
    customer_email = data.get('customer', {}).get('email')
    
    # Encontrar usuário pelo email
    user = conn.execute('SELECT id FROM users WHERE email = ?', (customer_email,)).fetchone()
    
    if user:
        conn.execute(
            '''UPDATE subscriptions 
               SET kirvano_subscription_id = ?, kirvano_customer_id = ?, updated_at = ?
               WHERE user_id = ? AND status = "pending"''',
            (kirvano_sub_id, data.get('customer_id'), now_brasilia(), user['id'])
        )
        conn.commit()
        print(f'✅ Assinatura criada para usuário {user["id"]}')

def handle_subscription_activated(conn, data):
    """Processa ativação de assinatura e cria login se necessário"""
    kirvano_sub_id = data.get('subscription_id')
    customer_data = data.get('customer', {})
    customer_email = customer_data.get('email')
    customer_name = customer_data.get('name', 'Usuário')
    
    # Verificar se usuário existe, se não, criar
    if customer_email:
        user = conn.execute('SELECT id FROM users WHERE email = ?', (customer_email,)).fetchone()
        
        if not user:
            print(f'🆕 Criando novo usuário para {customer_email}')
            
            # Gerar senha temporária (será exigida troca no primeiro login)
            import secrets
            temp_password = secrets.token_urlsafe(16)
            password_hash = bcrypt.hashpw(temp_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
            username = customer_email.split('@')[0]
            
            # Criar usuário com flag de primeiro acesso
            cursor = conn.execute(
                '''INSERT INTO users (username, email, password_hash, full_name, user_type, first_access)
                   VALUES (?, ?, ?, ?, ?, 1)''',
                (username, customer_email, password_hash, customer_name, 'member')
            )
            new_user_id = cursor.lastrowid
            
            # Criar configurações padrão
            conn.execute('INSERT INTO user_settings (user_id) VALUES (?)', (new_user_id,))
            
            # Associar assinatura ao novo usuário
            conn.execute(
                'UPDATE subscriptions SET user_id = ? WHERE kirvano_subscription_id = ?',
                (new_user_id, kirvano_sub_id)
            )
            
            conn.commit()
            print(f'✅ Usuário criado: {customer_email} | Senha temporária: {temp_password}')
            print(f'📧 Envie esta senha por email para o cliente fazer o primeiro acesso!')
    
    # Calcular datas
    start_date = now_brasilia()
    end_date = start_date + timedelta(days=30)
    next_billing = end_date
    
    conn.execute(
        '''UPDATE subscriptions 
           SET status = "active", 
               start_date = ?, 
               end_date = ?, 
               next_billing_date = ?,
               updated_at = ?
           WHERE kirvano_subscription_id = ?''',
        (start_date, end_date, next_billing, now_brasilia(), kirvano_sub_id)
    )
    conn.commit()
    print(f'✅ Assinatura {kirvano_sub_id} ativada')

def handle_payment_approved(conn, data):
    """Processa pagamento aprovado e cria login se necessário"""
    kirvano_sub_id = data.get('subscription_id')
    payment_id = data.get('payment_id')
    amount = data.get('amount', 29.90)
    customer_data = data.get('customer', {})
    customer_email = customer_data.get('email')
    customer_name = customer_data.get('name', 'Usuário')
    
    subscription = conn.execute(
        'SELECT * FROM subscriptions WHERE kirvano_subscription_id = ?',
        (kirvano_sub_id,)
    ).fetchone()
    
    # Se não encontrou assinatura e tem email, criar usuário e assinatura
    if not subscription and customer_email:
        print(f'🆕 Criando usuário e assinatura para {customer_email}')
        
        # Verificar se usuário já existe
        user = conn.execute('SELECT id FROM users WHERE email = ?', (customer_email,)).fetchone()
        
        if not user:
            # Gerar senha temporária (será exigida troca no primeiro login)
            import secrets
            temp_password = secrets.token_urlsafe(16)
            password_hash = bcrypt.hashpw(temp_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
            username = customer_email.split('@')[0]
            
            # Criar usuário com flag de primeiro acesso
            cursor = conn.execute(
                '''INSERT INTO users (username, email, password_hash, full_name, user_type, first_access)
                   VALUES (?, ?, ?, ?, ?, 1)''',
                (username, customer_email, password_hash, customer_name, 'member')
            )
            user_id = cursor.lastrowid
            
            # Criar configurações padrão
            conn.execute('INSERT INTO user_settings (user_id) VALUES (?)', (user_id,))
            
            print(f'✅ Usuário criado: {customer_email} | Senha temporária: {temp_password}')
            print(f'📧 Envie esta senha por email para o cliente fazer o primeiro acesso!')
        else:
            user_id = user['id']
        
        # Criar assinatura
        cursor = conn.execute(
            '''INSERT INTO subscriptions (user_id, plan_name, plan_value, status, kirvano_subscription_id)
               VALUES (?, 'Mensal', ?, 'active', ?)''',
            (user_id, amount, kirvano_sub_id)
        )
        subscription_id = cursor.lastrowid
        
        # Registrar pagamento
        conn.execute(
            '''INSERT INTO payment_history 
               (subscription_id, user_id, amount, status, kirvano_payment_id, paid_at)
               VALUES (?, ?, ?, "paid", ?, ?)''',
            (subscription_id, user_id, amount, payment_id, now_brasilia())
        )
        
        # Ativar assinatura
        new_end_date = now_brasilia() + timedelta(days=30)
        conn.execute(
            '''UPDATE subscriptions 
               SET status = "active", start_date = ?, end_date = ?, next_billing_date = ?, updated_at = ?
               WHERE id = ?''',
            (now_brasilia(), new_end_date, new_end_date, now_brasilia(), subscription_id)
        )
        
        conn.commit()
        print(f'✅ Assinatura criada e ativada para {customer_email}')
        return
    
    # Fluxo normal - assinatura já existe
    if subscription:
        # Registrar pagamento
        conn.execute(
            '''INSERT INTO payment_history 
               (subscription_id, user_id, amount, status, kirvano_payment_id, paid_at)
               VALUES (?, ?, ?, "paid", ?, ?)''',
            (subscription['id'], subscription['user_id'], amount, payment_id, now_brasilia())
        )
        
        # Renovar assinatura
        new_end_date = now_brasilia() + timedelta(days=30)
        new_billing_date = new_end_date
        
        conn.execute(
            '''UPDATE subscriptions 
               SET status = "active", 
                   end_date = ?, 
                   next_billing_date = ?,
                   updated_at = ?
               WHERE id = ?''',
            (new_end_date, new_billing_date, now_brasilia(), subscription['id'])
        )
        conn.commit()
        print(f'✅ Pagamento aprovado para assinatura {subscription["id"]}')

def handle_payment_failed(conn, data):
    """Processa falha no pagamento"""
    kirvano_sub_id = data.get('subscription_id')
    
    subscription = conn.execute(
        'SELECT * FROM subscriptions WHERE kirvano_subscription_id = ?',
        (kirvano_sub_id,)
    ).fetchone()
    
    if subscription:
        conn.execute(
            '''INSERT INTO payment_history 
               (subscription_id, user_id, amount, status, kirvano_payment_id)
               VALUES (?, ?, ?, "failed", ?)''',
            (subscription['id'], subscription['user_id'], 29.90, data.get('payment_id'))
        )
        
        # Suspender assinatura após falha
        conn.execute(
            'UPDATE subscriptions SET status = "suspended", updated_at = ? WHERE id = ?',
            (now_brasilia(), subscription['id'])
        )
        conn.commit()
        print(f'⚠️ Pagamento falhou para assinatura {subscription["id"]}')

def handle_subscription_cancelled(conn, data):
    """Processa cancelamento de assinatura"""
    kirvano_sub_id = data.get('subscription_id')
    
    conn.execute(
        'UPDATE subscriptions SET status = "cancelled", updated_at = ? WHERE kirvano_subscription_id = ?',
        (now_brasilia(), kirvano_sub_id)
    )
    conn.commit()
    print(f'🚫 Assinatura {kirvano_sub_id} cancelada')

def handle_subscription_expired(conn, data):
    """Processa expiração de assinatura"""
    kirvano_sub_id = data.get('subscription_id')
    
    conn.execute(
        'UPDATE subscriptions SET status = "expired", updated_at = ? WHERE kirvano_subscription_id = ?',
        (now_brasilia(), kirvano_sub_id)
    )
    conn.commit()
    print(f'⏰ Assinatura {kirvano_sub_id} expirada')

@app.route('/api/admin/subscriptions', methods=['GET'])
@super_admin_required
def list_all_subscriptions():
    """Lista todas as assinaturas - apenas Super Admin"""
    conn = get_db_connection()
    
    subscriptions = conn.execute(
        '''SELECT s.*, u.full_name, u.email 
           FROM subscriptions s
           INNER JOIN users u ON s.user_id = u.id
           ORDER BY s.created_at DESC'''
    ).fetchall()
    
    conn.close()
    
    return jsonify({
        'success': True,
        'subscriptions': [dict(s) for s in subscriptions]
    })

# FUNCIONALIDADE DE CÂMERA DESABILITADA
# @app.route('/api/camera/upload', methods=['POST'])
# @login_required
# def upload_camera_photo():
#     # Recebe foto capturada da câmera do dispositivo
#     user_id = session.get('user_id')
#     
#     if 'photo' not in request.files:
#         return jsonify({'success': False, 'message': 'Nenhuma foto enviada'}), 400
#     
#     photo = request.files['photo']
#     camera_type = request.form.get('camera_type', 'unknown')
#     timestamp = request.form.get('timestamp', now_brasilia().isoformat())
#     
#     # Criar diretório para fotos se não existir
#     photos_dir = os.path.join('static', 'camera_photos', str(user_id))
#     os.makedirs(photos_dir, exist_ok=True)
#     
#     # Salvar foto
#     filename = f"{camera_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
#     filepath = os.path.join(photos_dir, filename)
#     photo.save(filepath)
#     
#     # Registrar no banco
#     conn = get_db_connection()
#     try:
#         conn.execute('''
#             CREATE TABLE IF NOT EXISTS camera_photos (
#                 id INTEGER PRIMARY KEY AUTOINCREMENT,
#                 user_id INTEGER NOT NULL,
#                 camera_type TEXT,
#                 filepath TEXT,
#                 captured_at TEXT,
#                 created_at TEXT,
#                 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
#             )
#         ''')
#         
#         conn.execute('''
#             INSERT INTO camera_photos (user_id, camera_type, filepath, captured_at, created_at)
#             VALUES (?, ?, ?, ?, ?)
#         ''', (user_id, camera_type, filepath, timestamp, now_brasilia().isoformat()))
#         
#         conn.commit()
#         
#         return jsonify({
#             'success': True,
#             'message': 'Foto salva com sucesso',
#             'filepath': filepath,
#             'camera_type': camera_type
#         })
#     except Exception as e:
#         return jsonify({'success': False, 'message': str(e)}), 500
#     finally:
#         conn.close()

# @app.route('/api/camera/photos/<int:target_user_id>', methods=['GET'])
# @login_required
# def get_user_camera_photos(target_user_id):
#     # Obtém fotos da câmera de um usuário específico
#     user_id = session['user_id']
#     user_type = session.get('user_type', 'member')
#     
#     conn = get_db_connection()
#     
#     # 1. Super Admin - pode ver TUDO
#     if user_type == 'super_admin':
#         photos = conn.execute('''
#             SELECT * FROM camera_photos 
#             WHERE user_id = ? 
#             ORDER BY captured_at DESC 
#             LIMIT 50
#         ''', (target_user_id,)).fetchall()
#         conn.close()
#         
#         return jsonify({
#             'success': True,
#             'photos': [dict(photo) for photo in photos]
#         })
#     
#     # 2. Admin de Família - pode ver todos da SUA família
#     is_family_admin = conn.execute('''
#         SELECT 1 FROM family_members fm1
#         INNER JOIN family_members fm2 ON fm1.family_id = fm2.family_id
#         WHERE fm1.user_id = ? AND fm2.user_id = ? AND fm1.role = 'admin'
#         LIMIT 1
#     ''', (user_id, target_user_id)).fetchone()
#     
#     if is_family_admin:
#         photos = conn.execute('''
#             SELECT * FROM camera_photos 
#             WHERE user_id = ? 
#             ORDER BY captured_at DESC 
#             LIMIT 50
#         ''', (target_user_id,)).fetchall()
#         conn.close()
#         
#         return jsonify({
#             'success': True,
#             'photos': [dict(photo) for photo in photos]
#         })
#     
#     # 3. Supervisor - pode ver apenas quem o Admin permitiu
#     supervisor_perm = conn.execute('''
#         SELECT sp.* FROM supervisor_permissions sp
#         INNER JOIN family_members fm ON sp.family_member_id = fm.id
#         WHERE fm.user_id = ? AND sp.target_user_id = ? AND sp.can_view_location = 1
#         LIMIT 1
#     ''', (user_id, target_user_id)).fetchone()
#     
#     if supervisor_perm:
#         photos = conn.execute('''
#             SELECT * FROM camera_photos 
#             WHERE user_id = ? 
#             ORDER BY captured_at DESC 
#             LIMIT 50
#         ''', (target_user_id,)).fetchall()
#         conn.close()
#         
#         return jsonify({
#             'success': True,
#             'photos': [dict(photo) for photo in photos]
#         })
#     
#     # 4. Próprio usuário pode ver suas próprias fotos
#     if user_id == target_user_id:
#         photos = conn.execute('''
#             SELECT * FROM camera_photos 
#             WHERE user_id = ? 
#             ORDER BY captured_at DESC 
#             LIMIT 50
#         ''', (target_user_id,)).fetchall()
#         conn.close()
#         
#         return jsonify({
#             'success': True,
#             'photos': [dict(photo) for photo in photos]
#         })
#     
#     # 5. Sem permissão
#     conn.close()
#     return jsonify({'success': False, 'message': 'Sem permissão para visualizar as câmeras deste usuário'}), 403

# @app.route('/api/camera/available-users', methods=['GET'])
# @login_required
# def get_available_camera_users():
#     # Lista usuários cujas câmeras o usuário logado pode visualizar
#     user_id = session['user_id']
#     user_type = session.get('user_type', 'member')
#     
#     conn = get_db_connection()
#     
#     # Super Admin - pode ver TODOS
#     if user_type == 'super_admin':
#         users = conn.execute('''
#             SELECT u.id, u.full_name, u.email, u.user_type, u.user_category,
#                    (SELECT COUNT(*) FROM camera_photos WHERE user_id = u.id) as photo_count
#             FROM users u
#             WHERE u.user_type != 'super_admin'
#             ORDER BY u.full_name
#         ''').fetchall()
#         conn.close()
#         
#         return jsonify({
#             'success': True,
#             'users': [dict(user) for user in users]
#         })
#     
#     # Admin de Família - pode ver todos da família
#     if user_type == 'family_admin':
#         users = conn.execute('''
#             SELECT DISTINCT u.id, u.full_name, u.email, u.user_type, u.user_category,
#                    (SELECT COUNT(*) FROM camera_photos WHERE user_id = u.id) as photo_count
#             FROM users u
#             INNER JOIN family_members fm1 ON u.id = fm1.user_id
#             INNER JOIN family_members fm2 ON fm1.family_id = fm2.family_id
#             WHERE fm2.user_id = ? AND fm2.role = 'admin' AND u.id != ?
#             ORDER BY u.full_name
#         ''', (user_id, user_id)).fetchall()
#         conn.close()
#         
#         return jsonify({
#             'success': True,
#             'users': [dict(user) for user in users]
#         })
#     
#     # Supervisor - pode ver apenas quem foi autorizado
#     users = conn.execute('''
#         SELECT DISTINCT u.id, u.full_name, u.email, u.user_type, u.user_category,
#                (SELECT COUNT(*) FROM camera_photos WHERE user_id = u.id) as photo_count
#         FROM users u
#         INNER JOIN supervisor_permissions sp ON u.id = sp.target_user_id
#         INNER JOIN family_members fm ON sp.family_member_id = fm.id
#         WHERE fm.user_id = ? AND sp.can_view_location = 1
#         ORDER BY u.full_name
#     ''', (user_id,)).fetchall()
#     conn.close()
#     
#     return jsonify({
#         'success': True,
#         'users': [dict(user) for user in users]
#     })

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, allow_unsafe_werkzeug=True, use_reloader=False, log_output=True)
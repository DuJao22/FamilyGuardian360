"""
Family Guardian 360° - Customizable Widget System
Sistema de Widgets Personalizáveis com IA
Desenvolvido por: João Layon - Desenvolvedor Full Stack
"""

from database.db import get_db_connection
import json

class WidgetSystem:
    """
    Sistema de widgets personalizáveis para o painel do usuário
    Com sugestões inteligentes baseadas em IA
    """
    
    AVAILABLE_WIDGETS = {
        'location_map': {
            'name': 'Mapa de Localização',
            'description': 'Visualize sua localização e de familiares no mapa',
            'icon': 'fa-map-marked-alt',
            'category': 'location',
            'default_size': 'large'
        },
        'battery_status': {
            'name': 'Status de Bateria',
            'description': 'Monitore a bateria de todos os dispositivos',
            'icon': 'fa-battery-three-quarters',
            'category': 'device',
            'default_size': 'medium'
        },
        'recent_alerts': {
            'name': 'Alertas Recentes',
            'description': 'Visualize os alertas mais recentes',
            'icon': 'fa-bell',
            'category': 'safety',
            'default_size': 'medium'
        },
        'family_activity': {
            'name': 'Atividade da Família',
            'description': 'Timeline de atividades dos membros',
            'icon': 'fa-users',
            'category': 'social',
            'default_size': 'large'
        },
        'quick_actions': {
            'name': 'Ações Rápidas',
            'description': 'Botões de ações rápidas e importantes',
            'icon': 'fa-bolt',
            'category': 'utility',
            'default_size': 'small'
        },
        'ai_insights': {
            'name': 'Insights de IA',
            'description': 'Análises e sugestões inteligentes',
            'icon': 'fa-brain',
            'category': 'ai',
            'default_size': 'medium'
        },
        'route_history': {
            'name': 'Histórico de Rotas',
            'description': 'Visualize rotas recentes',
            'icon': 'fa-route',
            'category': 'location',
            'default_size': 'medium'
        },
        'safe_zones': {
            'name': 'Zonas Seguras',
            'description': 'Gerencie e monitore zonas seguras',
            'icon': 'fa-shield-alt',
            'category': 'safety',
            'default_size': 'medium'
        },
        'connection_health': {
            'name': 'Saúde da Conexão',
            'description': 'Status de conectividade dos dispositivos',
            'icon': 'fa-signal',
            'category': 'device',
            'default_size': 'small'
        },
        'panic_button': {
            'name': 'Botão de Pânico',
            'description': 'Acesso rápido ao botão de emergência',
            'icon': 'fa-exclamation-triangle',
            'category': 'safety',
            'default_size': 'small'
        }
    }
    
    def __init__(self):
        self.widgets = self.AVAILABLE_WIDGETS
        self._ensure_widget_table()
    
    def _ensure_widget_table(self):
        """Garante que a tabela de widgets existe"""
        conn = get_db_connection()
        
        try:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS user_widgets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    widget_id TEXT NOT NULL,
                    position INTEGER DEFAULT 0,
                    size TEXT DEFAULT 'medium',
                    is_visible INTEGER DEFAULT 1,
                    settings TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    UNIQUE(user_id, widget_id)
                )
            ''')
            conn.commit()
        except:
            pass
        finally:
            conn.close()
    
    def get_user_widgets(self, user_id):
        """Obtém configuração de widgets do usuário"""
        conn = get_db_connection()
        
        widgets = conn.execute('''
            SELECT widget_id, position, size, is_visible, settings
            FROM user_widgets
            WHERE user_id = ?
            ORDER BY position
        ''', (user_id,)).fetchall()
        
        conn.close()
        
        if not widgets:
            return self.get_default_widgets(user_id)
        
        result = []
        for widget in widgets:
            widget_config = self.widgets.get(widget['widget_id'])
            if widget_config:
                result.append({
                    'id': widget['widget_id'],
                    'name': widget_config['name'],
                    'description': widget_config['description'],
                    'icon': widget_config['icon'],
                    'category': widget_config['category'],
                    'position': widget['position'],
                    'size': widget['size'],
                    'is_visible': bool(widget['is_visible']),
                    'settings': json.loads(widget['settings']) if widget['settings'] else {}
                })
        
        return result
    
    def get_default_widgets(self, user_id):
        """Retorna widgets padrão para novo usuário"""
        default_widgets = [
            'location_map',
            'battery_status',
            'recent_alerts',
            'quick_actions',
            'ai_insights'
        ]
        
        conn = get_db_connection()
        
        for idx, widget_id in enumerate(default_widgets):
            try:
                conn.execute('''
                    INSERT INTO user_widgets (user_id, widget_id, position, size, is_visible)
                    VALUES (?, ?, ?, ?, 1)
                ''', (user_id, widget_id, idx, self.widgets[widget_id]['default_size']))
            except:
                pass
        
        conn.commit()
        conn.close()
        
        return self.get_user_widgets(user_id)
    
    def update_widget_config(self, user_id, widget_id, config):
        """Atualiza configuração de um widget"""
        conn = get_db_connection()
        
        try:
            position = config.get('position')
            size = config.get('size')
            is_visible = config.get('is_visible', True)
            settings = json.dumps(config.get('settings', {}))
            
            conn.execute('''
                UPDATE user_widgets
                SET position = COALESCE(?, position),
                    size = COALESCE(?, size),
                    is_visible = COALESCE(?, is_visible),
                    settings = COALESCE(?, settings)
                WHERE user_id = ? AND widget_id = ?
            ''', (position, size, 1 if is_visible else 0, settings, user_id, widget_id))
            
            if conn.total_changes == 0:
                conn.execute('''
                    INSERT INTO user_widgets (user_id, widget_id, position, size, is_visible, settings)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (user_id, widget_id, position or 0, size or 'medium', 1 if is_visible else 0, settings))
            
            conn.commit()
            conn.close()
            
            return {'success': True, 'message': 'Widget atualizado com sucesso'}
        except Exception as e:
            conn.close()
            return {'success': False, 'message': f'Erro ao atualizar widget: {str(e)}'}
    
    def suggest_widgets_for_user(self, user_id):
        """IA: Sugere widgets baseado no perfil e uso do usuário"""
        conn = get_db_connection()
        
        user = conn.execute(
            'SELECT user_category, user_type FROM users WHERE id = ?',
            (user_id,)
        ).fetchone()
        
        families = conn.execute(
            'SELECT COUNT(*) as count FROM family_members WHERE user_id = ?',
            (user_id,)
        ).fetchone()
        
        has_safe_zones = conn.execute(
            'SELECT COUNT(*) as count FROM safe_zones WHERE user_id = ? AND is_active = 1',
            (user_id,)
        ).fetchone()
        
        conn.close()
        
        suggestions = []
        
        if user and user['user_category'] == 'filho':
            suggestions.extend(['panic_button', 'safe_zones', 'battery_status'])
        
        if user and user['user_category'] == 'idoso':
            suggestions.extend(['panic_button', 'battery_status', 'connection_health'])
        
        if user and user['user_type'] in ['family_admin', 'super_admin']:
            suggestions.extend(['ai_insights', 'family_activity', 'recent_alerts'])
        
        if families and families['count'] > 0:
            suggestions.append('location_map')
        
        if has_safe_zones and has_safe_zones['count'] > 0:
            suggestions.append('safe_zones')
        
        return list(set(suggestions))
    
    def get_widget_data(self, widget_id, user_id):
        """Obtém dados específicos de um widget"""
        from ai_engine import ai_engine
        from history_manager import history_manager
        
        conn = get_db_connection()
        
        if widget_id == 'battery_status':
            family_members = conn.execute('''
                SELECT DISTINCT u.id, u.full_name, l.battery_level, l.is_charging, l.timestamp
                FROM users u
                INNER JOIN family_members fm1 ON u.id = fm1.user_id
                INNER JOIN family_members fm2 ON fm1.family_id = fm2.family_id
                LEFT JOIN locations l ON u.id = l.user_id
                WHERE fm2.user_id = ? AND l.id IN (
                    SELECT MAX(id) FROM locations GROUP BY user_id
                )
            ''', (user_id,)).fetchall()
            
            conn.close()
            return {'members': [dict(m) for m in family_members]}
        
        elif widget_id == 'ai_insights':
            analysis = ai_engine.detect_abnormal_trajectory(user_id)
            prolonged = ai_engine.detect_prolonged_stop(user_id)
            prediction = ai_engine.predict_destination(user_id)
            
            conn.close()
            return {
                'abnormal_trajectory': analysis,
                'prolonged_stop': prolonged,
                'destination_prediction': prediction
            }
        
        elif widget_id == 'route_history':
            route = ai_engine.get_recent_route(user_id, minutes=60)
            conn.close()
            return {'route_points': route}
        
        elif widget_id == 'connection_health':
            recent_location = conn.execute(
                'SELECT timestamp FROM locations WHERE user_id = ? ORDER BY timestamp DESC LIMIT 1',
                (user_id,)
            ).fetchone()
            
            conn.close()
            
            if recent_location:
                from datetime import datetime
                last_update = datetime.fromisoformat(recent_location['timestamp'])
                seconds_ago = (datetime.now() - last_update).total_seconds()
                
                if seconds_ago < 60:
                    status = 'excellent'
                elif seconds_ago < 300:
                    status = 'good'
                elif seconds_ago < 900:
                    status = 'fair'
                else:
                    status = 'poor'
                
                return {'status': status, 'last_update_seconds': int(seconds_ago)}
            
            return {'status': 'offline', 'last_update_seconds': None}
        
        conn.close()
        return {}

widget_system = WidgetSystem()

"""
Family Guardian 360° - Relationship Profiles System
Sistema de Perfis Ajustáveis por Tipo de Relação
Desenvolvido por: João Layon - Desenvolvedor Full Stack
"""

from database.db import get_db_connection

class RelationshipProfiles:
    """
    Sistema de perfis automáticos baseados no tipo de relacionamento
    Ajusta permissões e transparência automaticamente
    """
    
    PROFILE_TYPES = {
        'pais_filhos': {
            'name': 'Pais ↔ Filhos',
            'description': 'Monitoramento completo para proteção de menores',
            'permissions': {
                'can_view_location': True,
                'can_view_battery': True,
                'can_view_history': True,
                'can_receive_alerts': True,
                'can_view_messages': True,
                'location_update_interval': 3,
                'battery_alert_threshold': 20,
                'enable_geofencing': True,
                'enable_panic_button': True,
                'share_exact_location': True
            }
        },
        'conjuges': {
            'name': 'Cônjuges',
            'description': 'Compartilhamento mútuo baseado em confiança',
            'permissions': {
                'can_view_location': True,
                'can_view_battery': True,
                'can_view_history': False,
                'can_receive_alerts': True,
                'can_view_messages': False,
                'location_update_interval': 5,
                'battery_alert_threshold': 15,
                'enable_geofencing': False,
                'enable_panic_button': True,
                'share_exact_location': True
            }
        },
        'avos': {
            'name': 'Avós',
            'description': 'Cuidado especial para idosos',
            'permissions': {
                'can_view_location': True,
                'can_view_battery': True,
                'can_view_history': True,
                'can_receive_alerts': True,
                'can_view_messages': True,
                'location_update_interval': 3,
                'battery_alert_threshold': 25,
                'enable_geofencing': True,
                'enable_panic_button': True,
                'share_exact_location': True,
                'fall_detection': True,
                'medication_reminders': True
            }
        },
        'amigos': {
            'name': 'Amigos Confiáveis',
            'description': 'Compartilhamento limitado e respeitoso',
            'permissions': {
                'can_view_location': True,
                'can_view_battery': False,
                'can_view_history': False,
                'can_receive_alerts': False,
                'can_view_messages': False,
                'location_update_interval': 10,
                'battery_alert_threshold': 10,
                'enable_geofencing': False,
                'enable_panic_button': False,
                'share_exact_location': False
            }
        },
        'tranquilidade': {
            'name': 'Modo Tranquilidade',
            'description': 'Apenas confirma segurança, sem localização exata',
            'permissions': {
                'can_view_location': False,
                'can_view_battery': False,
                'can_view_history': False,
                'can_receive_alerts': True,
                'can_view_messages': False,
                'location_update_interval': 15,
                'battery_alert_threshold': 10,
                'enable_geofencing': False,
                'enable_panic_button': True,
                'share_exact_location': False,
                'show_safety_status_only': True
            }
        }
    }
    
    def __init__(self):
        self.profiles = self.PROFILE_TYPES
    
    def get_profile(self, profile_type):
        """Retorna configurações de um perfil específico"""
        return self.profiles.get(profile_type, self.profiles['amigos'])
    
    def apply_profile_to_relationship(self, user_id, target_user_id, profile_type):
        """Aplica um perfil de relacionamento entre dois usuários"""
        profile = self.get_profile(profile_type)
        
        if not profile:
            return {'success': False, 'message': 'Perfil inválido'}
        
        conn = get_db_connection()
        
        try:
            permissions = profile['permissions']
            
            conn.execute('''
                INSERT OR REPLACE INTO permissions 
                (user_id, target_user_id, can_view_location, can_view_battery, can_view_history, can_send_messages, privacy_mode, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ''', (
                user_id,
                target_user_id,
                1 if permissions.get('can_view_location') else 0,
                1 if permissions.get('can_view_battery') else 0,
                1 if permissions.get('can_view_history') else 0,
                1 if permissions.get('can_view_messages') else 0,
                profile_type
            ))
            
            conn.execute('''
                INSERT OR REPLACE INTO user_settings 
                (user_id, location_update_interval, battery_alert_threshold, share_battery_status, share_location)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                location_update_interval = excluded.location_update_interval,
                battery_alert_threshold = excluded.battery_alert_threshold,
                share_battery_status = excluded.share_battery_status,
                share_location = excluded.share_location
            ''', (
                user_id,
                permissions.get('location_update_interval', 5),
                permissions.get('battery_alert_threshold', 20),
                1 if permissions.get('can_view_battery') else 0,
                1 if permissions.get('can_view_location') else 0
            ))
            
            conn.commit()
            conn.close()
            
            return {
                'success': True,
                'message': f'Perfil "{profile["name"]}" aplicado com sucesso',
                'profile': profile
            }
        except Exception as e:
            conn.close()
            return {'success': False, 'message': f'Erro ao aplicar perfil: {str(e)}'}
    
    def get_relationship_suggestions(self, user_category):
        """Sugere perfis baseados na categoria do usuário"""
        suggestions = {
            'filho': ['pais_filhos'],
            'idoso': ['avos', 'pais_filhos'],
            'outro': ['conjuges', 'amigos', 'tranquilidade']
        }
        
        return suggestions.get(user_category, ['amigos', 'tranquilidade'])
    
    def get_tranquility_status(self, user_id):
        """
        Retorna apenas status de segurança sem localização exata
        Modo Tranquilidade
        """
        conn = get_db_connection()
        
        recent_location = conn.execute(
            '''SELECT timestamp, battery_level, is_charging
               FROM locations 
               WHERE user_id = ? 
               ORDER BY timestamp DESC 
               LIMIT 1''',
            (user_id,)
        ).fetchone()
        
        user = conn.execute(
            'SELECT full_name, last_seen FROM users WHERE id = ?',
            (user_id,)
        ).fetchone()
        
        conn.close()
        
        if not recent_location:
            return {
                'status': 'unknown',
                'message': 'Sem informações recentes',
                'user_name': user['full_name'] if user else 'Unknown'
            }
        
        from datetime import datetime, timedelta
        last_update = datetime.fromisoformat(recent_location['timestamp'])
        time_diff = datetime.now() - last_update
        
        if time_diff < timedelta(minutes=10):
            status = 'safe'
            message = 'Tudo bem - Ativo recentemente'
        elif time_diff < timedelta(hours=1):
            status = 'ok'
            message = 'OK - Última atividade há menos de 1 hora'
        elif time_diff < timedelta(hours=6):
            status = 'attention'
            message = 'Atenção - Sem atividade recente'
        else:
            status = 'concern'
            message = 'Preocupação - Sem atividade há muito tempo'
        
        return {
            'status': status,
            'message': message,
            'user_name': user['full_name'] if user else 'Unknown',
            'battery_level': recent_location['battery_level'],
            'is_charging': recent_location['is_charging'],
            'last_activity_minutes': int(time_diff.total_seconds() / 60)
        }

relationship_profiles = RelationshipProfiles()

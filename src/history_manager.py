"""
Family Guardian 360° - History Management System
Sistema de Gerenciamento de Histórico Configurável
Desenvolvido por: João Layon - Desenvolvedor Full Stack
"""

from datetime import datetime, timedelta
from database.db import get_db_connection

class HistoryManager:
    """
    Gerenciador de histórico com limpeza automática configurável
    Padrão: mantém dados por 24 horas
    """
    
    def __init__(self):
        self.default_retention_hours = 24
    
    def set_user_retention_policy(self, user_id, hours):
        """Define política de retenção de dados para um usuário"""
        if hours < 1 or hours > 720:
            return {'success': False, 'message': 'Retenção deve estar entre 1 e 720 horas (30 dias)'}
        
        conn = get_db_connection()
        
        try:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS retention_policies (
                    user_id INTEGER PRIMARY KEY,
                    retention_hours INTEGER DEFAULT 24,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            ''')
            
            conn.execute('''
                INSERT OR REPLACE INTO retention_policies (user_id, retention_hours, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
            ''', (user_id, hours))
            
            conn.commit()
            conn.close()
            
            return {
                'success': True,
                'message': f'Política de retenção configurada para {hours} horas',
                'retention_hours': hours
            }
        except Exception as e:
            conn.close()
            return {'success': False, 'message': f'Erro ao configurar política: {str(e)}'}
    
    def get_user_retention_policy(self, user_id):
        """Obtém política de retenção de um usuário"""
        conn = get_db_connection()
        
        policy = conn.execute(
            'SELECT retention_hours FROM retention_policies WHERE user_id = ?',
            (user_id,)
        ).fetchone()
        
        conn.close()
        
        if policy:
            return policy['retention_hours']
        return self.default_retention_hours
    
    def cleanup_old_data(self, user_id=None):
        """
        Remove dados antigos baseado na política de retenção
        Se user_id for None, limpa para todos os usuários
        """
        conn = get_db_connection()
        
        try:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS retention_policies (
                    user_id INTEGER PRIMARY KEY,
                    retention_hours INTEGER DEFAULT 24,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            ''')
            conn.commit()
        except:
            pass
        
        deleted_count = 0
        
        if user_id:
            retention_hours = self.get_user_retention_policy(user_id)
            cutoff_time = datetime.now() - timedelta(hours=retention_hours)
            
            result = conn.execute('''
                DELETE FROM locations 
                WHERE user_id = ? AND datetime(timestamp) < ?
            ''', (user_id, cutoff_time.isoformat()))
            
            deleted_count = result.rowcount
            
            conn.execute('''
                DELETE FROM alerts 
                WHERE user_id = ? AND datetime(created_at) < ? AND is_read = 1
            ''', (user_id, cutoff_time.isoformat()))
            
        else:
            users = conn.execute('SELECT id FROM users').fetchall()
            
            for user in users:
                retention_hours = self.get_user_retention_policy(user['id'])
                cutoff_time = datetime.now() - timedelta(hours=retention_hours)
                
                result = conn.execute('''
                    DELETE FROM locations 
                    WHERE user_id = ? AND datetime(timestamp) < ?
                ''', (user['id'], cutoff_time.isoformat()))
                
                deleted_count += result.rowcount
                
                conn.execute('''
                    DELETE FROM alerts 
                    WHERE user_id = ? AND datetime(created_at) < ? AND is_read = 1
                ''', (user['id'], cutoff_time.isoformat()))
        
        conn.commit()
        conn.close()
        
        return {
            'success': True,
            'deleted_locations': deleted_count,
            'message': f'{deleted_count} registros de localização removidos'
        }
    
    def get_location_history(self, user_id, hours=24):
        """Obtém histórico de localizações de um usuário"""
        conn = get_db_connection()
        
        cutoff_time = datetime.now() - timedelta(hours=hours)
        
        locations = conn.execute('''
            SELECT latitude, longitude, accuracy, timestamp, battery_level, speed, heading
            FROM locations 
            WHERE user_id = ? AND datetime(timestamp) >= ?
            ORDER BY timestamp DESC
        ''', (user_id, cutoff_time.isoformat())).fetchall()
        
        conn.close()
        
        return [dict(loc) for loc in locations]
    
    def export_user_data(self, user_id):
        """Exporta todos os dados de um usuário (GDPR compliance)"""
        conn = get_db_connection()
        
        user = conn.execute(
            'SELECT * FROM users WHERE id = ?',
            (user_id,)
        ).fetchone()
        
        locations = conn.execute(
            'SELECT * FROM locations WHERE user_id = ? ORDER BY timestamp DESC',
            (user_id,)
        ).fetchall()
        
        alerts = conn.execute(
            'SELECT * FROM alerts WHERE user_id = ? ORDER BY created_at DESC',
            (user_id,)
        ).fetchall()
        
        messages = conn.execute(
            'SELECT * FROM messages WHERE sender_id = ? ORDER BY sent_at DESC',
            (user_id,)
        ).fetchall()
        
        conn.close()
        
        return {
            'user': dict(user) if user else None,
            'locations': [dict(loc) for loc in locations],
            'alerts': [dict(alert) for alert in alerts],
            'messages': [dict(msg) for msg in messages],
            'export_date': datetime.now().isoformat()
        }
    
    def anonymize_user_data(self, user_id):
        """Anonimiza dados de um usuário (GDPR right to be forgotten)"""
        conn = get_db_connection()
        
        try:
            conn.execute('''
                DELETE FROM locations WHERE user_id = ?
            ''', (user_id,))
            
            conn.execute('''
                DELETE FROM alerts WHERE user_id = ?
            ''', (user_id,))
            
            conn.execute('''
                DELETE FROM panic_alerts WHERE user_id = ?
            ''', (user_id,))
            
            conn.execute('''
                UPDATE users 
                SET email = ?, username = ?, full_name = ?, phone = NULL, cpf = NULL
                WHERE id = ?
            ''', (f'deleted_{user_id}@deleted.com', f'deleted_{user_id}', 'Deleted User', user_id))
            
            conn.commit()
            conn.close()
            
            return {'success': True, 'message': 'Dados anonimizados com sucesso'}
        except Exception as e:
            conn.close()
            return {'success': False, 'message': f'Erro ao anonimizar: {str(e)}'}

history_manager = HistoryManager()

"""
Family Guardian 360° - AI Protection Engine
Sistema de Inteligência Artificial para Proteção Familiar
Desenvolvido por: João Layon - Desenvolvedor Full Stack
"""

import math
from datetime import datetime, timedelta
from database.db import get_db_connection

class AIProtectionEngine:
    """Motor de IA para detecção de comportamentos de risco e sugestões inteligentes"""
    
    def __init__(self):
        self.risk_zones = []
        self.user_patterns = {}
    
    def calculate_distance(self, lat1, lon1, lat2, lon2):
        """Calcula distância entre duas coordenadas em metros (Haversine)"""
        R = 6371000
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)
        
        a = math.sin(delta_phi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        
        return R * c
    
    def detect_abnormal_trajectory(self, user_id):
        """Detecta trajeto anormal com base no histórico do usuário"""
        conn = get_db_connection()
        
        recent_locations = conn.execute(
            '''SELECT latitude, longitude, timestamp, speed
               FROM locations 
               WHERE user_id = ? 
               ORDER BY timestamp DESC 
               LIMIT 10''',
            (user_id,)
        ).fetchall()
        
        if len(recent_locations) < 3:
            conn.close()
            return {'is_abnormal': False, 'reason': None}
        
        daily_pattern = conn.execute(
            '''SELECT AVG(latitude) as avg_lat, AVG(longitude) as avg_lon,
               MIN(latitude) as min_lat, MAX(latitude) as max_lat,
               MIN(longitude) as min_lon, MAX(longitude) as max_lon
               FROM locations 
               WHERE user_id = ? 
               AND datetime(timestamp) >= datetime('now', '-7 days')''',
            (user_id,)
        ).fetchone()
        
        conn.close()
        
        current = recent_locations[0]
        
        if daily_pattern and daily_pattern['avg_lat']:
            distance_from_normal = self.calculate_distance(
                current['latitude'], 
                current['longitude'],
                daily_pattern['avg_lat'],
                daily_pattern['avg_lon']
            )
            
            lat_range = daily_pattern['max_lat'] - daily_pattern['min_lat']
            lon_range = daily_pattern['max_lon'] - daily_pattern['min_lon']
            normal_range = max(abs(lat_range), abs(lon_range)) * 111000
            
            if distance_from_normal > normal_range * 3:
                return {
                    'is_abnormal': True,
                    'reason': 'Localização fora do padrão habitual',
                    'distance_km': round(distance_from_normal / 1000, 2),
                    'severity': 'high'
                }
        
        if len(recent_locations) >= 2:
            speeds = [loc['speed'] for loc in recent_locations if loc['speed'] is not None]
            if speeds:
                avg_speed = sum(speeds) / len(speeds)
                if avg_speed > 150:
                    return {
                        'is_abnormal': True,
                        'reason': 'Velocidade muito alta detectada',
                        'speed_kmh': round(avg_speed * 3.6, 2),
                        'severity': 'medium'
                    }
        
        return {'is_abnormal': False, 'reason': None}
    
    def detect_prolonged_stop(self, user_id):
        """Detecta parada prolongada em local incomum"""
        conn = get_db_connection()
        
        recent_locations = conn.execute(
            '''SELECT latitude, longitude, timestamp
               FROM locations 
               WHERE user_id = ? 
               ORDER BY timestamp DESC 
               LIMIT 20''',
            (user_id,)
        ).fetchall()
        
        if len(recent_locations) < 5:
            conn.close()
            return {'is_prolonged_stop': False}
        
        distances = []
        for i in range(len(recent_locations) - 1):
            dist = self.calculate_distance(
                recent_locations[i]['latitude'],
                recent_locations[i]['longitude'],
                recent_locations[i+1]['latitude'],
                recent_locations[i+1]['longitude']
            )
            distances.append(dist)
        
        avg_movement = sum(distances) / len(distances)
        
        first_time = datetime.fromisoformat(recent_locations[-1]['timestamp'])
        last_time = datetime.fromisoformat(recent_locations[0]['timestamp'])
        time_diff = (last_time - first_time).total_seconds() / 60
        
        if avg_movement < 50 and time_diff > 30:
            safe_zones = conn.execute(
                '''SELECT zone_name, latitude, longitude, radius
                   FROM safe_zones 
                   WHERE user_id = ? AND is_active = 1''',
                (user_id,)
            ).fetchall()
            
            is_in_safe_zone = False
            for zone in safe_zones:
                dist = self.calculate_distance(
                    recent_locations[0]['latitude'],
                    recent_locations[0]['longitude'],
                    zone['latitude'],
                    zone['longitude']
                )
                if dist <= zone['radius']:
                    is_in_safe_zone = True
                    break
            
            conn.close()
            
            if not is_in_safe_zone:
                return {
                    'is_prolonged_stop': True,
                    'minutes': int(time_diff),
                    'latitude': recent_locations[0]['latitude'],
                    'longitude': recent_locations[0]['longitude'],
                    'severity': 'medium'
                }
        
        conn.close()
        return {'is_prolonged_stop': False}
    
    def check_dangerous_area(self, latitude, longitude):
        """Verifica se a localização está em uma área de risco"""
        known_risk_areas = [
        ]
        
        for area in known_risk_areas:
            distance = self.calculate_distance(latitude, longitude, area['lat'], area['lon'])
            if distance <= area['radius']:
                return {
                    'is_dangerous': True,
                    'area_name': area['name'],
                    'risk_level': area['risk_level'],
                    'severity': 'critical'
                }
        
        return {'is_dangerous': False}
    
    def predict_destination(self, user_id):
        """Prevê destino com base em padrões de movimento"""
        conn = get_db_connection()
        
        current_hour = datetime.now().hour
        weekday = datetime.now().weekday()
        
        historical_patterns = conn.execute(
            '''SELECT latitude, longitude, COUNT(*) as frequency
               FROM locations 
               WHERE user_id = ? 
               AND CAST(strftime('%H', timestamp) AS INTEGER) = ?
               AND CAST(strftime('%w', timestamp) AS INTEGER) = ?
               AND datetime(timestamp) >= datetime('now', '-30 days')
               GROUP BY ROUND(latitude, 3), ROUND(longitude, 3)
               ORDER BY frequency DESC
               LIMIT 3''',
            (user_id, current_hour, weekday)
        ).fetchall()
        
        recent_location = conn.execute(
            'SELECT latitude, longitude, speed, heading FROM locations WHERE user_id = ? ORDER BY timestamp DESC LIMIT 1',
            (user_id,)
        ).fetchone()
        
        conn.close()
        
        if historical_patterns and len(historical_patterns) > 0:
            most_common = historical_patterns[0]
            
            if recent_location and recent_location['speed'] and recent_location['speed'] > 1:
                distance = self.calculate_distance(
                    recent_location['latitude'],
                    recent_location['longitude'],
                    most_common['latitude'],
                    most_common['longitude']
                )
                
                if distance < 5000:
                    eta_minutes = int((distance / (recent_location['speed'] * 60)) if recent_location['speed'] > 0 else 0)
                    
                    return {
                        'has_prediction': True,
                        'destination_lat': most_common['latitude'],
                        'destination_lon': most_common['longitude'],
                        'confidence': min(most_common['frequency'] / 10, 1.0),
                        'eta_minutes': eta_minutes,
                        'distance_km': round(distance / 1000, 2)
                    }
        
        return {'has_prediction': False}
    
    def get_recent_route(self, user_id, minutes=30):
        """Obtém a rota recente do usuário"""
        conn = get_db_connection()
        
        cutoff_time = datetime.now() - timedelta(minutes=minutes)
        
        route_points = conn.execute(
            '''SELECT latitude, longitude, timestamp, speed, accuracy
               FROM locations 
               WHERE user_id = ? 
               AND datetime(timestamp) >= ?
               ORDER BY timestamp ASC''',
            (user_id, cutoff_time.isoformat())
        ).fetchall()
        
        conn.close()
        
        return [dict(point) for point in route_points]
    
    def suggest_actions(self, user_id, risk_analysis):
        """Sugere ações baseadas na análise de risco"""
        suggestions = []
        
        if risk_analysis.get('abnormal_trajectory', {}).get('is_abnormal'):
            severity = risk_analysis['abnormal_trajectory'].get('severity', 'medium')
            if severity == 'high':
                suggestions.append({
                    'action': 'call_member',
                    'priority': 'high',
                    'description': 'Ligar para o membro para verificar situação'
                })
                suggestions.append({
                    'action': 'alert_emergency_contacts',
                    'priority': 'high',
                    'description': 'Notificar contatos de emergência'
                })
            else:
                suggestions.append({
                    'action': 'send_message',
                    'priority': 'medium',
                    'description': 'Enviar mensagem perguntando se está tudo bem'
                })
        
        if risk_analysis.get('prolonged_stop', {}).get('is_prolonged_stop'):
            suggestions.append({
                'action': 'check_status',
                'priority': 'medium',
                'description': 'Verificar status do membro'
            })
            if risk_analysis['prolonged_stop'].get('minutes', 0) > 60:
                suggestions.append({
                    'action': 'call_member',
                    'priority': 'high',
                    'description': 'Contato urgente recomendado'
                })
        
        if risk_analysis.get('dangerous_area', {}).get('is_dangerous'):
            suggestions.append({
                'action': 'immediate_contact',
                'priority': 'critical',
                'description': 'Área de risco detectada - contato imediato'
            })
            suggestions.append({
                'action': 'activate_local_services',
                'priority': 'high',
                'description': 'Considerar acionar serviços de segurança local'
            })
        
        return suggestions
    
    def analyze_battery_charging(self, user_id, battery_level, is_charging, latitude, longitude):
        """Analisa padrão de carregamento para detectar situações suspeitas"""
        if not is_charging:
            return {'is_suspicious': False}
        
        conn = get_db_connection()
        
        known_charging_locations = conn.execute(
            '''SELECT DISTINCT latitude, longitude, COUNT(*) as frequency
               FROM locations 
               WHERE user_id = ? AND is_charging = 1
               AND datetime(timestamp) >= datetime('now', '-30 days')
               GROUP BY ROUND(latitude, 3), ROUND(longitude, 3)
               HAVING frequency > 3
               ORDER BY frequency DESC''',
            (user_id,)
        ).fetchall()
        
        conn.close()
        
        is_known_location = False
        for loc in known_charging_locations:
            distance = self.calculate_distance(latitude, longitude, loc['latitude'], loc['longitude'])
            if distance < 100:
                is_known_location = True
                break
        
        current_hour = datetime.now().hour
        is_unusual_time = current_hour < 6 or current_hour > 23
        
        if not is_known_location and is_unusual_time:
            return {
                'is_suspicious': True,
                'reason': 'Carregamento em local desconhecido e horário incomum',
                'severity': 'medium'
            }
        
        if not is_known_location:
            return {
                'is_suspicious': True,
                'reason': 'Carregamento em local não habitual',
                'severity': 'low'
            }
        
        return {'is_suspicious': False}

ai_engine = AIProtectionEngine()

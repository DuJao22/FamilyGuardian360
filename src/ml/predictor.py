import numpy as np
from sklearn.cluster import DBSCAN
from sklearn.preprocessing import StandardScaler
from datetime import datetime, timedelta
import pickle
import os

class LocationPredictor:
    def __init__(self):
        self.models_dir = 'ml_models'
        os.makedirs(self.models_dir, exist_ok=True)
        self.scaler = StandardScaler()
    
    def predict_next_location(self, locations, user_id):
        if len(locations) < 5:
            return None
        
        sorted_locs = sorted(locations, key=lambda x: x.get('timestamp', ''))
        
        recent_locs = sorted_locs[-10:]
        
        coords = []
        for loc in recent_locs:
            try:
                lat = float(loc.get('latitude', 0))
                lon = float(loc.get('longitude', 0))
                if lat != 0 and lon != 0:
                    coords.append([lat, lon])
            except (ValueError, TypeError):
                continue
        
        if len(coords) < 2:
            return None
        
        coords_array = np.array(coords)
        
        if len(coords_array) < 2:
            return None
        
        velocity = np.diff(coords_array, axis=0)
        
        if len(velocity) == 0:
            return recent_locs[-1]
        
        avg_velocity = np.mean(velocity, axis=0)
        
        last_location = coords_array[-1]
        predicted = last_location + avg_velocity
        
        return {
            'latitude': float(predicted[0]),
            'longitude': float(predicted[1]),
            'confidence': min(0.8, len(recent_locs) / 20)
        }
    
    def detect_frequent_places(self, locations, user_id, eps=0.001, min_samples=3):
        if len(locations) < min_samples:
            return []
        
        coords = []
        valid_locs = []
        for loc in locations:
            try:
                lat = float(loc.get('latitude', 0))
                lon = float(loc.get('longitude', 0))
                if lat != 0 and lon != 0:
                    coords.append([lat, lon])
                    valid_locs.append(loc)
            except (ValueError, TypeError):
                continue
        
        if len(coords) < min_samples:
            return []
        
        coords_array = np.array(coords)
        locations = valid_locs
        
        clustering = DBSCAN(eps=eps, min_samples=min_samples).fit(coords_array)
        labels = clustering.labels_
        
        frequent_places = []
        for label in set(labels):
            if label == -1:
                continue
            
            cluster_points = coords_array[labels == label]
            center = cluster_points.mean(axis=0)
            
            cluster_locs = [loc for i, loc in enumerate(locations) if labels[i] == label]
            visit_count = len(cluster_locs)
            
            first_visit = min(cluster_locs, key=lambda x: x['timestamp'])
            last_visit = max(cluster_locs, key=lambda x: x['timestamp'])
            
            frequent_places.append({
                'center': {
                    'latitude': float(center[0]),
                    'longitude': float(center[1])
                },
                'visit_count': visit_count,
                'first_visit': first_visit['timestamp'],
                'last_visit': last_visit['timestamp'],
                'radius': float(np.max(np.linalg.norm(cluster_points - center, axis=1)))
            })
        
        return sorted(frequent_places, key=lambda x: x['visit_count'], reverse=True)
    
    def predict_pattern(self, locations, user_id):
        if len(locations) < 10:
            return {
                'pattern': 'insufficient_data',
                'description': 'Dados insuficientes para análise de padrões'
            }
        
        sorted_locs = sorted(locations, key=lambda x: x['timestamp'])
        
        hours = []
        for loc in sorted_locs:
            try:
                dt = datetime.fromisoformat(loc['timestamp'].replace('Z', '+00:00'))
                hours.append(dt.hour)
            except:
                continue
        
        if not hours:
            return {'pattern': 'unknown', 'description': 'Padrão desconhecido'}
        
        morning = sum(1 for h in hours if 6 <= h < 12)
        afternoon = sum(1 for h in hours if 12 <= h < 18)
        evening = sum(1 for h in hours if 18 <= h < 24)
        night = sum(1 for h in hours if 0 <= h < 6)
        
        max_period = max([
            ('morning', morning),
            ('afternoon', afternoon),
            ('evening', evening),
            ('night', night)
        ], key=lambda x: x[1])
        
        period_names = {
            'morning': 'Manhã (6h-12h)',
            'afternoon': 'Tarde (12h-18h)',
            'evening': 'Noite (18h-24h)',
            'night': 'Madrugada (0h-6h)'
        }
        
        return {
            'pattern': max_period[0],
            'description': f'Maior atividade durante: {period_names[max_period[0]]}',
            'distribution': {
                'morning': morning,
                'afternoon': afternoon,
                'evening': evening,
                'night': night
            }
        }
    
    def analyze_movement_speed(self, locations):
        if len(locations) < 2:
            return {'average_speed': 0, 'max_speed': 0, 'classification': 'stationary'}
        
        sorted_locs = sorted(locations, key=lambda x: x.get('timestamp', ''))
        
        speeds = []
        for i in range(len(sorted_locs) - 1):
            loc1 = sorted_locs[i]
            loc2 = sorted_locs[i + 1]
            
            try:
                lat1 = float(loc1.get('latitude', 0))
                lon1 = float(loc1.get('longitude', 0))
                lat2 = float(loc2.get('latitude', 0))
                lon2 = float(loc2.get('longitude', 0))
                
                if lat1 == 0 or lon1 == 0 or lat2 == 0 or lon2 == 0:
                    continue
            except (ValueError, TypeError):
                continue
            
            distance = self._haversine_distance(lat1, lon1, lat2, lon2)
            
            try:
                time1 = datetime.fromisoformat(loc1['timestamp'].replace('Z', '+00:00'))
                time2 = datetime.fromisoformat(loc2['timestamp'].replace('Z', '+00:00'))
                time_diff = (time2 - time1).total_seconds() / 3600
                
                if time_diff > 0:
                    speed = distance / time_diff
                    speeds.append(speed)
            except:
                continue
        
        if not speeds:
            return {'average_speed': 0, 'max_speed': 0, 'classification': 'stationary'}
        
        avg_speed = np.mean(speeds)
        max_speed = np.max(speeds)
        
        if avg_speed < 5:
            classification = 'walking'
        elif avg_speed < 20:
            classification = 'cycling'
        elif avg_speed < 60:
            classification = 'driving'
        else:
            classification = 'fast_vehicle'
        
        return {
            'average_speed': float(avg_speed),
            'max_speed': float(max_speed),
            'classification': classification
        }
    
    def _haversine_distance(self, lat1, lon1, lat2, lon2):
        R = 6371
        
        lat1, lon1, lat2, lon2 = map(np.radians, [lat1, lon1, lat2, lon2])
        
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        
        a = np.sin(dlat/2)**2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon/2)**2
        c = 2 * np.arcsin(np.sqrt(a))
        
        return R * c

location_predictor = LocationPredictor()

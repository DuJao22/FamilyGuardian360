import redis
import json
import os
from functools import wraps
from datetime import timedelta

class CacheManager:
    def __init__(self):
        redis_url = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')
        try:
            self.redis_client = redis.from_url(redis_url, decode_responses=True)
            self.redis_client.ping()
            self.enabled = True
            print(f'✅ Redis cache conectado: {redis_url}')
        except Exception as e:
            print(f'⚠️ Redis não disponível, cache desabilitado: {e}')
            self.enabled = False
            self.redis_client = None
    
    def get(self, key):
        if not self.enabled:
            return None
        try:
            value = self.redis_client.get(key)
            if value:
                return json.loads(value)
            return None
        except Exception as e:
            print(f'❌ Erro ao buscar do cache: {e}')
            return None
    
    def set(self, key, value, ttl=300):
        if not self.enabled:
            return False
        try:
            serialized = json.dumps(value, default=str)
            self.redis_client.setex(key, ttl, serialized)
            return True
        except Exception as e:
            print(f'❌ Erro ao salvar no cache: {e}')
            return False
    
    def delete(self, key):
        if not self.enabled:
            return False
        try:
            self.redis_client.delete(key)
            return True
        except Exception as e:
            print(f'❌ Erro ao deletar do cache: {e}')
            return False
    
    def delete_pattern(self, pattern):
        if not self.enabled:
            return False
        try:
            keys = self.redis_client.keys(pattern)
            if keys:
                self.redis_client.delete(*keys)
            return True
        except Exception as e:
            print(f'❌ Erro ao deletar padrão do cache: {e}')
            return False
    
    def invalidate_user_cache(self, user_id):
        patterns = [
            f'user:{user_id}:*',
            f'family:*:member:{user_id}',
            f'locations:user:{user_id}:*'
        ]
        for pattern in patterns:
            self.delete_pattern(pattern)
    
    def invalidate_family_cache(self, family_id):
        patterns = [
            f'family:{family_id}:*',
            f'messages:family:{family_id}:*'
        ]
        for pattern in patterns:
            self.delete_pattern(pattern)

cache_manager = CacheManager()

def cached(ttl=300, key_prefix=''):
    """
    Cache decorator for pure data functions.
    WARNING: Do NOT use on Flask route handlers (they return Response objects).
    Only use on helper functions that return JSON-serializable data.
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            if not cache_manager.enabled:
                return func(*args, **kwargs)
            
            cache_key = f'{key_prefix}:{func.__name__}:{str(args)}:{str(kwargs)}'
            
            cached_value = cache_manager.get(cache_key)
            if cached_value is not None:
                return cached_value
            
            result = func(*args, **kwargs)
            
            try:
                json.dumps(result, default=str)
                cache_manager.set(cache_key, result, ttl)
            except (TypeError, ValueError):
                pass
            
            return result
        
        return wrapper
    return decorator

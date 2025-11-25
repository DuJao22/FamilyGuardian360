import logging
import sys
from datetime import datetime
from logging.handlers import RotatingFileHandler
import os

LOG_DIR = 'logs'
os.makedirs(LOG_DIR, exist_ok=True)

class ColoredFormatter(logging.Formatter):
    COLORS = {
        'DEBUG': '\033[36m',
        'INFO': '\033[32m', 
        'WARNING': '\033[33m',
        'ERROR': '\033[31m',
        'CRITICAL': '\033[35m',
        'RESET': '\033[0m'
    }
    
    ICONS = {
        'DEBUG': '🔍',
        'INFO': '✅',
        'WARNING': '⚠️',
        'ERROR': '❌',
        'CRITICAL': '🔥'
    }
    
    def format(self, record):
        log_color = self.COLORS.get(record.levelname, self.COLORS['RESET'])
        icon = self.ICONS.get(record.levelname, '')
        reset = self.COLORS['RESET']
        
        record.levelname_colored = f'{log_color}{icon} {record.levelname}{reset}'
        record.name_colored = f'{log_color}{record.name}{reset}'
        
        return super().format(record)

def setup_logger(name, level=logging.INFO):
    logger = logging.getLogger(name)
    logger.setLevel(level)
    
    if logger.hasHandlers():
        return logger
    
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)
    
    console_formatter = ColoredFormatter(
        '%(asctime)s - %(levelname_colored)s - %(name_colored)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    console_handler.setFormatter(console_formatter)
    
    file_handler = RotatingFileHandler(
        os.path.join(LOG_DIR, f'{name}.log'),
        maxBytes=10*1024*1024,
        backupCount=5
    )
    file_handler.setLevel(level)
    
    file_formatter = logging.Formatter(
        '%(asctime)s - %(levelname)s - %(name)s - %(funcName)s:%(lineno)d - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    file_handler.setFormatter(file_formatter)
    
    logger.addHandler(console_handler)
    logger.addHandler(file_handler)
    
    return logger

app_logger = setup_logger('family_guardian', logging.INFO)
db_logger = setup_logger('database', logging.INFO)
ai_logger = setup_logger('ai_engine', logging.INFO)
cache_logger = setup_logger('cache', logging.INFO)
webhook_logger = setup_logger('webhooks', logging.INFO)

def log_request(logger, request, user_id=None):
    logger.info(f'{request.method} {request.path} - User: {user_id} - IP: {request.remote_addr}')

def log_error(logger, error, context=''):
    logger.error(f'{context} - Error: {str(error)}', exc_info=True)

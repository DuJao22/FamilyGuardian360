"""
Family Guardian 360° - Advanced Encryption System
Sistema de Criptografia Avançada com AES-256
Desenvolvido por: João Layon - Desenvolvedor Full Stack
"""

import base64
import hashlib
import secrets
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import padding

class AdvancedEncryption:
    """
    Sistema de criptografia avançada usando AES-256
    Simula conceitos de criptografia militar de alta segurança
    """
    
    def __init__(self):
        self.backend = default_backend()
        self.block_size = 128
    
    def generate_key(self, passphrase=None):
        """Gera uma chave AES-256 segura"""
        if passphrase:
            return hashlib.sha256(passphrase.encode()).digest()
        return secrets.token_bytes(32)
    
    def encrypt_data(self, data, key):
        """
        Criptografa dados usando AES-256-CBC
        
        Args:
            data: Dados a serem criptografados (string)
            key: Chave de 256 bits
        
        Returns:
            String base64 com IV + dados criptografados
        """
        if isinstance(data, str):
            data = data.encode('utf-8')
        
        iv = secrets.token_bytes(16)
        
        cipher = Cipher(
            algorithms.AES(key),
            modes.CBC(iv),
            backend=self.backend
        )
        encryptor = cipher.encryptor()
        
        padder = padding.PKCS7(self.block_size).padder()
        padded_data = padder.update(data) + padder.finalize()
        
        encrypted = encryptor.update(padded_data) + encryptor.finalize()
        
        return base64.b64encode(iv + encrypted).decode('utf-8')
    
    def decrypt_data(self, encrypted_data, key):
        """
        Descriptografa dados AES-256-CBC
        
        Args:
            encrypted_data: String base64 com IV + dados
            key: Chave de 256 bits
        
        Returns:
            Dados descriptografados
        """
        try:
            encrypted_bytes = base64.b64decode(encrypted_data)
            
            iv = encrypted_bytes[:16]
            ciphertext = encrypted_bytes[16:]
            
            cipher = Cipher(
                algorithms.AES(key),
                modes.CBC(iv),
                backend=self.backend
            )
            decryptor = cipher.decryptor()
            
            decrypted_padded = decryptor.update(ciphertext) + decryptor.finalize()
            
            unpadder = padding.PKCS7(self.block_size).unpadder()
            data = unpadder.update(decrypted_padded) + unpadder.finalize()
            
            return data.decode('utf-8')
        except Exception as e:
            raise ValueError(f"Erro ao descriptografar: {str(e)}")
    
    def encrypt_location_data(self, latitude, longitude, user_key):
        """Criptografa dados de localização"""
        location_str = f"{latitude},{longitude}"
        return self.encrypt_data(location_str, user_key)
    
    def decrypt_location_data(self, encrypted_location, user_key):
        """Descriptografa dados de localização"""
        try:
            decrypted = self.decrypt_data(encrypted_location, user_key)
            lat, lon = decrypted.split(',')
            return {'latitude': float(lat), 'longitude': float(lon)}
        except:
            return None
    
    def hash_sensitive_data(self, data):
        """
        Cria hash irreversível de dados sensíveis
        Útil para verificação sem armazenar dados originais
        """
        return hashlib.sha256(data.encode()).hexdigest()
    
    def generate_session_token(self):
        """Gera token de sessão seguro"""
        return secrets.token_urlsafe(32)

encryption_engine = AdvancedEncryption()

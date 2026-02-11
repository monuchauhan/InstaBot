import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from app.core.config import settings


def get_fernet_key() -> bytes:
    """Derive a Fernet key from the encryption key."""
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"instabot-salt-v1",  # In production, use a unique salt per encryption
        iterations=100000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(settings.ENCRYPTION_KEY.encode()))
    return key


fernet = Fernet(get_fernet_key())


def encrypt_token(token: str) -> str:
    """Encrypt a token for secure storage."""
    encrypted = fernet.encrypt(token.encode())
    return base64.urlsafe_b64encode(encrypted).decode()


def decrypt_token(encrypted_token: str) -> str:
    """Decrypt a stored token."""
    encrypted = base64.urlsafe_b64decode(encrypted_token.encode())
    decrypted = fernet.decrypt(encrypted)
    return decrypted.decode()

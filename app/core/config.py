"""
Configuración central del proyecto.
Lee variables de entorno desde el archivo .env
"""
from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # MongoDB
    MONGO_URI: str
    MONGO_DB_NAME: str = "friotech"

    # JWT
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 días

    # Firebase Cloud Messaging
    FCM_CREDENTIALS_PATH: str = "firebase-credentials.json"
    FCM_CREDENTIALS_JSON: Optional[str] = None

    # CORS
    # Ejemplos:
    # CORS_ORIGINS="*"
    # CORS_ORIGINS="https://friotech-frontend.onrender.com,http://localhost:5173"
    CORS_ORIGINS: str = "*"

    # General
    ENV: str = "development"
    DIAS_PROXIMO_MANTENIMIENTO: int = 100

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

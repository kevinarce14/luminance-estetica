# app/core/config.py
from dataclasses import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
from functools import lru_cache

#En Pydantic v2, no usas el parámetro env en Field(). 
# En su lugar, simplemente defines la variable y Pydantic automáticamente busca la variable de entorno con ese nombre


class Settings(BaseSettings):
    """
    Configuración de la aplicación.
    Lee variables de entorno desde .env
    """
    
    # ========== APP ==========
    APP_NAME: str = "Luminance Estética API"
    APP_VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    
    # ========== DATABASE ==========
    DATABASE_URL: str
    SCHEMA_NAME: str = "luminance-estetica"
    
    # ========== SECURITY ==========
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 horas
    
    # ========== EMAIL ==========
    EMAIL_SERVICE: str = "sendgrid"  # "sendgrid" o "resend"
    SENDGRID_API_KEY: str | None = None
    RESEND_API_KEY: str | None = None
    FROM_EMAIL: str = "noreply@luminancestudio.com"
    FROM_NAME: str = "Luminance Studio by Cande"
    STUDIO_EMAIL: str = "info@luminancestudio.com"
    ADMIN_EMAIL: str
    
    # ========== WHATSAPP (Twilio) ==========
    TWILIO_ACCOUNT_SID: str | None = None
    TWILIO_AUTH_TOKEN: str | None = None
    TWILIO_WHATSAPP_NUMBER: str | None = None
    STUDIO_WHATSAPP_NUMBER: str | None = None
    
    # ========== MERCADOPAGO ==========
    MERCADOPAGO_ACCESS_TOKEN: str
    MERCADOPAGO_PUBLIC_KEY: str | None = None
    FRONTEND_URL: str = "http://localhost:5000"
    PAYMENT_SUCCESS_URL: str = "http://localhost:3000/pago-exitoso"
    PAYMENT_FAILURE_URL: str = "http://localhost:3000/pago-fallido"
    PAYMENT_PENDING_URL: str = "http://localhost:3000/pago-pendiente"
    
    # ========== CORS ==========
    CORS_ORIGINS: str = "https://luminance-estetica.vercel.app"
    # DESPUÉS (agregá tu dominio de Vercel):
    #CORS_ORIGINS: str = "https://tu-proyecto.vercel.app,http://localhost:5000,http://localhost:3000
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Convierte el string de CORS_ORIGINS en una lista"""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
    
    # ========== BUSINESS SETTINGS ==========
    TIMEZONE: str = "America/Argentina/Buenos_Aires"
    BUSINESS_HOURS_START: str = "09:00"
    BUSINESS_HOURS_END: str = "20:00"
    BUSINESS_DAYS: str = "1,2,3,4,5,6"  # Martes a Sábado
    MIN_APPOINTMENT_DURATION: int = 30  # minutos
    MIN_BOOKING_ADVANCE_HOURS: int = 2
    MAX_BOOKING_ADVANCE_DAYS: int = 30
    
    @property
    def business_days_list(self) -> List[int]:
        """Convierte BUSINESS_DAYS en lista de enteros"""
        return [int(day.strip()) for day in self.BUSINESS_DAYS.split(",")]
    
    # ========== NOTIFICATIONS ==========
    SEND_EMAIL_REMINDERS: bool = True
    SEND_WHATSAPP_REMINDERS: bool = True
    REMINDER_HOURS_BEFORE: int = 24
    
    # ========== ADMIN INICIAL ==========
    INITIAL_ADMIN_EMAIL: str = "admin@luminancestudio.com"
    INITIAL_ADMIN_PASSWORD: str = "ChangeThisPassword123!"
    INITIAL_ADMIN_NAME: str = "Admin"
    
    # ========== RATE LIMITING ==========
    RATE_LIMIT_PER_MINUTE: int = 100
    RATE_LIMIT_PER_HOUR: int = 1000
    
    # ========== REDIS (Para Celery - opcional) ==========
    REDIS_URL: str | None = None
    
    # ========== SENTRY (Error tracking - opcional) ==========
    SENTRY_DSN: str | None = None
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"  # Ignora variables extra en el .env
    )


@lru_cache()
def get_settings() -> Settings:
    """
    Retorna una instancia cacheada de Settings.
    lru_cache evita leer el .env múltiples veces.
    """
    return Settings()


# Instancia global de settings
settings = get_settings()

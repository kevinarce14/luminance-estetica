# app/core/time_utils.py
"""
Helpers de fecha/hora.

Convención del sistema:
- La base de datos guarda los turnos en UTC *sin* timezone (naive).
- El studio opera en hora de Argentina (settings.TIMEZONE).
- Las respuestas de la API siempre exponen datetimes en UTC con offset.
"""

from datetime import date, datetime, time, timedelta, timezone
from typing import Optional, Tuple
from zoneinfo import ZoneInfo

from app.core.config import settings

STUDIO_TZ = ZoneInfo(settings.TIMEZONE)


def utc_now() -> datetime:
    """Ahora en UTC (aware)."""
    return datetime.now(timezone.utc)


def utc_now_naive() -> datetime:
    """Ahora en UTC sin timezone, para comparar contra columnas naive de la BD."""
    return utc_now().replace(tzinfo=None)


def to_utc(value: datetime) -> datetime:
    """Normaliza a UTC aware. Un datetime naive se interpreta como UTC (convención de la BD)."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def to_utc_optional(value: Optional[datetime]) -> Optional[datetime]:
    return None if value is None else to_utc(value)


def to_utc_naive(value: datetime) -> datetime:
    """UTC sin timezone, formato en el que se guarda en la BD."""
    return to_utc(value).replace(tzinfo=None)


def to_studio_time(value: datetime) -> datetime:
    """Convierte a la hora del studio para mostrar (emails, WhatsApp). Naive = UTC."""
    return to_utc(value).astimezone(STUDIO_TZ)


def studio_today() -> date:
    """Fecha actual en el studio."""
    return datetime.now(STUDIO_TZ).date()


def studio_day_start_utc(day: date) -> datetime:
    """Medianoche del día `day` en el studio, expresada en UTC naive."""
    return datetime.combine(day, time.min, tzinfo=STUDIO_TZ).astimezone(timezone.utc).replace(tzinfo=None)


def studio_day_range_utc(day: date) -> Tuple[datetime, datetime]:
    """[inicio, fin) del día `day` del studio, en UTC naive."""
    return studio_day_start_utc(day), studio_day_start_utc(day + timedelta(days=1))

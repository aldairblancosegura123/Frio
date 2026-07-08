"""
MongoDB no soporta el tipo `datetime.date` (solo `datetime.datetime`).
Estas funciones convierten de forma consistente entre lo que usan
nuestros modelos Pydantic (date, más natural para "fecha sin hora")
y lo que MongoDB necesita para guardar (datetime).
"""
from datetime import date, datetime, timedelta, timezone
from typing import Optional


def date_a_datetime(valor: Optional[date]) -> Optional[datetime]:
    """Convierte un date a datetime a medianoche UTC, para poder guardarlo en Mongo."""
    if valor is None:
        return None
    if isinstance(valor, datetime):
        return valor
    return datetime(valor.year, valor.month, valor.day, tzinfo=timezone.utc)


def datetime_a_date(valor) -> Optional[date]:
    """Convierte de vuelta lo que venga de Mongo (datetime) a date, para los modelos Pydantic."""
    if valor is None:
        return None
    if isinstance(valor, datetime):
        return valor.date()
    return valor  # ya es date o viene en otro formato compatible


def normalizar_fechas_equipo(documento: dict) -> dict:
    """
    Convierte los tres campos de fecha de un documento de equipo
    (leído de Mongo) de datetime a date, listos para los modelos Pydantic.
    """
    documento = dict(documento)  # copia para no mutar el original
    for campo in ("fecha_instalacion", "fecha_mantenimiento", "fecha_proximo_mantenimiento"):
        if campo in documento:
            documento[campo] = datetime_a_date(documento[campo])
    # Asegurar que la clave `notas` exista (evita errores al convertir a modelos)
    if 'notas' not in documento:
        documento['notas'] = None
    return documento


def _normalizar_estado(estado: str) -> str:
    if not isinstance(estado, str):
        return estado
    value = estado.strip().lower()
    if value in {"revision", "revisión", "en_revision", "en revisión", "requiere_mantenimiento", "requiere mantenimiento"}:
        return "en_revision"
    if value in {"averiado", "fuera_de_servicio", "fuera de servicio", "roto", "dañado", "dañado"}:
        return "fuera_de_servicio"
    if value in {"operativo", "operational", "operación", "operacion"}:
        return "operativo"
    return estado


def normalizar_estado_equipo(documento: dict) -> dict:
    documento = dict(documento)
    if "estado" in documento:
        documento["estado"] = _normalizar_estado(documento["estado"])
    return documento
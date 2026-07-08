"""
Modelos relacionados al Equipo (hoja de vida del aire acondicionado).
"""
from datetime import date, datetime, timedelta
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict, computed_field

from app.models.py_object_id import PyObjectId
from app.core.config import settings


class EstadoEquipo(str, Enum):
    operativo = "operativo"
    en_revision = "en_revision"
    requiere_mantenimiento = "requiere_mantenimiento"
    fuera_de_servicio = "fuera_de_servicio"


class EquipoCrear(BaseModel):
    """
    Datos para registrar un equipo nuevo.
    Si fecha_instalacion viene, se calcula fecha_proximo_mantenimiento automáticamente.
    """
    id_cliente: str
    marca: str
    btus: int
    presion: Optional[float] = None
    amperaje: Optional[float] = None
    voltaje: Optional[float] = None
    estado: EstadoEquipo = EstadoEquipo.operativo
    fecha_instalacion: Optional[date] = None
    fecha_mantenimiento: Optional[date] = None
    notas: Optional[str] = None


class EquipoUpdate(BaseModel):
    """
    Para registrar un nuevo mantenimiento o actualizar mediciones.
    Al enviar fecha_mantenimiento, se recalcula fecha_proximo_mantenimiento.
    """
    marca: Optional[str] = None
    btus: Optional[int] = None
    presion: Optional[float] = None
    amperaje: Optional[float] = None
    voltaje: Optional[float] = None
    estado: Optional[EstadoEquipo] = None
    fecha_mantenimiento: Optional[date] = None
    notas: Optional[str] = None


class EquipoEnDB(BaseModel):
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)

    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    id_cliente: PyObjectId
    id_tecnico: PyObjectId  # técnico que instaló o hizo el último mantenimiento
    id_tecnico_instalacion: Optional[PyObjectId] = None
    id_tecnico_ultimo_mantenimiento: Optional[PyObjectId] = None

    marca: str
    btus: int
    presion: Optional[float] = None
    amperaje: Optional[float] = None
    voltaje: Optional[float] = None
    estado: EstadoEquipo = EstadoEquipo.operativo

    fecha_instalacion: Optional[date] = None
    fecha_mantenimiento: Optional[date] = None
    fecha_proximo_mantenimiento: Optional[date] = None
    notas: Optional[str] = None

    notificaciones_enviadas: list[str] = Field(default_factory=list)
    # guarda algo como ["7_dias", "3_dias", "1_dia"] para no repetir el envío

    creado_en: datetime = Field(default_factory=datetime.utcnow)
    actualizado_en: datetime = Field(default_factory=datetime.utcnow)

    @staticmethod
    def calcular_proximo_mantenimiento(
        fecha_instalacion: Optional[date], fecha_mantenimiento: Optional[date]
    ) -> Optional[date]:
        """
        Regla de negocio:
        fecha_proximo_mantenimiento = (fecha_mantenimiento o fecha_instalacion) + 100 días
        Si hay fecha_mantenimiento, esa tiene prioridad (es la más reciente).
        """
        base = fecha_mantenimiento or fecha_instalacion
        if base is None:
            return None
        return base + timedelta(days=settings.DIAS_PROXIMO_MANTENIMIENTO)


class EquipoPublico(BaseModel):
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)

    id: PyObjectId = Field(alias="_id")
    id_cliente: PyObjectId
    id_tecnico: PyObjectId
    id_tecnico_instalacion: Optional[PyObjectId] = None
    id_tecnico_ultimo_mantenimiento: Optional[PyObjectId] = None

    marca: str
    btus: int
    presion: Optional[float] = None
    amperaje: Optional[float] = None
    voltaje: Optional[float] = None
    estado: EstadoEquipo

    fecha_instalacion: Optional[date] = None
    fecha_mantenimiento: Optional[date] = None
    fecha_proximo_mantenimiento: Optional[date] = None

    notas: str | None = None

    @computed_field
    @property
    def mantenimiento_vencido(self) -> bool:
        """True si la fecha_proximo_mantenimiento ya pasó (para la alerta roja del cliente)."""
        if self.fecha_proximo_mantenimiento is None:
            return False
        return date.today() > self.fecha_proximo_mantenimiento

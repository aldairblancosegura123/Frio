"""
Modelos relacionados a las Solicitudes que hace el cliente.
"""
from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict

from app.models.py_object_id import PyObjectId


class TipoSolicitud(str, Enum):
    instalacion = "instalacion"
    revision = "revision"


class PrioridadSolicitud(str, Enum):
    urgente = "urgente"   # notificación roja
    normal = "normal"     # notificación azul hielo


class EstadoSolicitud(str, Enum):
    pendiente = "pendiente"
    aceptada = "aceptada"
    rechazada = "rechazada"
    completada = "completada"


class SolicitudCrear(BaseModel):
    tipo: TipoSolicitud
    id_tecnico: str  # técnico elegido de la lista de recomendados
    id_equipo: Optional[str] = None  # requerido si tipo == revision
    prioridad: PrioridadSolicitud = PrioridadSolicitud.normal
    nota: Optional[str] = None
    descripcion: Optional[str] = None


class SolicitudUpdateEstado(BaseModel):
    estado: EstadoSolicitud
    motivo_rechazo: Optional[str] = None
    nota_accion: Optional[str] = None


class SolicitudAgendar(BaseModel):
    fecha_agendada: datetime


class HistorialAccionSolicitud(BaseModel):
    accion: str
    estado: EstadoSolicitud
    nota: Optional[str] = None
    fecha: datetime = Field(default_factory=datetime.utcnow)


class SolicitudEnDB(BaseModel):
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)

    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    tipo: TipoSolicitud
    id_cliente: PyObjectId
    id_tecnico: PyObjectId
    id_equipo: Optional[PyObjectId] = None
    prioridad: PrioridadSolicitud
    estado: EstadoSolicitud = EstadoSolicitud.pendiente
    fecha_agendada: Optional[datetime] = None
    motivo_rechazo: Optional[str] = None
    nota: Optional[str] = None
    historial_acciones: list[HistorialAccionSolicitud] = Field(default_factory=list)
    descripcion: Optional[str] = None
    creado_en: datetime = Field(default_factory=datetime.utcnow)


class SolicitudPublica(BaseModel):
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)

    id: PyObjectId = Field(alias="_id")
    tipo: TipoSolicitud
    id_cliente: PyObjectId
    id_tecnico: PyObjectId
    id_equipo: Optional[PyObjectId] = None
    prioridad: PrioridadSolicitud
    estado: EstadoSolicitud
    fecha_agendada: Optional[datetime] = None
    motivo_rechazo: Optional[str] = None
    nota: Optional[str] = None
    historial_acciones: list[HistorialAccionSolicitud] = Field(default_factory=list)
    descripcion: Optional[str] = None
    creado_en: datetime

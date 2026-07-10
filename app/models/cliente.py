"""
Modelos relacionados al Cliente.
El cliente NO se autorregistra; lo crea el técnico.
"""
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from app.models.py_object_id import PyObjectId


class ClienteCrear(BaseModel):
    """Datos que envía el técnico para crear la hoja de vida del cliente."""
    nombre: str
    cedula: str
    telefono: str
    direccion: Optional[str] = None


class ClienteUpdate(BaseModel):
    nombre: Optional[str] = None
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    fcm_token: Optional[str] = None


class ClienteEnDB(BaseModel):
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)

    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    nombre: str
    cedula: str
    telefono: str
    direccion: Optional[str] = None
    fcm_token: Optional[str] = None
    id_tecnico_registro: PyObjectId  # quién lo registró originalmente


class ClientePublico(BaseModel):
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)

    id: PyObjectId = Field(alias="_id")
    nombre: str
    cedula: str
    telefono: str
    direccion: Optional[str] = None


class ClienteLogin(BaseModel):
    """El cliente ingresa con cédula o teléfono."""
    cedula: str

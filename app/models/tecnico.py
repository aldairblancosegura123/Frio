"""
Modelos relacionados al Técnico.
"""
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from app.models.py_object_id import PyObjectId


class TecnicoRegistro(BaseModel):
    """Datos que llegan del formulario de registro."""
    nombres: str
    apellidos: str
    cedula: str
    telefono: str
    password: str = Field(min_length=6, max_length=72)
    foto_perfil_url: Optional[str] = None


class TecnicoLogin(BaseModel):
    cedula: str
    password: str = Field(min_length=1, max_length=72)


class TecnicoUpdate(BaseModel):
    """Campos editables del perfil (todos opcionales)."""
    nombres: Optional[str] = None
    apellidos: Optional[str] = None
    telefono: Optional[str] = None
    foto_perfil_url: Optional[str] = None
    fcm_token: Optional[str] = None


class TecnicoEnDB(BaseModel):
    """Representación interna, incluye el hash de la contraseña."""
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)

    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    nombres: str
    apellidos: str
    cedula: str
    telefono: str
    password_hash: str
    foto_perfil_url: Optional[str] = None
    fcm_token: Optional[str] = None
    calificacion_promedio: float = 0.0
    total_calificaciones: int = 0


class TecnicoPublico(BaseModel):
    """Lo que se devuelve al frontend, sin la contraseña."""
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)

    id: PyObjectId = Field(alias="_id")
    nombres: str
    apellidos: str
    cedula: str
    telefono: str
    foto_perfil_url: Optional[str] = None
    calificacion_promedio: float = 0.0
    total_calificaciones: int = 0


class TecnicoToken(BaseModel):
    access_token: str
    token_type: str = "bearer"
    tecnico: TecnicoPublico

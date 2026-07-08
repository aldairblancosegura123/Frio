"""
Modelos relacionados a las Calificaciones que el cliente da al técnico.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict, field_validator

from app.models.py_object_id import PyObjectId


class CalificacionCrear(BaseModel):
    id_tecnico: str
    puntaje: int  # 1 a 5
    comentario: Optional[str] = None

    @field_validator("puntaje")
    @classmethod
    def validar_puntaje(cls, v: int) -> int:
        if v < 1 or v > 5:
            raise ValueError("El puntaje debe estar entre 1 y 5")
        return v


class CalificacionEnDB(BaseModel):
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)

    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    id_tecnico: PyObjectId
    id_cliente: PyObjectId
    puntaje: int
    comentario: Optional[str] = None
    creado_en: datetime = Field(default_factory=datetime.utcnow)

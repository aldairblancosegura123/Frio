"""
Endpoints para que cada app (técnico y cliente) registre su token FCM
una vez el usuario acepta permisos de notificaciones en el navegador/dispositivo.
"""
from fastapi import APIRouter, Depends
from bson import ObjectId
from pydantic import BaseModel

from app.core.database import tecnicos_collection, clientes_collection
from app.core.security import get_tecnico_actual_id, get_cliente_actual_id

router = APIRouter(tags=["FCM Tokens"])


class FcmTokenBody(BaseModel):
    fcm_token: str


@router.post("/api/tecnico/fcm-token")
async def guardar_fcm_token_tecnico(
    datos: FcmTokenBody, tecnico_id: str = Depends(get_tecnico_actual_id)
):
    await tecnicos_collection.update_one(
        {"_id": ObjectId(tecnico_id)}, {"$set": {"fcm_token": datos.fcm_token}}
    )
    return {"mensaje": "Token FCM actualizado"}


@router.post("/api/cliente/fcm-token")
async def guardar_fcm_token_cliente(
    datos: FcmTokenBody, cliente_id: str = Depends(get_cliente_actual_id)
):
    await clientes_collection.update_one(
        {"_id": ObjectId(cliente_id)}, {"$set": {"fcm_token": datos.fcm_token}}
    )
    return {"mensaje": "Token FCM actualizado"}

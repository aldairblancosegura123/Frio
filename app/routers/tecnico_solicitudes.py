"""
Rutas del técnico para ver y gestionar las solicitudes que le llegan.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId

from app.core.database import solicitudes_collection, clientes_collection, tecnicos_collection
from app.core.security import get_tecnico_actual_id
from app.models.solicitud import SolicitudPublica, SolicitudUpdateEstado, SolicitudAgendar
from app.services.notificaciones import (
    notificar_solicitud_agendada,
    notificar_solicitud_completada,
    notificar_solicitud_rechazada,
)

router = APIRouter(prefix="/api/tecnico/solicitudes", tags=["Técnico - Solicitudes"])


_estado_order = {
    "pendiente": 0,
    "aceptada": 1,
    "rechazada": 2,
    "completada": 3,
}

@router.get("/", response_model=list[SolicitudPublica])
async def listar_solicitudes_recibidas(tecnico_id: str = Depends(get_tecnico_actual_id)):
    """
    Lista las solicitudes que le han hecho a este técnico,
    las más recientes y urgentes primero.
    """
    cursor = solicitudes_collection.find({"id_tecnico": ObjectId(tecnico_id)}).sort(
        [("estado", 1), ("prioridad", 1), ("creado_en", -1)]
    )
    solicitudes = await cursor.to_list(length=200)
    return [SolicitudPublica(**s) for s in solicitudes]


@router.get("/{solicitud_id}", response_model=SolicitudPublica)
async def obtener_solicitud_por_id(
    solicitud_id: str,
    tecnico_id: str = Depends(get_tecnico_actual_id),
):
    if not ObjectId.is_valid(solicitud_id):
        raise HTTPException(status_code=400, detail="ID de solicitud inválido")

    solicitud = await solicitudes_collection.find_one(
        {"_id": ObjectId(solicitud_id), "id_tecnico": ObjectId(tecnico_id)}
    )
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    return SolicitudPublica(**solicitud)


@router.patch("/{solicitud_id}/estado", response_model=SolicitudPublica)
async def actualizar_estado_solicitud(
    solicitud_id: str,
    datos: SolicitudUpdateEstado,
    tecnico_id: str = Depends(get_tecnico_actual_id),
):
    """
    El técnico acepta, rechaza o marca como completada una solicitud
    una vez se pone en contacto con el cliente.
    """
    if not ObjectId.is_valid(solicitud_id):
        raise HTTPException(status_code=400, detail="ID de solicitud inválido")

    nota_accion = (datos.nota_accion or "").strip()
    if datos.estado == "completada" and not nota_accion:
        raise HTTPException(status_code=400, detail="Debes ingresar una nota para marcar como completada")

    historial_entry = {
        "accion": f"estado_{datos.estado.value}",
        "estado": datos.estado,
        "nota": nota_accion or None,
        "fecha": datetime.now(timezone.utc),
    }

    update_doc: dict = {
        "$set": {"estado": datos.estado},
        "$push": {"historial_acciones": historial_entry},
    }
    if datos.estado == "rechazada":
        update_doc["$set"]["motivo_rechazo"] = (datos.motivo_rechazo or "").strip() or None
    else:
        update_doc["$unset"] = {"motivo_rechazo": ""}

    resultado = await solicitudes_collection.find_one_and_update(
        {"_id": ObjectId(solicitud_id), "id_tecnico": ObjectId(tecnico_id)},
        update_doc,
        return_document=True,
    )
    if not resultado:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    if datos.estado == "rechazada":
        cliente = await clientes_collection.find_one({"_id": resultado.get("id_cliente")})
        tecnico = await tecnicos_collection.find_one({"_id": ObjectId(tecnico_id)})
        if cliente and tecnico:
            await notificar_solicitud_rechazada(
                cliente=cliente,
                tecnico=tecnico,
                solicitud=resultado,
                motivo_rechazo=resultado.get("motivo_rechazo"),
            )

    if datos.estado == "completada":
        cliente = await clientes_collection.find_one({"_id": resultado.get("id_cliente")})
        tecnico = await tecnicos_collection.find_one({"_id": ObjectId(tecnico_id)})
        if cliente and tecnico:
            await notificar_solicitud_completada(
                cliente=cliente,
                tecnico=tecnico,
                solicitud=resultado,
            )

    return SolicitudPublica(**resultado)


@router.patch("/{solicitud_id}/agendar", response_model=SolicitudPublica)
async def agendar_solicitud(
    solicitud_id: str,
    datos: SolicitudAgendar,
    tecnico_id: str = Depends(get_tecnico_actual_id),
):
    """
    El técnico acepta y agenda una solicitud asignándole fecha/hora.
    """
    if not ObjectId.is_valid(solicitud_id):
        raise HTTPException(status_code=400, detail="ID de solicitud inválido")

    fecha_agendada = datos.fecha_agendada
    if fecha_agendada.tzinfo is None:
        fecha_agendada = fecha_agendada.replace(tzinfo=timezone.utc)

    resultado = await solicitudes_collection.find_one_and_update(
        {"_id": ObjectId(solicitud_id), "id_tecnico": ObjectId(tecnico_id)},
        {
            "$set": {
                "estado": "aceptada",
                "fecha_agendada": fecha_agendada,
            },
            "$push": {
                "historial_acciones": {
                    "accion": "agendada",
                    "estado": "aceptada",
                    "nota": f"Agendada para {fecha_agendada.astimezone(timezone.utc).isoformat()}",
                    "fecha": datetime.now(timezone.utc),
                }
            },
        },
        return_document=True,
    )
    if not resultado:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    cliente = await clientes_collection.find_one({"_id": resultado.get("id_cliente")})
    tecnico = await tecnicos_collection.find_one({"_id": ObjectId(tecnico_id)})
    if cliente and tecnico:
        await notificar_solicitud_agendada(
            cliente=cliente,
            tecnico=tecnico,
            solicitud=resultado,
            fecha_agendada_iso=fecha_agendada.astimezone(timezone.utc).isoformat(),
        )

    return SolicitudPublica(**resultado)

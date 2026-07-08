"""
Rutas del cliente para crear solicitudes (instalación o revisión).
Aquí se decide la prioridad (urgente/normal) que determina el color
de la notificación push que recibirá el técnico.
"""
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId

from app.core.database import solicitudes_collection, tecnicos_collection
from app.core.security import get_cliente_actual_id
from app.models.solicitud import SolicitudCrear, SolicitudPublica, TipoSolicitud
from app.services.notificaciones import notificar_nueva_solicitud

router = APIRouter(prefix="/api/cliente/solicitudes", tags=["Cliente - Solicitudes"])


@router.post("/", response_model=SolicitudPublica, status_code=201)
async def crear_solicitud(
    datos: SolicitudCrear, cliente_id: str = Depends(get_cliente_actual_id)
):
    if not ObjectId.is_valid(datos.id_tecnico):
        raise HTTPException(status_code=400, detail="ID de técnico inválido")

    tecnico = await tecnicos_collection.find_one({"_id": ObjectId(datos.id_tecnico)})
    if not tecnico:
        raise HTTPException(status_code=404, detail="Técnico no encontrado")

    if datos.tipo == TipoSolicitud.revision and not datos.id_equipo:
        raise HTTPException(
            status_code=400,
            detail="Para una solicitud de revisión debes indicar el equipo (id_equipo)",
        )

    nueva_solicitud = {
        "tipo": datos.tipo,
        "id_cliente": ObjectId(cliente_id),
        "id_tecnico": ObjectId(datos.id_tecnico),
        "id_equipo": ObjectId(datos.id_equipo) if datos.id_equipo else None,
        "prioridad": datos.prioridad,
        "estado": "pendiente",
        "nota": datos.nota or datos.descripcion,
        "descripcion": datos.descripcion,
        "creado_en": datetime.utcnow(),
    }

    resultado = await solicitudes_collection.insert_one(nueva_solicitud)
    nueva_solicitud["_id"] = resultado.inserted_id

    # Notificación push al técnico (roja si es urgente, azul hielo si es normal)
    await notificar_nueva_solicitud(tecnico, nueva_solicitud)

    return SolicitudPublica(**nueva_solicitud)


@router.get("/", response_model=list[SolicitudPublica])
async def listar_mis_solicitudes(cliente_id: str = Depends(get_cliente_actual_id)):
    cursor = solicitudes_collection.find({"id_cliente": ObjectId(cliente_id)}).sort(
        "creado_en", -1
    )
    solicitudes = await cursor.to_list(length=200)
    return [SolicitudPublica(**s) for s in solicitudes]
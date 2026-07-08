"""
Rutas del técnico para gestionar equipos (hoja de vida del aire acondicionado).
Aquí vive la lógica de cálculo de fecha_proximo_mantenimiento.
"""
from fastapi import APIRouter, HTTPException, status, Depends
from bson import ObjectId
from datetime import datetime

from app.core.database import equipos_collection, clientes_collection
from app.core.security import get_tecnico_actual_id
from app.core.mongo_utils import (
    date_a_datetime,
    normalizar_fechas_equipo,
    normalizar_estado_equipo,
)
from app.models.equipo import EquipoCrear, EquipoUpdate, EquipoEnDB, EquipoPublico

router = APIRouter(prefix="/api/tecnico/equipos", tags=["Técnico - Equipos"])


async def _validar_cliente_existe(cliente_id: str):
    if not ObjectId.is_valid(cliente_id):
        raise HTTPException(status_code=400, detail="ID de cliente inválido")
    cliente = await clientes_collection.find_one({"_id": ObjectId(cliente_id)})
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")




@router.post("/", response_model=EquipoPublico, status_code=status.HTTP_201_CREATED)
async def crear_equipo(
    datos: EquipoCrear, tecnico_id: str = Depends(get_tecnico_actual_id)
):
    await _validar_cliente_existe(datos.id_cliente)

    fecha_proximo = EquipoEnDB.calcular_proximo_mantenimiento(
        datos.fecha_instalacion, datos.fecha_mantenimiento
    )

    nuevo_equipo = {
        "id_cliente": ObjectId(datos.id_cliente),
        "id_tecnico": ObjectId(tecnico_id),
        "id_tecnico_instalacion": ObjectId(tecnico_id),
        "id_tecnico_ultimo_mantenimiento": ObjectId(tecnico_id),
        "marca": datos.marca,
        "btus": datos.btus,
        "presion": datos.presion,
        "amperaje": datos.amperaje,
        "voltaje": datos.voltaje,
        "estado": datos.estado,
        "fecha_instalacion": date_a_datetime(datos.fecha_instalacion),
        "fecha_mantenimiento": date_a_datetime(datos.fecha_mantenimiento),
        "fecha_proximo_mantenimiento": date_a_datetime(fecha_proximo),
        "notificaciones_enviadas": [],
        "notas": datos.notas,
    }

    resultado = await equipos_collection.insert_one(nuevo_equipo)
    nuevo_equipo["_id"] = resultado.inserted_id

    return EquipoPublico(**normalizar_estado_equipo(normalizar_fechas_equipo(nuevo_equipo)))


@router.get("/cliente/{cliente_id}", response_model=list[EquipoPublico])
async def listar_equipos_de_cliente(
    cliente_id: str, 
    tecnico_id: str = Depends(get_tecnico_actual_id)
):
    if not ObjectId.is_valid(cliente_id):
        raise HTTPException(status_code=400, detail="ID de cliente inválido")

    cursor = equipos_collection.find({"id_cliente": ObjectId(cliente_id)})
    equipos = await cursor.to_list(length=300)
    return [EquipoPublico(**normalizar_estado_equipo(normalizar_fechas_equipo(e))) for e in equipos]


@router.get("/{equipo_id}", response_model=EquipoPublico)
async def obtener_equipo(
    equipo_id: str, tecnico_id: str = Depends(get_tecnico_actual_id)
):
    if not ObjectId.is_valid(equipo_id):
        raise HTTPException(status_code=400, detail="ID de equipo inválido")

    equipo = await equipos_collection.find_one({"_id": ObjectId(equipo_id)})
    if not equipo:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")
    return EquipoPublico(**normalizar_estado_equipo(normalizar_fechas_equipo(equipo)))


@router.patch("/{equipo_id}", response_model=EquipoPublico)
async def actualizar_equipo(
    equipo_id: str,
    datos: EquipoUpdate,
    tecnico_id: str = Depends(get_tecnico_actual_id),
):
    """
    Se usa tanto para actualizar mediciones (presión, amperaje, voltaje, estado)
    como para registrar un nuevo mantenimiento (fecha_mantenimiento).

    Si llega fecha_mantenimiento, se recalcula fecha_proximo_mantenimiento
    y se reinicia la lista de notificaciones enviadas para el nuevo ciclo.
    """
    if not ObjectId.is_valid(equipo_id):
        raise HTTPException(status_code=400, detail="ID de equipo inválido")

    equipo_actual = await equipos_collection.find_one({"_id": ObjectId(equipo_id)})
    if not equipo_actual:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")

    cambios = {k: v for k, v in datos.model_dump().items() if v is not None}
    if not cambios:
        raise HTTPException(status_code=400, detail="No hay campos para actualizar")

    # Si se reporta un nuevo mantenimiento, recalculamos la próxima fecha
    if "fecha_mantenimiento" in cambios:
        fecha_instalacion_actual = equipo_actual.get("fecha_instalacion")
        if isinstance(fecha_instalacion_actual, datetime):
            fecha_instalacion_actual = fecha_instalacion_actual.date()

        nueva_fecha_proximo = EquipoEnDB.calcular_proximo_mantenimiento(
            fecha_instalacion_actual, cambios["fecha_mantenimiento"]
        )
        cambios["fecha_mantenimiento"] = date_a_datetime(cambios["fecha_mantenimiento"])
        cambios["fecha_proximo_mantenimiento"] = date_a_datetime(nueva_fecha_proximo)
        cambios["notificaciones_enviadas"] = []  # reinicia el ciclo de alertas
        cambios["id_tecnico"] = ObjectId(tecnico_id)  # quién hizo el último mantenimiento
        cambios["id_tecnico_ultimo_mantenimiento"] = ObjectId(tecnico_id)

    resultado = await equipos_collection.find_one_and_update(
        {"_id": ObjectId(equipo_id)},
        {"$set": cambios},
        return_document=True,
    )
    return EquipoPublico(**normalizar_estado_equipo(normalizar_fechas_equipo(resultado)))
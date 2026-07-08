"""
Rutas de consulta del cliente: ver sus equipos y quién los instaló/mantuvo.
Todo es de solo lectura desde este lado.
"""
from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId

from app.core.database import equipos_collection, tecnicos_collection
from app.core.security import get_cliente_actual_id
from app.core.mongo_utils import normalizar_fechas_equipo, normalizar_estado_equipo
from app.models.equipo import EquipoPublico

router = APIRouter(prefix="/api/cliente/equipos", tags=["Cliente - Equipos"])


async def _buscar_tecnico_publico(tecnico_id):
    if not tecnico_id:
        return None
    tecnico = await tecnicos_collection.find_one({"_id": tecnico_id})
    if not tecnico:
        return None
    return {
        "id": str(tecnico["_id"]),
        "nombres": tecnico["nombres"],
        "apellidos": tecnico["apellidos"],
        "telefono": tecnico["telefono"],
        "foto_perfil_url": tecnico.get("foto_perfil_url"),
        "calificacion_promedio": tecnico.get("calificacion_promedio", 0.0),
    }


@router.get("/", response_model=list[EquipoPublico])
async def listar_mis_equipos(cliente_id: str = Depends(get_cliente_actual_id)):
    """
    Devuelve todos los equipos del cliente autenticado.
    El campo computado `mantenimiento_vencido` le dice al frontend
    si debe mostrar la alerta roja.
    """
    cursor = equipos_collection.find({"id_cliente": ObjectId(cliente_id)})
    equipos = await cursor.to_list(length=200)
    return [EquipoPublico(**normalizar_estado_equipo(normalizar_fechas_equipo(e))) for e in equipos]


@router.get("/{equipo_id}/tecnico")
async def ver_tecnico_del_equipo(
    equipo_id: str, cliente_id: str = Depends(get_cliente_actual_id)
):
    """
    Devuelve los datos públicos del técnico que instaló o hizo el último
    mantenimiento a este equipo específico (para mostrar "quién lo instaló").
    """
    if not ObjectId.is_valid(equipo_id):
        raise HTTPException(status_code=400, detail="ID de equipo inválido")

    equipo = await equipos_collection.find_one(
        {"_id": ObjectId(equipo_id), "id_cliente": ObjectId(cliente_id)}
    )
    if not equipo:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")

    tecnico_instalacion_id = equipo.get("id_tecnico_instalacion") or equipo.get("id_tecnico")
    tecnico_mantenimiento_id = equipo.get("id_tecnico_ultimo_mantenimiento") or equipo.get("id_tecnico")

    tecnico_instalacion = await _buscar_tecnico_publico(tecnico_instalacion_id)
    tecnico_mantenimiento = await _buscar_tecnico_publico(tecnico_mantenimiento_id)

    if not tecnico_instalacion and not tecnico_mantenimiento:
        raise HTTPException(status_code=404, detail="Técnico no encontrado")

    return {
        "instalacion": tecnico_instalacion,
        "ultimo_mantenimiento": tecnico_mantenimiento,
    }
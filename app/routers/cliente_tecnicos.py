"""
Rutas del cliente para ver la lista de técnicos recomendados.

Regla de negocio:
- Primero aparece el último técnico que atendió al cliente Y que él calificó bien (>=4).
- Luego el resto de técnicos, ordenados por calificación_promedio descendente.
"""
from fastapi import APIRouter, Depends
from bson import ObjectId

from app.core.database import tecnicos_collection, equipos_collection, calificaciones_collection
from app.core.security import get_cliente_actual_id

router = APIRouter(prefix="/api/cliente/tecnicos", tags=["Cliente - Técnicos"])

UMBRAL_BUENA_CALIFICACION = 4


def _tecnico_a_dict(tecnico: dict) -> dict:
    return {
        "id": str(tecnico["_id"]),
        "nombres": tecnico["nombres"],
        "apellidos": tecnico["apellidos"],
        "telefono": tecnico["telefono"],
        "foto_perfil_url": tecnico.get("foto_perfil_url"),
        "calificacion_promedio": tecnico.get("calificacion_promedio", 0.0),
        "total_calificaciones": tecnico.get("total_calificaciones", 0),
    }


@router.get("/recomendados")
async def listar_tecnicos_recomendados(cliente_id: str = Depends(get_cliente_actual_id)):
    cliente_oid = ObjectId(cliente_id)

    # 1. Buscar la calificación más reciente que el cliente haya dado
    ultima_calificacion = await calificaciones_collection.find_one(
        {"id_cliente": cliente_oid}, sort=[("creado_en", -1)]
    )

    id_tecnico_destacado = None
    if ultima_calificacion and ultima_calificacion["puntaje"] >= UMBRAL_BUENA_CALIFICACION:
        id_tecnico_destacado = ultima_calificacion["id_tecnico"]
    else:
        # si no hay calificación buena, usamos el último técnico que le hizo un equipo
        ultimo_equipo = await equipos_collection.find_one(
            {"id_cliente": cliente_oid}, sort=[("actualizado_en", -1)]
        )
        if ultimo_equipo:
            id_tecnico_destacado = ultimo_equipo["id_tecnico"]

    # 2. Traer todos los técnicos ordenados por calificación
    cursor = tecnicos_collection.find().sort("calificacion_promedio", -1)
    todos = await cursor.to_list(length=200)

    destacado = None
    resto = []
    for t in todos:
        if id_tecnico_destacado and t["_id"] == id_tecnico_destacado:
            destacado = _tecnico_a_dict(t)
        else:
            resto.append(_tecnico_a_dict(t))

    resultado = ([destacado] if destacado else []) + resto
    return resultado

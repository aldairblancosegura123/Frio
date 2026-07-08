"""
Rutas del cliente para calificar a un técnico.
Al insertar la calificación, se recalcula el promedio del técnico.
"""
from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId

from app.core.database import calificaciones_collection, tecnicos_collection
from app.core.security import get_cliente_actual_id
from app.models.calificacion import CalificacionCrear, CalificacionEnDB

router = APIRouter(prefix="/api/cliente/calificaciones", tags=["Cliente - Calificaciones"])


@router.post("/", status_code=201)
async def calificar_tecnico(
    datos: CalificacionCrear, cliente_id: str = Depends(get_cliente_actual_id)
):
    if not ObjectId.is_valid(datos.id_tecnico):
        raise HTTPException(status_code=400, detail="ID de técnico inválido")

    tecnico = await tecnicos_collection.find_one({"_id": ObjectId(datos.id_tecnico)})
    if not tecnico:
        raise HTTPException(status_code=404, detail="Técnico no encontrado")

    nueva_calificacion = {
        "id_tecnico": ObjectId(datos.id_tecnico),
        "id_cliente": ObjectId(cliente_id),
        "puntaje": datos.puntaje,
        "comentario": datos.comentario,
    }
    resultado = await calificaciones_collection.insert_one(nueva_calificacion)

    # Recalcular promedio del técnico
    total_anterior = tecnico.get("total_calificaciones", 0)
    promedio_anterior = tecnico.get("calificacion_promedio", 0.0)

    nuevo_total = total_anterior + 1
    nuevo_promedio = ((promedio_anterior * total_anterior) + datos.puntaje) / nuevo_total

    await tecnicos_collection.update_one(
        {"_id": ObjectId(datos.id_tecnico)},
        {"$set": {
            "calificacion_promedio": round(nuevo_promedio, 2),
            "total_calificaciones": nuevo_total,
        }},
    )

    nueva_calificacion["_id"] = resultado.inserted_id
    return {
        "mensaje": "Calificación registrada correctamente",
        "id": str(resultado.inserted_id),
    }

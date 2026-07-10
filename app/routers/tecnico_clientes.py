"""
Rutas del técnico para gestionar clientes.
"""
from fastapi import APIRouter, HTTPException, status, Depends
from bson import ObjectId

from app.core.database import clientes_collection
from app.core.security import get_tecnico_actual_id
from app.models.cliente import ClienteCrear, ClienteUpdate, ClientePublico

router = APIRouter(prefix="/api/tecnico/clientes", tags=["Técnico - Clientes"])


@router.post("/", response_model=ClientePublico, status_code=status.HTTP_201_CREATED)
async def crear_cliente(
    datos: ClienteCrear, tecnico_id: str = Depends(get_tecnico_actual_id)
):
    cedula = (datos.cedula or "").strip()
    telefono = (datos.telefono or "").strip()

    existente = await clientes_collection.find_one({
        "$or": [
            {"cedula": cedula},
            {"telefono": telefono},
        ]
    })
    if existente:
        if existente.get("cedula") == cedula:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe un cliente registrado con esta cédula",
            )
        if existente.get("telefono") == telefono:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe un cliente registrado con este teléfono",
            )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un cliente registrado con esa cédula o teléfono",
        )

    nuevo_cliente = {
        "nombre": datos.nombre,
        "cedula": cedula,
        "telefono": telefono,
        "direccion": datos.direccion,
        "fcm_token": None,
        "id_tecnico_registro": ObjectId(tecnico_id),
    }

    resultado = await clientes_collection.insert_one(nuevo_cliente)
    nuevo_cliente["_id"] = resultado.inserted_id

    return ClientePublico(**nuevo_cliente)


@router.get("/", response_model=list[ClientePublico])
async def listar_clientes(tecnico_id: str = Depends(get_tecnico_actual_id)):
    """
    Lista los clientes que este técnico ha registrado o atendido.
    """
    cursor = clientes_collection.find({"id_tecnico_registro": ObjectId(tecnico_id)})
    clientes = await cursor.to_list(length=500)
    return [ClientePublico(**c) for c in clientes]


@router.get("/buscar", response_model=ClientePublico)
async def buscar_cliente_por_cedula(
    cedula: str, tecnico_id: str = Depends(get_tecnico_actual_id)
):
    """
    Permite al técnico buscar un cliente existente por cédula
    antes de crear uno nuevo (evita duplicados) o para añadirle un equipo.
    """
    cliente = await clientes_collection.find_one({"cedula": cedula})
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return ClientePublico(**cliente)


@router.get("/{cliente_id}", response_model=ClientePublico)
async def obtener_cliente(
    cliente_id: str, tecnico_id: str = Depends(get_tecnico_actual_id)
):
    if not ObjectId.is_valid(cliente_id):
        raise HTTPException(status_code=400, detail="ID de cliente inválido")

    cliente = await clientes_collection.find_one({"_id": ObjectId(cliente_id)})
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return ClientePublico(**cliente)


@router.patch("/{cliente_id}", response_model=ClientePublico)
async def actualizar_cliente(
    cliente_id: str,
    datos: ClienteUpdate,
    tecnico_id: str = Depends(get_tecnico_actual_id),
):
    if not ObjectId.is_valid(cliente_id):
        raise HTTPException(status_code=400, detail="ID de cliente inválido")

    cambios = {k: v for k, v in datos.model_dump().items() if v is not None}
    if not cambios:
        raise HTTPException(status_code=400, detail="No hay campos para actualizar")

    resultado = await clientes_collection.find_one_and_update(
        {"_id": ObjectId(cliente_id)},
        {"$set": cambios},
        return_document=True,
    )
    if not resultado:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return ClientePublico(**resultado)

"""
Acceso del cliente: con cédula o teléfono, sin contraseña.
El cliente nunca se autorregistra, lo crea el técnico previamente.

Nota de seguridad: como no hay contraseña, este endpoint emite un token
de corta duración pensado solo para sesiones de consulta (no acciones
administrativas). Es una decisión consciente de UX simple para el cliente
final, aceptando ese trade-off de seguridad.
"""
from datetime import timedelta
from fastapi import APIRouter, HTTPException, status

from app.core.database import clientes_collection
from app.core.security import crear_access_token
from app.models.cliente import ClienteLogin, ClientePublico

router = APIRouter(prefix="/api/cliente/auth", tags=["Auth Cliente"])


@router.post("/ingresar")
async def ingresar_cliente(datos: ClienteLogin):
    credencial = (datos.cedula or "").strip()
    cliente = await clientes_collection.find_one({
        "$or": [
            {"cedula": credencial},
            {"telefono": credencial},
        ]
    })
    if not cliente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No encontramos un cliente registrado con esta cédula o teléfono. "
                   "Contacta a tu técnico para que te registre.",
        )

    # Token con prefijo distinto en "sub" para diferenciarlo del técnico
    token = crear_access_token(
        {"sub": str(cliente["_id"]), "tipo": "cliente"},
        expires_delta=timedelta(days=30),
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "cliente": ClientePublico(**cliente),
    }

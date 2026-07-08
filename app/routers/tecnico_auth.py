"""
Rutas de autenticación del técnico: registro y login.
"""
from fastapi import APIRouter, HTTPException, status

from app.core.database import tecnicos_collection
from app.core.security import hash_password, verify_password, crear_access_token
from app.models.tecnico import TecnicoRegistro, TecnicoLogin, TecnicoToken, TecnicoPublico
from app.models.py_object_id import PyObjectId

router = APIRouter(prefix="/api/tecnico/auth", tags=["Auth Técnico"])


@router.post("/registro", response_model=TecnicoToken, status_code=status.HTTP_201_CREATED)
async def registrar_tecnico(datos: TecnicoRegistro):
    existente = await tecnicos_collection.find_one({
        "$or": [
            {"cedula": datos.cedula},
            {"telefono": datos.telefono},
        ]
    })
    if existente:
        if existente.get("cedula") == datos.cedula:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe un técnico registrado con esta cédula",
            )
        if existente.get("telefono") == datos.telefono:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe un técnico registrado con este teléfono",
            )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un técnico registrado con esa cédula o teléfono",
        )

    nuevo_tecnico = {
        "nombres": datos.nombres,
        "apellidos": datos.apellidos,
        "cedula": datos.cedula,
        "telefono": datos.telefono,
        "password_hash": hash_password(datos.password),
        "foto_perfil_url": datos.foto_perfil_url,
        "fcm_token": None,
        "calificacion_promedio": 0.0,
        "total_calificaciones": 0,
    }

    resultado = await tecnicos_collection.insert_one(nuevo_tecnico)
    nuevo_tecnico["_id"] = resultado.inserted_id

    token = crear_access_token({"sub": str(resultado.inserted_id)})
    tecnico_publico = TecnicoPublico(**nuevo_tecnico)

    return TecnicoToken(access_token=token, tecnico=tecnico_publico)


@router.post("/login", response_model=TecnicoToken)
async def login_tecnico(datos: TecnicoLogin):
    tecnico = await tecnicos_collection.find_one({"cedula": datos.cedula})

    credenciales_invalidas = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Cédula o contraseña incorrecta",
    )

    if not tecnico:
        raise credenciales_invalidas

    if not verify_password(datos.password, tecnico["password_hash"]):
        raise credenciales_invalidas

    token = crear_access_token({"sub": str(tecnico["_id"])})
    tecnico_publico = TecnicoPublico(**tecnico)

    return TecnicoToken(access_token=token, tecnico=tecnico_publico)

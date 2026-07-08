"""
Utilidades de seguridad: hash de contraseñas y manejo de tokens JWT.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# HTTPBearer muestra en Swagger un simple campo para pegar el JWT
# con el prefijo "Bearer ", en vez del formulario de usuario/contraseña
# que genera OAuth2PasswordBearer (que no aplica aquí, ya que no usamos
# el flujo OAuth2 real sino JWT propio).
bearer_scheme = HTTPBearer()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password_plano: str, password_hash: str) -> bool:
    return pwd_context.verify(password_plano, password_hash)


def crear_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Crea un JWT firmado. El payload típico es {"sub": id_tecnico}
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decodificar_token(token: str) -> dict:
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_tecnico_actual_id(
    credenciales: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> str:
    """
    Dependency para proteger rutas del técnico.
    Devuelve el id del técnico autenticado extraído del token.
    """
    payload = decodificar_token(credenciales.credentials)
    tecnico_id: str = payload.get("sub")
    if tecnico_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token sin información de usuario",
        )
    return tecnico_id


async def get_cliente_actual_id(
    credenciales: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> str:
    """
    Dependency para proteger rutas del cliente.
    Verifica que el token sea de tipo "cliente" (no de técnico).
    """
    payload = decodificar_token(credenciales.credentials)
    if payload.get("tipo") != "cliente":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Este token no corresponde a un cliente",
        )
    cliente_id: str = payload.get("sub")
    if cliente_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token sin información de usuario",
        )
    return cliente_id
"""
Punto de entrada principal de la API FríoTech.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import verificar_conexion
from app.services.scheduler import iniciar_scheduler

from app.routers import (
    tecnico_auth,
    tecnico_clientes,
    tecnico_equipos,
    tecnico_solicitudes,
    cliente_auth,
    cliente_equipos,
    cliente_tecnicos,
    cliente_solicitudes,
    cliente_calificaciones,
    fcm_tokens,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Startup ---
    conectado = await verificar_conexion()
    print("Conexión a MongoDB:", "OK" if conectado else "FALLÓ")

    scheduler = iniciar_scheduler()
    print("Scheduler de notificaciones iniciado")

    yield

    # --- Shutdown ---
    scheduler.shutdown()


app = FastAPI(
    title="FríoTech API",
    description="API para gestión de técnicos de refrigeración, clientes y equipos de aire acondicionado",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configurable por variable de entorno
raw_cors_origins = (settings.CORS_ORIGINS or "*").strip()
if raw_cors_origins == "*":
    cors_origins = ["*"]
else:
    cors_origins = [origin.strip() for origin in raw_cors_origins.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=raw_cors_origins != "*",
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers del técnico
app.include_router(tecnico_auth.router)
app.include_router(tecnico_clientes.router)
app.include_router(tecnico_equipos.router)
app.include_router(tecnico_solicitudes.router)

# Routers del cliente
app.include_router(cliente_auth.router)
app.include_router(cliente_equipos.router)
app.include_router(cliente_tecnicos.router)
app.include_router(cliente_solicitudes.router)
app.include_router(cliente_calificaciones.router)

# Compartido
app.include_router(fcm_tokens.router)


@app.get("/", tags=["Health"])
async def root():
    return {"mensaje": "FríoTech API activa", "docs": "/docs"}


@app.get("/health", tags=["Health"])
async def health_check():
    conectado = await verificar_conexion()
    return {"status": "ok" if conectado else "error", "mongo_conectado": conectado}

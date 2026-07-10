"""
Conexión asíncrona a MongoDB Atlas usando Motor.
"""
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

client = AsyncIOMotorClient(settings.MONGO_URI)
db = client[settings.MONGO_DB_NAME]

# Colecciones
tecnicos_collection = db["tecnicos"]
clientes_collection = db["clientes"]
equipos_collection = db["equipos"]
solicitudes_collection = db["solicitudes"]
calificaciones_collection = db["calificaciones"]


async def verificar_conexion():
    """Util para probar la conexión al arrancar la app."""
    try:
        await client.admin.command("ping")
        return True
    except Exception as e:
        print(f"Error conectando a MongoDB: {e}")
        return False


async def asegurar_indices_unicos_clientes():
    """Crea índices únicos en cédula y teléfono para evitar duplicados."""
    try:
        await clientes_collection.create_index("cedula", unique=True, name="uniq_clientes_cedula")
    except Exception as e:
        print(f"Aviso índice único clientes.cedula: {e}")

    try:
        await clientes_collection.create_index("telefono", unique=True, name="uniq_clientes_telefono")
    except Exception as e:
        print(f"Aviso índice único clientes.telefono: {e}")

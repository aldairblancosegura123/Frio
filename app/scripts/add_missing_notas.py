"""Script para rellenar la clave `notas` en los documentos de la colección `equipos`.

Ejecución:
  - Activar el entorno virtual del proyecto
  - Ejecutar: python -m app.scripts.add_missing_notas  (desde la raíz del repo)

El script usará `app.core.config.settings` para leer `MONGO_URI` y conectarse.
"""
import asyncio

from app.core.database import equipos_collection


async def run():
    # Actualiza todos los documentos que no tienen la clave `notas`
    result = await equipos_collection.update_many(
        {"notas": {"$exists": False}},
        {"$set": {"notas": ""}},
    )
    print(f"Documents matched: {result.matched_count}, modified: {result.modified_count}")


if __name__ == "__main__":
    asyncio.run(run())

"""
Job programado que corre una vez al día y revisa todos los equipos
para disparar las notificaciones de 7, 3 y 1 día antes del mantenimiento.

Usa el campo `notificaciones_enviadas` de cada equipo para no enviar
la misma alerta dos veces dentro del mismo ciclo.
"""
from datetime import date, datetime
from zoneinfo import ZoneInfo
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.core.database import equipos_collection, clientes_collection, tecnicos_collection
from app.services.notificaciones import notificar_mantenimiento_proximo

# Mapeo: a cuántos días de anticipación se notifica -> etiqueta guardada en DB
VENTANAS_NOTIFICACION = {
    7: "7_dias",
    3: "3_dias",
    1: "1_dia",
}


async def revisar_mantenimientos_proximos():
    """
    Recorre todos los equipos con fecha_proximo_mantenimiento definida
    y dispara notificaciones si caen exactamente en 7, 3 o 1 día restante.
    """
    hoy = date.today()

    cursor = equipos_collection.find({"fecha_proximo_mantenimiento": {"$ne": None}})
    equipos = await cursor.to_list(length=10000)

    for equipo in equipos:
        fecha_proximo = equipo["fecha_proximo_mantenimiento"]
        if isinstance(fecha_proximo, datetime):
            fecha_proximo = fecha_proximo.date()
        elif isinstance(fecha_proximo, str):
            fecha_proximo = date.fromisoformat(fecha_proximo)

        dias_restantes = (fecha_proximo - hoy).days

        if dias_restantes not in VENTANAS_NOTIFICACION:
            continue  # no es uno de los días que nos importan

        etiqueta = VENTANAS_NOTIFICACION[dias_restantes]
        ya_enviadas = equipo.get("notificaciones_enviadas", [])

        if etiqueta in ya_enviadas:
            continue  # ya se notificó esta ventana, no repetir

        cliente = await clientes_collection.find_one({"_id": equipo["id_cliente"]})

        tecnico_id = (
            equipo.get("id_tecnico_ultimo_mantenimiento")
            or equipo.get("id_tecnico_instalacion")
            or equipo.get("id_tecnico")
        )
        tecnico = await tecnicos_collection.find_one({"_id": tecnico_id}) if tecnico_id else None

        if not cliente or not tecnico:
            continue

        await notificar_mantenimiento_proximo(tecnico, cliente, equipo, dias_restantes)

        # marcar como enviada para no repetir
        await equipos_collection.update_one(
            {"_id": equipo["_id"]},
            {"$push": {"notificaciones_enviadas": etiqueta}},
        )


def iniciar_scheduler() -> AsyncIOScheduler:
    """
    Se llama una vez al arrancar la app (ver app/main.py).
    Corre el job todos los días a las 11:00 am.
    """
    scheduler = AsyncIOScheduler(timezone=ZoneInfo("America/Bogota"))
    scheduler.add_job(
        revisar_mantenimientos_proximos,
        trigger="cron",
        hour=11,
        minute=0,
        timezone=ZoneInfo("America/Bogota"),
        id="revisar_mantenimientos_proximos",
        replace_existing=True,
    )
    scheduler.start()
    return scheduler
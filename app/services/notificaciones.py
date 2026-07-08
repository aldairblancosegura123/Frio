"""
Servicio de notificaciones push vía Firebase Cloud Messaging (FCM).

Cubre dos casos de uso:
1. Notificar al técnico cuando un cliente crea una solicitud (urgente=roja, normal=azul hielo)
2. Notificar a técnico y cliente cuando se acerca la fecha de próximo mantenimiento
    (7 días, 3 días, 1 día antes)
"""
import json
import firebase_admin
from firebase_admin import credentials, messaging

from app.core.config import settings

_firebase_inicializado = False


def _obtener_credenciales_firebase():
    # Producción (Render): contenido del JSON en variable de entorno.
    raw_json = (settings.FCM_CREDENTIALS_JSON or "").strip()
    if raw_json:
        return credentials.Certificate(json.loads(raw_json))

    # Local: archivo en disco.
    return credentials.Certificate(settings.FCM_CREDENTIALS_PATH)


def _inicializar_firebase():
    global _firebase_inicializado
    if not _firebase_inicializado:
        cred = _obtener_credenciales_firebase()
        firebase_admin.initialize_app(cred)
        _firebase_inicializado = True


def _enviar_push(token_dispositivo: str, titulo: str, cuerpo: str, color: str, data: dict):
    """
    Envía una notificación push a un solo dispositivo.
    El campo `color` se manda como data extra: el frontend (PWA) es quien
    pinta la notificación in-app urgente en rojo o normal en azul hielo,
    ya que el color visual de una notificación de sistema no se controla
    desde FCM en todos los dispositivos.
    """
    if not token_dispositivo:
        return  # el usuario aún no tiene token FCM registrado (no abrió permisos)

    _inicializar_firebase()

    mensaje = messaging.Message(
        notification=messaging.Notification(title=titulo, body=cuerpo),
        data={**data, "color": color},
        token=token_dispositivo,
    )
    try:
        messaging.send(mensaje)
    except Exception as e:
        # No tumbar la petición principal si falla el push
        print(f"Error enviando notificación push: {e}")


async def notificar_nueva_solicitud(tecnico: dict, solicitud: dict):
    """
    Se llama justo cuando el cliente crea una solicitud.
    Urgente -> rojo. Normal -> azul hielo.
    """
    es_urgente = solicitud["prioridad"] == "urgente"
    color = "#E24B4A" if es_urgente else "#CFEFFA"  # rojo / azul hielo
    tipo_legible = "instalación" if solicitud["tipo"] == "instalacion" else "revisión"

    titulo = "🔴 Solicitud urgente" if es_urgente else "Nueva solicitud"
    cuerpo = f"Tienes una solicitud de {tipo_legible} {'URGENTE' if es_urgente else ''}".strip()

    _enviar_push(
        token_dispositivo=tecnico.get("fcm_token"),
        titulo=titulo,
        cuerpo=cuerpo,
        color=color,
        data={
            "tipo": "nueva_solicitud",
            "id_solicitud": str(solicitud["_id"]),
            "prioridad": solicitud["prioridad"],
            "url": "/index.html",
        },
    )


async def notificar_mantenimiento_proximo(
    tecnico: dict, cliente: dict, equipo: dict, dias_restantes: int
):
    """
    Se llama desde el job diario (ver app/services/scheduler.py)
    cuando un equipo entra en ventana de 7, 3 o 1 día antes del mantenimiento.
    """
    cuerpo = (
        f"El equipo {equipo['marca']} de {cliente['nombre']} "
        f"necesita mantenimiento en {dias_restantes} día(s)"
    )
    data = {
        "tipo": "recordatorio_mantenimiento",
        "id_equipo": str(equipo["_id"]),
        "id_cliente": str(equipo.get("id_cliente", "")),
        "dias_restantes": str(dias_restantes),
    }

    # Al técnico
    _enviar_push(
        token_dispositivo=tecnico.get("fcm_token"),
        titulo="Recordatorio de mantenimiento",
        cuerpo=cuerpo,
        color="#CFEFFA",
        data={
            **data,
            "url": f"/equipos.html?cliente_id={str(equipo.get('id_cliente', ''))}&equipo={str(equipo['_id'])}",
        },
    )

    # Al cliente
    _enviar_push(
        token_dispositivo=cliente.get("fcm_token"),
        titulo="Tu aire acondicionado necesita mantenimiento pronto",
        cuerpo=f"Faltan {dias_restantes} día(s). Contacta a tu técnico para agendar.",
        color="#CFEFFA",
        data={
            **data,
            "url": f"/cliente.html?equipos=1&equipo={str(equipo['_id'])}#equiposSection",
        },
    )


async def notificar_solicitud_agendada(
    cliente: dict, tecnico: dict, solicitud: dict, fecha_agendada_iso: str
):
    """
    Se llama cuando el técnico acepta una solicitud y agenda fecha/hora.
    """
    nombre_tecnico = f"{tecnico.get('nombres', '')} {tecnico.get('apellidos', '')}".strip() or "tu técnico"
    tipo_legible = "instalación" if solicitud.get("tipo") == "instalacion" else "revisión"
    fecha_legible = fecha_agendada_iso.replace("T", " ")[:16]

    _enviar_push(
        token_dispositivo=cliente.get("fcm_token"),
        titulo="✅ Solicitud agendada",
        cuerpo=f"{nombre_tecnico} agendó tu {tipo_legible} para {fecha_legible}",
        color="#4ADE9C",
        data={
            "tipo": "solicitud_agendada",
            "id_solicitud": str(solicitud.get("_id", "")),
            "fecha_agendada": fecha_agendada_iso,
            "url": "/cliente.html?agendas=1#agendas",
        },
    )


async def notificar_solicitud_rechazada(
    cliente: dict,
    tecnico: dict,
    solicitud: dict,
    motivo_rechazo: str | None = None,
):
    """
    Se llama cuando el técnico rechaza una solicitud del cliente.
    """
    nombre_tecnico = f"{tecnico.get('nombres', '')} {tecnico.get('apellidos', '')}".strip() or "tu técnico"
    tipo_legible = "instalación" if solicitud.get("tipo") == "instalacion" else "revisión"
    motivo = (motivo_rechazo or '').strip()
    cuerpo = f"{nombre_tecnico} rechazó tu solicitud de {tipo_legible}"
    if motivo:
        cuerpo = f"{cuerpo}. Motivo: {motivo}"

    _enviar_push(
        token_dispositivo=cliente.get("fcm_token"),
        titulo="❌ Solicitud rechazada",
        cuerpo=cuerpo,
        color="#E24B4A",
        data={
            "tipo": "solicitud_rechazada",
            "id_solicitud": str(solicitud.get("_id", "")),
            "motivo_rechazo": motivo,
            "url": "/cliente.html?agendas=1#solicitudesSection",
        },
    )


async def notificar_solicitud_completada(
    cliente: dict,
    tecnico: dict,
    solicitud: dict,
):
    """
    Se llama cuando el técnico marca una solicitud como completada.
    """
    nombre_tecnico = f"{tecnico.get('nombres', '')} {tecnico.get('apellidos', '')}".strip() or "tu técnico"
    tipo_legible = "instalación" if solicitud.get("tipo") == "instalacion" else "revisión"

    tecnico_id = str(tecnico.get("_id", ""))

    _enviar_push(
        token_dispositivo=cliente.get("fcm_token"),
        titulo="✅ Servicio completado",
        cuerpo=f"{nombre_tecnico} marcó tu solicitud de {tipo_legible} como completada. ¡Cuéntanos cómo te fue!",
        color="#4ADE9C",
        data={
            "tipo": "solicitud_completada",
            "id_solicitud": str(solicitud.get("_id", "")),
            "id_tecnico": tecnico_id,
            "url": f"/cliente.html?calificar=1&tecnico={tecnico_id}#calificacionesSection",
        },
    )

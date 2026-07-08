# FríoTech API

Backend para la gestión de técnicos de refrigeración, clientes y equipos
de aire acondicionado. Construido con **FastAPI** + **MongoDB Atlas**.

## Estructura del proyecto

```
app/
├── core/
│   ├── config.py        # lee variables de entorno
│   ├── database.py      # conexión a MongoDB (Motor, async)
│   └── security.py      # hash de contraseñas + JWT
├── models/
│   ├── tecnico.py
│   ├── cliente.py
│   ├── equipo.py         # incluye la lógica de fecha_proximo_mantenimiento
│   ├── solicitud.py
│   └── calificacion.py
├── routers/
│   ├── tecnico_auth.py        # registro / login técnico
│   ├── tecnico_clientes.py    # CRUD clientes (lo hace el técnico)
│   ├── tecnico_equipos.py     # CRUD equipos / mantenimientos
│   ├── tecnico_solicitudes.py # ver y gestionar solicitudes recibidas
│   ├── cliente_auth.py        # ingreso solo con cédula
│   ├── cliente_equipos.py     # ver sus equipos (solo lectura)
│   ├── cliente_tecnicos.py    # lista de técnicos recomendados
│   ├── cliente_solicitudes.py # crear solicitudes (instalación/revisión)
│   ├── cliente_calificaciones.py
│   └── fcm_tokens.py          # guardar token de notificaciones push
├── services/
│   ├── notificaciones.py  # envío de push vía Firebase
│   └── scheduler.py       # job diario (15/5/1 día antes del mantenimiento)
└── main.py                # arranque de la app, CORS, scheduler
```

## 1. Instalación local

```bash
# Crear entorno virtual (recomendado)
python3 -m venv venv
source venv/bin/activate   # En Windows: venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt
```

## 2. Configurar variables de entorno

Copia `.env.example` a `.env` y completa tus valores:

```bash
cp .env.example .env
```

- **MONGO_URI**: tu connection string de MongoDB Atlas (la que ya tienes)
- **JWT_SECRET_KEY**: genera una clave segura con `openssl rand -hex 32`
- **FCM_CREDENTIALS_PATH**: ruta al JSON de credenciales de Firebase
  (Firebase Console > Configuración del proyecto > Cuentas de servicio >
  Generar nueva clave privada). Coloca ese archivo en la raíz del proyecto.

## 3. Correr en local

```bash
uvicorn app.main:app --reload
```

La API quedará en `http://localhost:8000`.
Documentación interactiva automática (Swagger) en `http://localhost:8000/docs`.

## 4. Deploy en Render

1. Sube este proyecto a un repositorio en GitHub.
2. En Render, crea un nuevo **Blueprint** apuntando al repo.
3. Render detectará `render.yaml` y creará:
  - `friotech-api` (Web Service FastAPI)
  - `friotech-frontend` (Static Site Vite)
4. Configura variables pendientes (`sync: false`) en Render:
  - Backend: `MONGO_URI`, `JWT_SECRET_KEY`, `FCM_CREDENTIALS_JSON`, `CORS_ORIGINS`
  - Frontend: `VITE_API_BASE` (ej: `https://friotech-api.onrender.com`)
5. Para Firebase en producción, usa `FCM_CREDENTIALS_JSON` con el contenido
  completo del archivo de credenciales (una sola línea JSON).

Notas rápidas de producción:
- Si `CORS_ORIGINS` es `*`, la API deja `allow_credentials=false`.
- Para login y headers `Authorization`, define `CORS_ORIGINS` con dominios explícitos,
  por ejemplo: `https://friotech-frontend.onrender.com`.

## Endpoints principales

### Técnico (requiere JWT de técnico)
- `POST /api/tecnico/auth/registro`
- `POST /api/tecnico/auth/login`
- `POST /api/tecnico/clientes/` — crear cliente
- `GET  /api/tecnico/clientes/` — listar mis clientes
- `GET  /api/tecnico/clientes/buscar?cedula=...`
- `POST /api/tecnico/equipos/` — crear equipo
- `GET  /api/tecnico/equipos/cliente/{cliente_id}`
- `PATCH /api/tecnico/equipos/{equipo_id}` — actualizar mediciones o reportar mantenimiento
- `GET  /api/tecnico/solicitudes/`
- `PATCH /api/tecnico/solicitudes/{id}/estado`

### Cliente (requiere JWT de cliente)
- `POST /api/cliente/auth/ingresar` — solo con cédula
- `GET  /api/cliente/equipos/` — ver mis equipos
- `GET  /api/cliente/equipos/{id}/tecnico` — quién lo instaló
- `GET  /api/cliente/tecnicos/recomendados`
- `POST /api/cliente/solicitudes/` — crear solicitud
- `POST /api/cliente/calificaciones/` — calificar técnico

### Compartido
- `POST /api/tecnico/fcm-token` y `POST /api/cliente/fcm-token`

## Notas importantes

- **Regla de fecha próximo mantenimiento**: se calcula automáticamente como
  `(fecha_mantenimiento o fecha_instalacion) + 100 días`. Configurable vía
  la variable de entorno `DIAS_PROXIMO_MANTENIMIENTO`.
- **Alerta roja en cliente**: el modelo `EquipoPublico` incluye el campo
  calculado `mantenimiento_vencido` (true/false) para que el frontend
  pinte la alerta sin tener que calcular fechas en el cliente.
- **Notificaciones sin duplicar**: cada equipo guarda en
  `notificaciones_enviadas` qué alertas ya se mandaron (15/5/1 día), y se
  reinicia automáticamente cuando se registra un nuevo mantenimiento.
- El login del cliente (solo cédula, sin contraseña) es una decisión de UX
  simple que conlleva un trade-off de seguridad — cualquier persona con la
  cédula del cliente podría ingresar. Si más adelante quieres reforzarlo,
  se puede agregar un PIN o verificación por SMS.

## Próximos pasos sugeridos

1. Probar todos los endpoints con la documentación Swagger (`/docs`)
2. Configurar Firebase Cloud Messaging real
3. Construir el frontend (PWA) de cada app
4. Empaquetar como TWA con Bubblewrap

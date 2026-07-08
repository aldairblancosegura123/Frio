import './index.css'
import { canUseNotifications, registerFcmToken, subscribeForegroundFcmMessages } from './fcm.js'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

const loginForm = document.querySelector('#loginForm')
const cedulaInput = document.querySelector('#cedulaInput')
const passwordInput = document.querySelector('#passwordInput')
const loginMessage = document.querySelector('#loginMessage')
const logoutButton = document.querySelector('#logoutButton')
const menuContainer = document.querySelector('#menuContainer')
const menuToggle = document.querySelector('#menuToggle')
const menuDropdown = document.querySelector('#menuDropdown')
const menuTechnicianName = document.querySelector('#menuTechnicianName')
const menuBackdrop = document.querySelector('#menuBackdrop')
const installAppButton = document.querySelector('#installAppButton')
const menuItems = document.querySelectorAll('.menu-item[data-action]')
const statsPanel = document.querySelector('#statsPanel')
const statusBadges = document.querySelector('#statusBadges')
const sessionStatus = document.querySelector('#sessionStatus')
const clientesSection = document.querySelector('#clientesSection')
const clientesHeader = document.querySelector('#clientesHeader')
const clientesPanelBody = document.querySelector('#clientesPanelBody')
const agendasSection = document.querySelector('#agendasSection')
const agendasHeader = document.querySelector('#agendasHeader')
const agendasPanelBody = document.querySelector('#agendasPanelBody')
const agendasMonthPrev = document.querySelector('#agendasMonthPrev')
const agendasMonthNext = document.querySelector('#agendasMonthNext')
const agendasMonthLabel = document.querySelector('#agendasMonthLabel')
const agendasCalendarGrid = document.querySelector('#agendasCalendarGrid')
const agendasDayDetail = document.querySelector('#agendasDayDetail')
const notificacionesSection = document.querySelector('#notificacionesSection')
const notificacionesHeader = document.querySelector('#notificacionesHeader')
const notificacionesPanelBody = document.querySelector('#notificacionesPanelBody')
const notificacionesFilter = document.querySelector('#notificacionesFilter')
const clientesList = document.querySelector('#clientesList')
const notificacionesList = document.querySelector('#notificacionesList')
const notificacionesEmpty = document.querySelector('#notificacionesEmpty')
const notificacionesCount = document.querySelector('#notificacionesCount')
const clientesSectionCount = document.querySelector('#clientesSectionCount')
const clientesCount = document.querySelector('#clientesCount')
const lastCliente = document.querySelector('#lastCliente')
const tecnicoSubtitle = document.querySelector('#tecnicoSubtitle')
const heroCopy = document.querySelector('#heroCopy')
const emptyState = document.querySelector('#emptyState')
const clienteEquiposModal = document.querySelector('#clienteEquiposModal')
const clienteEquiposBackdrop = document.querySelector('#clienteEquiposBackdrop')
const modalClienteNombre = document.querySelector('#modalClienteNombre')
const modalClienteCedula = document.querySelector('#modalClienteCedula')
const modalEquiposList = document.querySelector('#modalEquiposList')
const modalEmpty = document.querySelector('#modalEmpty')
const closeClienteEquipos = document.querySelector('#closeClienteEquipos')
const verTodosEquiposBtn = document.querySelector('#verTodosEquiposBtn')
const registrarClienteButton = document.querySelector('#registrarClienteButton')
const crearClienteForm = document.querySelector('#crearClienteForm')
const cancelCrearCliente = document.querySelector('#cancelCrearCliente')
const crearClienteMsg = document.querySelector('#crearClienteMsg')
const inputNuevoNombre = document.querySelector('#nuevo_nombre')
const inputNuevoCedula = document.querySelector('#nuevo_cedula')
const inputNuevoTelefono = document.querySelector('#nuevo_telefono')
const inputNuevoDireccion = document.querySelector('#nuevo_direccion')

const storageKey = 'friotech_tecnico_token'
const tecnicoDataKey = 'friotech_tecnico_data'

let notificationAudioContext = null
let foregroundFcmListenerReady = false
let notificationToastContainer = null
let deferredInstallPrompt = null

const state = {
  token: localStorage.getItem(storageKey) || null,
  tecnico: JSON.parse(localStorage.getItem(tecnicoDataKey) || 'null'),
  clientes: [],
  equiposPorId: {},
  solicitudes: [],
  solicitudesFiltro: 'todas',
  solicitudObjetivoId: null,
  agendasCalendarMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  agendasSelectedDate: null,
}

function buildSolicitudTargetUrl(data = {}) {
  const rawUrl = data?.url || '/index.html'

  try {
    const url = new URL(rawUrl, window.location.origin)
    if (data?.id_solicitud) {
      url.searchParams.set('solicitud', data.id_solicitud)
      url.hash = 'notificaciones'
    }
    return `${url.pathname}${url.search}${url.hash}`
  } catch (_) {
    if (!data?.id_solicitud) return rawUrl
    const separator = rawUrl.includes('?') ? '&' : '?'
    return `${rawUrl}${separator}solicitud=${encodeURIComponent(data.id_solicitud)}#notificaciones`
  }
}

function readSolicitudTargetFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search)
    return params.get('solicitud') || null
  } catch (_) {
    return null
  }
}

function clearSolicitudTargetFromUrl() {
  try {
    const url = new URL(window.location.href)
    url.searchParams.delete('solicitud')
    if (url.hash === '#notificaciones') {
      url.hash = ''
    }
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
  } catch (_) {
    // no-op
  }
}

function showCrearForm() {
  if (!crearClienteForm) return
  crearClienteForm.classList.remove('hidden')
  crearClienteMsg && (crearClienteMsg.textContent = '')
}

function hideCrearForm() {
  if (!crearClienteForm) return
  crearClienteForm.classList.add('hidden')
  if (crearClienteMsg) crearClienteMsg.textContent = ''
  if (inputNuevoNombre) inputNuevoNombre.value = ''
  if (inputNuevoCedula) inputNuevoCedula.value = ''
  if (inputNuevoTelefono) inputNuevoTelefono.value = ''
  if (inputNuevoDireccion) inputNuevoDireccion.value = ''
}

function closeMenu() {
  if (!menuDropdown) return
  menuDropdown.classList.add('hidden')
  menuBackdrop?.classList.add('hidden')
  menuToggle?.setAttribute('aria-expanded', 'false')
}

function showInstallButton(show) {
  if (!installAppButton) return
  installAppButton.classList.toggle('hidden', !show)
}

async function tryInstallPwa() {
  if (!deferredInstallPrompt) {
    setMessage('La instalación directa no está disponible en este navegador. Usa "Agregar a pantalla de inicio".', true)
    return
  }

  deferredInstallPrompt.prompt()
  const result = await deferredInstallPrompt.userChoice.catch(() => null)
  if (result?.outcome === 'accepted') {
    setMessage('Instalando app...')
  }
  deferredInstallPrompt = null
  showInstallButton(false)
}

async function registerAppServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  try {
    await navigator.serviceWorker.register('/firebase-messaging-sw.js')
  } catch (error) {
    console.warn('[PWA] No se pudo registrar Service Worker:', error)
  }
}

function toggleMenu() {
  if (!menuDropdown) return
  const isOpen = !menuDropdown.classList.contains('hidden')
  if (isOpen) {
    closeMenu()
  } else {
    menuDropdown.classList.remove('hidden')
    menuBackdrop?.classList.remove('hidden')
    menuToggle?.setAttribute('aria-expanded', 'true')
  }
}

async function crearCliente(datos) {
  return apiFetch('/api/tecnico/clientes/', {
    method: 'POST',
    body: JSON.stringify(datos),
  })
}

registrarClienteButton?.addEventListener('click', (e) => {
  e.preventDefault()
  showCrearForm()
})

cancelCrearCliente?.addEventListener('click', () => {
  hideCrearForm()
})

installAppButton?.addEventListener('click', async () => {
  await tryInstallPwa()
  closeMenu()
})

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  deferredInstallPrompt = event
  showInstallButton(true)
})

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null
  showInstallButton(false)
  setMessage('App instalada. Ya puedes abrir FrioTech como aplicación.')
})

crearClienteForm?.addEventListener('submit', async (event) => {
  event.preventDefault()
  if (crearClienteMsg) crearClienteMsg.textContent = 'Guardando...'
  try {
    const nombre = inputNuevoNombre.value.trim()
    const cedula = inputNuevoCedula.value.trim()
    const telefono = inputNuevoTelefono.value.trim()
    const direccion = inputNuevoDireccion.value.trim()

    if (!nombre || !cedula) {
      if (crearClienteMsg) crearClienteMsg.textContent = 'Nombre y cédula son requeridos.'
      return
    }

    // Validaciones numéricas
    if (!/^\d+$/.test(cedula)) {
      if (crearClienteMsg) crearClienteMsg.textContent = 'La cédula debe contener solo números.'
      return
    }
    if (telefono && !/^\d+$/.test(telefono)) {
      if (crearClienteMsg) crearClienteMsg.textContent = 'El teléfono debe contener solo números.'
      return
    }

    try {
      const nuevo = await crearCliente({ nombre, cedula, telefono, direccion })
      state.clientes = state.clientes || []
      state.clientes.push(nuevo)
      renderClientes()
      if (crearClienteMsg) crearClienteMsg.textContent = 'Cliente creado correctamente.'
      setTimeout(() => hideCrearForm(), 900)
    } catch (apiErr) {
      const msg = apiErr?.message || ''
      if (msg.toLowerCase().includes('ya existe') || msg.toLowerCase().includes('conflict')) {
        if (crearClienteMsg) crearClienteMsg.textContent = 'Cliente ya fue registrado.'
      } else {
        if (crearClienteMsg) crearClienteMsg.textContent = 'Error al crear cliente.'
      }
    }
  } catch (err) {
    if (crearClienteMsg) crearClienteMsg.textContent = 'Error al crear cliente.'
  }
})

function setMessage(text, error = false) {
  if (!loginMessage) return
  loginMessage.textContent = text
  loginMessage.style.color = error ? '#FF5A5F' : 'var(--text-dim)'
}

function formatFcmSetupError(error) {
  const message = String(error?.message || error || '')
  const lowerMessage = message.toLowerCase()

  if (lowerMessage.includes('push api') || lowerMessage.includes('permission denied') || lowerMessage.includes('no active service worker')) {
    return 'Chrome/Edge bloqueó Push en este perfil. Cierra la navegación privada o abre una ventana normal y vuelve a iniciar sesión.'
  }

  return message || 'No se pudo activar el sistema de notificaciones.'
}

function ensureNotificationToastContainer() {
  if (notificationToastContainer) return notificationToastContainer

  notificationToastContainer = document.createElement('div')
  notificationToastContainer.className = 'push-toast-container'
  document.body.appendChild(notificationToastContainer)
  return notificationToastContainer
}

function showNotificationToast(title, body, accent = 'var(--primary)', onOpen = null) {
  const container = ensureNotificationToastContainer()
  const toast = document.createElement('article')
  toast.className = 'push-toast'
  toast.style.setProperty('--toast-accent', accent)
  toast.innerHTML = `
    <div class="push-toast-title">
      <span>${title}</span>
      <button type="button" class="push-toast-close" aria-label="Cerrar notificación">×</button>
    </div>
    <div class="push-toast-body">${body}</div>
  `

  const closeToast = () => {
    toast.classList.remove('is-visible')
    window.setTimeout(() => toast.remove(), 220)
  }

  toast.querySelector('.push-toast-close')?.addEventListener('click', closeToast)
  if (typeof onOpen === 'function') {
    toast.style.cursor = 'pointer'
    toast.addEventListener('click', (event) => {
      const closeButton = event.target instanceof Element ? event.target.closest('.push-toast-close') : null
      if (closeButton) return
      onOpen()
      closeToast()
    })
  }
  container.appendChild(toast)
  requestAnimationFrame(() => toast.classList.add('is-visible'))
  window.setTimeout(closeToast, 7000)
}

function openCompletionNoteModal() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4'

    overlay.innerHTML = `
      <div class="surface-raised w-full max-w-lg rounded-3xl border border-white/10 p-5 shadow-2xl">
        <div class="flex items-start justify-between gap-3">
          <h3 class="font-display text-lg text-[var(--text)]">Cerrar solicitud con exito</h3>
          <button type="button" data-action="close" class="btn-ghost px-3 py-1" aria-label="Cerrar">x</button>
        </div>
        <p class="mt-2 text-sm text-[var(--text-dim)]">Escribe una nota obligatoria para el historial de acciones del equipo.</p>
        <textarea data-role="nota" rows="4" class="input-field mt-3 w-full rounded-2xl" placeholder="Ej: Se realizo revision general, limpieza de filtros y prueba de funcionamiento."></textarea>
        <p data-role="error" class="mt-2 text-sm text-[var(--danger)] hidden">La nota es obligatoria.</p>
        <div class="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" data-action="cancel" class="btn-secondary">Cancelar</button>
          <button type="button" data-action="confirm" class="btn-primary">Guardar y completar</button>
        </div>
      </div>
    `

    const cleanup = (value) => {
      overlay.remove()
      resolve(value)
    }

    const closeBtn = overlay.querySelector('[data-action="close"]')
    const cancelBtn = overlay.querySelector('[data-action="cancel"]')
    const confirmBtn = overlay.querySelector('[data-action="confirm"]')
    const notaInput = overlay.querySelector('[data-role="nota"]')
    const errorEl = overlay.querySelector('[data-role="error"]')

    const closeModal = () => cleanup(null)

    closeBtn?.addEventListener('click', closeModal)
    cancelBtn?.addEventListener('click', closeModal)

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeModal()
    })

    confirmBtn?.addEventListener('click', () => {
      const note = (notaInput?.value || '').trim()
      if (!note) {
        errorEl?.classList.remove('hidden')
        notaInput?.focus()
        return
      }
      errorEl?.classList.add('hidden')
      cleanup(note)
    })

    document.body.appendChild(overlay)
    notaInput?.focus()
  })
}

function expandSolicitudCardById(solicitudId, { scroll = true } = {}) {
  const normalizedId = toIdString(solicitudId)
  if (!normalizedId || !notificacionesList) return false

  const card = notificacionesList.querySelector(`[data-solicitud-id="${normalizedId}"]`)
  if (!(card instanceof HTMLElement)) return false

  card.classList.remove('solicitud-flash')
  void card.offsetWidth
  card.classList.add('solicitud-flash')
  window.setTimeout(() => {
    card.classList.remove('solicitud-flash')
  }, 1800)

  expandNotificacionesPanel()
  const header = card.querySelector('.accordion-header')
  const panel = card.querySelector('.accordion-panel')
  if (header instanceof HTMLElement && panel instanceof HTMLElement) {
    header.classList.add('expanded')
    header.setAttribute('aria-expanded', 'true')
    panel.classList.remove('hidden')
  }

  if (scroll) {
    notificacionesSection?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    card.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return true
}

async function abrirSolicitudObjetivo(solicitudId, { reload = false } = {}) {
  const normalizedId = toIdString(solicitudId)
  if (!normalizedId || !state.token) return false

  state.solicitudObjetivoId = normalizedId
  state.solicitudesFiltro = 'todas'
  if (notificacionesFilter) notificacionesFilter.value = 'todas'

  if (reload) {
    await cargarSolicitudesRecibidas()
    return true
  }

  const opened = expandSolicitudCardById(normalizedId)
  if (opened) {
    state.solicitudObjetivoId = null
    clearSolicitudTargetFromUrl()
  }
  return opened
}

function applyPendingSolicitudTarget() {
  if (!state.solicitudObjetivoId) return

  const opened = expandSolicitudCardById(state.solicitudObjetivoId)
  if (!opened) return

  state.solicitudObjetivoId = null
  clearSolicitudTargetFromUrl()
}

function unlockNotificationAudio() {
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext
  if (!AudioContextCtor) return

  if (!notificationAudioContext) {
    notificationAudioContext = new AudioContextCtor()
  }

  if (notificationAudioContext.state === 'suspended') {
    notificationAudioContext.resume().catch(() => {})
  }
}

function playNotificationTone() {
  if (!notificationAudioContext) return

  try {
    const context = notificationAudioContext
    if (context.state === 'suspended') {
      void context.resume().catch(() => {})
    }

    const oscillator = context.createOscillator()
    const gainNode = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = 880
    gainNode.gain.value = 0.0001
    oscillator.connect(gainNode)
    gainNode.connect(context.destination)

    const now = context.currentTime
    gainNode.gain.setValueAtTime(0.0001, now)
    gainNode.gain.exponentialRampToValueAtTime(0.12, now + 0.02)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.22)
    oscillator.start(now)
    oscillator.stop(now + 0.24)
  } catch (error) {
    console.warn('[FCM][tecnico] No se pudo reproducir sonido:', error?.message || error)
  }
}

function handleForegroundFcmMessage(payload) {
  const notification = payload?.notification || {}
  const data = payload?.data || {}
  const title = notification.title || 'FrioTech'
  const body = notification.body || 'Tienes una nueva notificación.'
  const color = data.color || 'var(--primary)'
  const targetUrl = buildSolicitudTargetUrl(data)

  showNotificationToast(title, body, color, () => {
    if (data?.id_solicitud) {
      void abrirSolicitudObjetivo(data.id_solicitud, { reload: true })
      return
    }
    window.location.href = targetUrl
  })
  playNotificationTone()

  if (canUseNotifications() && Notification.permission === 'granted') {
    try {
      const browserNotification = new Notification(title, {
        body,
        icon: '/vite.svg',
        data: {
          ...data,
          url: targetUrl,
        },
      })
      browserNotification.onclick = () => {
        window.focus()
        if (data?.id_solicitud) {
          void abrirSolicitudObjetivo(data.id_solicitud, { reload: true })
          return
        }
        window.location.href = targetUrl
      }
    } catch (error) {
      console.warn('[FCM][tecnico] No se pudo mostrar notificación nativa:', error?.message || error)
    }
  }
}

async function ensureForegroundFcmListener() {
  if (foregroundFcmListenerReady) return

  try {
    await subscribeForegroundFcmMessages(handleForegroundFcmMessage)
    foregroundFcmListenerReady = true
  } catch (error) {
    console.warn('[FCM][tecnico] No se pudo activar el listener en primer plano:', error?.message || error)
  }
}

function setSessionStatus(text, isError = false) {
  if (!sessionStatus) return
  sessionStatus.textContent = text
  sessionStatus.style.color = isError ? '#FF5A5F' : 'var(--text)'
}

function toIdString(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') {
    if (typeof value.toString === 'function') return value.toString()
    return ''
  }
  return String(value)
}

function getClienteById(clienteId) {
  const normalizedId = toIdString(clienteId)
  return state.clientes.find((cliente) => {
    const id = cliente?._id || cliente?.id || cliente?.cliente_id
    return toIdString(id) === normalizedId
  }) || null
}

function getEquipoNombreById(equipoId) {
  const normalizedId = toIdString(equipoId)
  if (!normalizedId) return '-'

  const equipo = state.equiposPorId[normalizedId]
  if (!equipo) return normalizedId

  const marca = (equipo.marca || '').trim()
  const modelo = (equipo.modelo || '').trim()
  const btus = equipo.btus ? `${equipo.btus} BTU` : ''
  const nombre = [marca, modelo].filter(Boolean).join(' ').trim() || 'Equipo'
  return btus ? `${nombre} (${btus})` : nombre
}

function formatSolicitudTipo(tipo) {
  if (tipo === 'instalacion') return 'Instalación'
  if (tipo === 'revision') return 'Revisión'
  return tipo || 'Solicitud'
}

function formatSolicitudEstado(estado) {
  if (estado === 'pendiente') return 'Pendiente'
  if (estado === 'aceptada') return 'Aceptada'
  if (estado === 'rechazada') return 'Rechazada'
  if (estado === 'completada') return 'Completada'
  return estado || 'Sin estado'
}

function formatSolicitudPrioridad(prioridad) {
  if (prioridad === 'urgente') return 'Urgente'
  if (prioridad === 'normal') return 'Normal'
  return prioridad || 'Normal'
}

function matchesSolicitudFiltro(solicitud, filtro) {
  if (filtro === 'todas') return true
  if (filtro === 'pendientes') return solicitud?.estado === 'pendiente'
  if (filtro === 'urgentes') return solicitud?.prioridad === 'urgente'
  if (filtro === 'aceptadas') return solicitud?.estado === 'aceptada'
  if (filtro === 'rechazadas') return solicitud?.estado === 'rechazada'
  if (filtro === 'completadas') return solicitud?.estado === 'completada'
  return true
}

function formatSolicitudFecha(fecha) {
  if (!fecha) return '-'
  const valor = new Date(fecha)
  return Number.isNaN(valor.getTime()) ? '-' : valor.toLocaleString()
}

function formatHistorialAccionLabel(accion) {
  const raw = (accion || '').toString().trim().toLowerCase()
  let key = raw

  if (raw.includes('estadosolicitud.')) {
    const estado = raw.split('estadosolicitud.').pop()
    key = `estado_${estado}`
  }

  const labels = {
    agendada: 'Agendada',
    estado_pendiente: 'Pendiente',
    estado_aceptada: 'Aceptada',
    estado_rechazada: 'Rechazada',
    estado_completada: 'Completada',
  }
  return labels[key] || labels[raw] || accion || 'Acción'
}

function renderHistorialAccionesHtml(solicitud) {
  const historial = Array.isArray(solicitud?.historial_acciones)
    ? [...solicitud.historial_acciones]
    : []

  if (!historial.length) {
    return '<div class="text-xs text-[var(--text-dim)]">Sin historial registrado.</div>'
  }

  const rows = historial
    .sort((a, b) => new Date(b?.fecha || 0).getTime() - new Date(a?.fecha || 0).getTime())
    .map((entry) => {
      const accionLabel = formatHistorialAccionLabel(entry?.accion)
      const fechaLabel = formatSolicitudFecha(entry?.fecha)
      const nota = (entry?.nota || '').toString().trim()
      return `
        <li class="surface rounded-xl border border-white/10 p-2">
          <div class="flex items-center justify-between gap-2">
            <strong class="text-[var(--text)]">${accionLabel}</strong>
            <span class="text-xs text-[var(--text-dim)]">${fechaLabel}</span>
          </div>
          ${nota ? `<div class="mt-1 text-xs text-[var(--text-dim)]">${nota}</div>` : ''}
        </li>
      `
    })
    .join('')

  return `<ul class="mt-1 grid gap-2">${rows}</ul>`
}

function getSolicitudId(solicitud) {
  return toIdString(solicitud?._id || solicitud?.id)
}

function sortSolicitudesPorFechaAsc(solicitudes) {
  return [...(solicitudes || [])].sort((a, b) => {
    const fechaA = new Date(a?.creado_en || 0).getTime()
    const fechaB = new Date(b?.creado_en || 0).getTime()
    return fechaA - fechaB
  })
}

function toDateKey(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatMonthLabel(value) {
  return new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(value)
}

function formatBogotaLongDate(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function getSolicitudesAgendadasByDate() {
  const grouped = new Map()
  state.solicitudes.forEach((solicitud) => {
    if (!solicitud?.fecha_agendada) return
    const key = toDateKey(solicitud.fecha_agendada)
    if (!key) return
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key).push(solicitud)
  })
  return grouped
}

function renderAgendasDayDetail() {
  if (!agendasDayDetail) return

  const selectedKey = state.agendasSelectedDate
  if (!selectedKey) {
    agendasDayDetail.innerHTML = 'Selecciona un día para ver el detalle de agendas.'
    return
  }

  const grouped = getSolicitudesAgendadasByDate()
  const agendas = grouped.get(selectedKey) || []
  const selectedDate = new Date(`${selectedKey}T12:00:00`)
  const label = Number.isNaN(selectedDate.getTime())
    ? selectedKey
    : formatBogotaLongDate(selectedDate)

  if (!agendas.length) {
    agendasDayDetail.innerHTML = `<strong class="text-[var(--text)]">${label}</strong><div class="mt-2">Sin agendas para este día.</div>`
    return
  }

  const cards = agendas
    .sort((a, b) => new Date(a.fecha_agendada).getTime() - new Date(b.fecha_agendada).getTime())
    .map((solicitud) => {
      const estado = (solicitud.estado || '').toString()
      const badgeClass = estado === 'completada' ? 'badge-success' : 'badge-primary'
      return `
        <article class="surface rounded-2xl p-3 border border-white/10">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-[var(--text)] font-display">${formatSolicitudTipo(solicitud.tipo)}</p>
              <p class="text-xs text-[var(--text-dim)]">${solicitud.descripcion || 'Sin descripción'}</p>
            </div>
            <span class="badge ${badgeClass}">${estado || 'sin estado'}</span>
          </div>
          <div class="mt-2 text-xs text-[var(--text-dim)]">Hora: ${formatSolicitudFecha(solicitud.fecha_agendada)}</div>
        </article>
      `
    }).join('')

  agendasDayDetail.innerHTML = `
    <strong class="text-[var(--text)]">${label}</strong>
    <div class="mt-3 grid gap-2">${cards}</div>
  `
}

function renderAgendasCalendar() {
  if (!agendasCalendarGrid || !agendasMonthLabel) return

  const monthStart = new Date(state.agendasCalendarMonth.getFullYear(), state.agendasCalendarMonth.getMonth(), 1)
  agendasMonthLabel.textContent = formatMonthLabel(monthStart)

  const grouped = getSolicitudesAgendadasByDate()
  const firstWeekday = monthStart.getDay()
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate()
  const todayKey = toDateKey(new Date())
  agendasCalendarGrid.innerHTML = ''

  for (let i = 0; i < firstWeekday; i += 1) {
    const pad = document.createElement('div')
    pad.className = 'agenda-day-pad'
    agendasCalendarGrid.appendChild(pad)
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), day)
    const key = toDateKey(date)
    const agendas = grouped.get(key) || []

    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'agenda-day-btn'
    if (key === todayKey) btn.classList.add('is-today')
    if (agendas.length) btn.classList.add('has-agendas')
    if (state.agendasSelectedDate === key) btn.classList.add('is-selected')

    btn.innerHTML = `
      <span class="agenda-day-number">${day}</span>
      <span class="agenda-day-count">${agendas.length ? `${agendas.length} agenda${agendas.length > 1 ? 's' : ''}` : ''}</span>
    `

    btn.addEventListener('click', () => {
      state.agendasSelectedDate = key
      renderAgendasCalendar()
      renderAgendasDayDetail()
    })

    agendasCalendarGrid.appendChild(btn)
  }

  if (!state.agendasSelectedDate) {
    const dateWithAgenda = [...grouped.keys()].find((key) => {
      const d = new Date(`${key}T00:00:00`)
      return d.getFullYear() === monthStart.getFullYear() && d.getMonth() === monthStart.getMonth()
    })
    if (dateWithAgenda) {
      state.agendasSelectedDate = dateWithAgenda
      renderAgendasCalendar()
      return
    }
  }
}

function syncAgendasCalendarWithData() {
  const agendas = state.solicitudes
    .filter((solicitud) => solicitud?.fecha_agendada)
    .sort((a, b) => new Date(a.fecha_agendada).getTime() - new Date(b.fecha_agendada).getTime())

  if (!agendas.length) {
    state.agendasSelectedDate = null
    renderAgendasCalendar()
    renderAgendasDayDetail()
    return
  }

  if (!state.agendasSelectedDate) {
    const first = new Date(agendas[0].fecha_agendada)
    if (!Number.isNaN(first.getTime())) {
      state.agendasCalendarMonth = new Date(first.getFullYear(), first.getMonth(), 1)
      state.agendasSelectedDate = toDateKey(first)
    }
  }

  renderAgendasCalendar()
  renderAgendasDayDetail()
}

function expandNotificacionesPanel() {
  notificacionesPanelBody?.classList.remove('hidden')
  if (notificacionesHeader) {
    notificacionesHeader.classList.add('expanded')
    notificacionesHeader.setAttribute('aria-expanded', 'true')
  }
}

function collapseNotificacionesPanel() {
  notificacionesPanelBody?.classList.add('hidden')
  if (notificacionesHeader) {
    notificacionesHeader.classList.remove('expanded')
    notificacionesHeader.setAttribute('aria-expanded', 'false')
  }
}

function expandClientesPanel() {
  clientesPanelBody?.classList.remove('hidden')
  if (clientesHeader) {
    clientesHeader.classList.add('expanded')
    clientesHeader.setAttribute('aria-expanded', 'true')
  }
}

function collapseClientesPanel() {
  clientesPanelBody?.classList.add('hidden')
  if (clientesHeader) {
    clientesHeader.classList.remove('expanded')
    clientesHeader.setAttribute('aria-expanded', 'false')
  }
}

function expandAgendasPanel() {
  agendasPanelBody?.classList.remove('hidden')
  if (agendasHeader) {
    agendasHeader.classList.add('expanded')
    agendasHeader.setAttribute('aria-expanded', 'true')
  }
}

function collapseAgendasPanel() {
  agendasPanelBody?.classList.add('hidden')
  if (agendasHeader) {
    agendasHeader.classList.remove('expanded')
    agendasHeader.setAttribute('aria-expanded', 'false')
  }
}

function toggleAgendasPanel() {
  if (!agendasPanelBody) return
  const isHidden = agendasPanelBody.classList.contains('hidden')
  if (isHidden) {
    expandAgendasPanel()
    syncAgendasCalendarWithData()
  } else {
    collapseAgendasPanel()
  }
}

function toggleClientesPanel() {
  if (!clientesPanelBody) return
  const isHidden = clientesPanelBody.classList.contains('hidden')
  if (isHidden) {
    expandClientesPanel()
  } else {
    collapseClientesPanel()
  }
}

function toggleNotificacionesPanel() {
  if (!notificacionesPanelBody) return
  const isHidden = notificacionesPanelBody.classList.contains('hidden')
  if (isHidden) {
    expandNotificacionesPanel()
  } else {
    collapseNotificacionesPanel()
  }
}

function buildSolicitudCard(solicitud) {
  const card = document.createElement('article')
  card.className = 'accordion-item surface-raised rounded-3xl p-4 border border-white/10 shadow-lg'
  const solicitudId = getSolicitudId(solicitud)
  card.dataset.solicitudId = solicitudId

  const cliente = getClienteById(solicitud.id_cliente)
  const clienteNombre = cliente?.nombre || 'Cliente no encontrado'
  const clienteCedula = cliente?.cedula ? `Cédula ${cliente.cedula}` : toIdString(solicitud.id_cliente)
  const prioridadClass = solicitud.prioridad === 'urgente' ? 'badge-danger' : 'badge-primary'
  const textoBotonAgenda = solicitud.fecha_agendada ? 'Reagendar' : 'Acepta y Agendar'
  const puedeAgendar = solicitud.estado !== 'rechazada' && solicitud.estado !== 'completada'
  const puedeRechazar = solicitud.estado !== 'rechazada' && solicitud.estado !== 'completada'
  const puedeCompletar = solicitud.estado === 'aceptada'

  card.innerHTML = `
    <button type="button" class="accordion-header w-full text-left" aria-expanded="false">
      <div>
        <p class="text-sm text-[var(--text-dim)]">${clienteNombre}</p>
        <h3 class="text-lg font-display">${formatSolicitudTipo(solicitud.tipo)}</h3>
        <p class="text-xs text-[var(--text-dim)]">${clienteCedula}</p>
      </div>
      <div class="grid justify-items-end gap-2">
        <span class="badge ${prioridadClass} w-fit">${formatSolicitudPrioridad(solicitud.prioridad)}</span>
        <span class="badge badge-success w-fit">${formatSolicitudEstado(solicitud.estado)}</span>
      </div>
      <span class="accordion-icon !rounded-full !w-10 !h-10">+</span>
    </button>
    <div class="accordion-panel hidden mt-4 grid gap-2 text-sm text-[var(--text-dim)]">
      <div><span class="text-[var(--text)]">Creada:</span> ${formatSolicitudFecha(solicitud.creado_en)}</div>
      <div><span class="text-[var(--text)]">Descripción:</span> ${solicitud.descripcion || 'Sin descripción'}</div>
      ${solicitud.motivo_rechazo ? `<div><span class="text-[var(--text)]">Motivo de rechazo:</span> ${solicitud.motivo_rechazo}</div>` : ''}
      <div><span class="text-[var(--text)]">Agenda:</span> ${formatSolicitudFecha(solicitud.fecha_agendada)}</div>
      <div class="mt-2">
        <span class="text-[var(--text)]">Historial de acciones:</span>
        ${renderHistorialAccionesHtml(solicitud)}
      </div>
      <div class="pt-2 flex flex-wrap gap-2">
        <button type="button" class="btn-primary btn-small" data-action="aceptar-agendar" ${puedeAgendar ? '' : 'disabled'}>${puedeAgendar ? textoBotonAgenda : 'Completada'}</button>
        <button type="button" class="btn-secondary btn-small" data-action="rechazar-solicitud" ${puedeRechazar ? '' : 'disabled'}>${puedeRechazar ? 'Rechazar' : 'Rechazada'}</button>
        <button type="button" class="btn-secondary btn-small" data-action="completar-solicitud" ${puedeCompletar ? '' : 'disabled'}>${puedeCompletar ? 'Terminar con éxito' : 'Completada'}</button>
      </div>
    </div>
  `

  const header = card.querySelector('.accordion-header')
  const panel = card.querySelector('.accordion-panel')
  const icon = card.querySelector('.accordion-icon')
  const agendarBtn = card.querySelector('[data-action="aceptar-agendar"]')
  const rechazarBtn = card.querySelector('[data-action="rechazar-solicitud"]')
  const completarBtn = card.querySelector('[data-action="completar-solicitud"]')

  header?.addEventListener('click', () => {
    const expanded = header.classList.toggle('expanded')
    header.setAttribute('aria-expanded', expanded.toString())
    panel?.classList.toggle('hidden', !expanded)
    if (icon) icon.textContent = '+'
  })

  agendarBtn?.addEventListener('click', (event) => {
    event.stopPropagation()
    if (!solicitudId) return
    window.location.href = `/agenda.html?solicitud=${encodeURIComponent(solicitudId)}`
  })

  rechazarBtn?.addEventListener('click', async (event) => {
    event.stopPropagation()
    if (!solicitudId || !puedeRechazar) return

    const motivoInput = window.prompt('Motivo de rechazo (opcional):', '')
    if (motivoInput === null) return
    const motivoRechazo = motivoInput.trim()

    const previousLabel = rechazarBtn.textContent || 'Rechazar'
    rechazarBtn.textContent = 'Rechazando...'
    rechazarBtn.setAttribute('disabled', 'true')

    try {
      const updated = await apiFetch(`/api/tecnico/solicitudes/${solicitudId}/estado`, {
        method: 'PATCH',
        body: JSON.stringify({
          estado: 'rechazada',
          motivo_rechazo: motivoRechazo || null,
        }),
      })

      state.solicitudes = state.solicitudes.map((item) => {
        const id = getSolicitudId(item)
        return id === solicitudId ? updated : item
      })
      state.solicitudes = state.solicitudes.filter((item) => item?.estado !== 'rechazada')

      renderSolicitudes()
      setSessionStatus('Solicitud rechazada y cliente notificado.')
    } catch (error) {
      rechazarBtn.textContent = previousLabel
      rechazarBtn.removeAttribute('disabled')
      setSessionStatus(error?.message || 'No se pudo rechazar la solicitud.', true)
    }
  })

  completarBtn?.addEventListener('click', async (event) => {
    event.stopPropagation()
    if (!solicitudId || !puedeCompletar) return

    const notaAccion = await openCompletionNoteModal()
    if (!notaAccion) return

    const previousLabel = completarBtn.textContent || 'Terminar con éxito'
    completarBtn.textContent = 'Finalizando...'
    completarBtn.setAttribute('disabled', 'true')

    try {
      const updated = await apiFetch(`/api/tecnico/solicitudes/${solicitudId}/estado`, {
        method: 'PATCH',
        body: JSON.stringify({
          estado: 'completada',
          nota_accion: notaAccion,
        }),
      })

      state.solicitudes = state.solicitudes.map((item) => {
        const id = getSolicitudId(item)
        return id === solicitudId ? updated : item
      })

      renderSolicitudes()
      setSessionStatus('Solicitud marcada como completada con éxito.')
    } catch (error) {
      completarBtn.textContent = previousLabel
      completarBtn.removeAttribute('disabled')
      setSessionStatus(error?.message || 'No se pudo completar la solicitud.', true)
    }
  })

  return card
}

async function listarSolicitudesRecibidas() {
  return apiFetch('/api/tecnico/solicitudes/')
}

async function cargarEquiposLookup() {
  try {
    const equipos = await fetchTodosEquipos()
    const lookup = {}

    ;(equipos || []).forEach((equipo) => {
      const id = toIdString(equipo?._id || equipo?.id)
      if (!id) return
      lookup[id] = equipo
    })

    state.equiposPorId = lookup
  } catch (error) {
    state.equiposPorId = {}
    console.warn('[Equipos][tecnico] No se pudo crear lookup de equipos:', error?.message || error)
  }
}

function renderSolicitudes() {
  if (!notificacionesList || !notificacionesEmpty) return

  notificacionesList.innerHTML = ''
  const solicitudesVisibles = state.solicitudes.filter((solicitud) => solicitud?.estado !== 'rechazada')
  const solicitudesOrdenadas = sortSolicitudesPorFechaAsc(solicitudesVisibles)
  const solicitudesFiltradas = solicitudesOrdenadas.filter((solicitud) => matchesSolicitudFiltro(solicitud, state.solicitudesFiltro))
  if (notificacionesCount) notificacionesCount.textContent = String(solicitudesFiltradas.length)

  if (!solicitudesFiltradas.length) {
    notificacionesEmpty.classList.remove('hidden')
    notificacionesEmpty.textContent = state.solicitudes.length
      ? 'No hay solicitudes para este filtro.'
      : 'No tienes solicitudes nuevas para mostrar.'
    return
  }

  notificacionesEmpty.classList.add('hidden')
  solicitudesFiltradas.forEach((solicitud) => {
    notificacionesList.appendChild(buildSolicitudCard(solicitud))
  })
  applyPendingSolicitudTarget()
  syncAgendasCalendarWithData()
}

async function cargarSolicitudesRecibidas() {
  if (!state.token) return
  setSessionStatus('Cargando solicitudes recibidas...')
  try {
    await cargarEquiposLookup()
    state.solicitudes = sortSolicitudesPorFechaAsc(await listarSolicitudesRecibidas())
    renderSolicitudes()
    setSessionStatus(state.solicitudes.length ? 'Solicitudes cargadas' : 'Sin solicitudes nuevas')
  } catch (error) {
    if (notificacionesEmpty) {
      notificacionesEmpty.classList.remove('hidden')
      notificacionesEmpty.textContent = 'No se pudieron cargar las solicitudes.'
    }
    setSessionStatus('No se pudieron cargar las solicitudes', true)
    console.warn('[Solicitudes][tecnico] No se pudieron cargar:', error?.message || error)
  }
}

notificacionesFilter?.addEventListener('change', () => {
  state.solicitudesFiltro = notificacionesFilter.value || 'todas'
  renderSolicitudes()
})

function setAuth(token, tecnico) {
  state.token = token
  state.tecnico = tecnico
  localStorage.setItem(storageKey, token)
  localStorage.setItem(tecnicoDataKey, JSON.stringify(tecnico))
  logoutButton?.classList.remove('hidden')
  menuContainer?.classList.remove('hidden')
  loginForm?.classList.add('hidden')
  statsPanel?.classList.remove('hidden')
  clientesSection?.classList.remove('hidden')
  agendasSection?.classList.remove('hidden')
  notificacionesSection?.classList.remove('hidden')
  collapseNotificacionesPanel()
  collapseClientesPanel()
  collapseAgendasPanel()
  tecnicoSubtitle?.classList.add('hidden')
  heroCopy?.classList.add('hidden')
  state.solicitudObjetivoId = readSolicitudTargetFromUrl()
  setSessionStatus('Verificando notificaciones...')
}

async function tryRegisterTecnicoFcm({ interactive = false } = {}) {
  if (!state.token || !canUseNotifications()) return
  if (!interactive && Notification.permission !== 'granted') return

  try {
    await registerFcmToken({
      apiBase: API_BASE,
      authToken: state.token,
      audience: 'tecnico',
    })
    setSessionStatus('Notificaciones activas')
  } catch (error) {
    setSessionStatus(formatFcmSetupError(error), true)
    console.warn('[FCM][tecnico] No se pudo registrar token:', error?.message || error)
  }
}

function clearAuth() {
  state.token = null
  state.tecnico = null
  state.clientes = []
  localStorage.removeItem(storageKey)
  localStorage.removeItem(tecnicoDataKey)
  logoutButton?.classList.add('hidden')
  menuContainer?.classList.add('hidden')
  closeMenu()
  loginForm?.classList.remove('hidden')
  statsPanel?.classList.add('hidden')
  clientesSection?.classList.add('hidden')
  agendasSection?.classList.add('hidden')
  notificacionesSection?.classList.add('hidden')
  collapseClientesPanel()
  collapseAgendasPanel()
  collapseNotificacionesPanel()
  statusBadges && (statusBadges.innerHTML = '')
  if (clientesList) clientesList.innerHTML = ''
  if (notificacionesList) notificacionesList.innerHTML = ''
  if (notificacionesEmpty) notificacionesEmpty.classList.add('hidden')
  emptyState?.classList.add('hidden')
  if (menuTechnicianName) menuTechnicianName.textContent = ''
  tecnicoSubtitle?.classList.remove('hidden')
  heroCopy?.classList.remove('hidden')
  setSessionStatus('Listo')
  setMessage('Ingrese su cédula y contraseña para ver los clientes.')
}

async function apiFetch(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  const parseResponseBody = async () => {
    const raw = await response.text().catch(() => '')
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch (_) {
      return { _raw: raw }
    }
  }

  if (!response.ok) {
    const error = await parseResponseBody()
    throw new Error(error?.detail || response.statusText || 'Error de red')
  }

  return parseResponseBody()
}

async function loginTecnico(cedula, password) {
  const response = await fetch(`${API_BASE}/api/tecnico/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cedula, password }),
  })

  const parseResponseBody = async () => {
    const raw = await response.text().catch(() => '')
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch (_) {
      return { _raw: raw }
    }
  }

  if (!response.ok) {
    const error = await parseResponseBody()
    throw new Error(error?.detail || response.statusText || 'Error de autenticación')
  }

  const data = await parseResponseBody()
  if (!data?.access_token) {
    throw new Error('La API respondió vacío o con formato inválido. Verifica VITE_API_BASE y el estado de friotech-api en Render.')
  }
  return data
}

async function listarClientes() {
  return apiFetch('/api/tecnico/clientes/')
}

function buildClienteCard(cliente) {
  const card = document.createElement('article')
  card.className = 'accordion-item surface-raised rounded-3xl p-4 border border-white/10 shadow-lg'

  const clienteId = cliente._id || cliente.id || cliente['_id']

  card.innerHTML = `
    <button type="button" class="accordion-header w-full text-left" aria-expanded="false">
      <div>
        <p class="text-sm text-[var(--text-dim)]">${cliente.cedula || 'Sin cédula'}</p>
        <h3 class="text-lg font-display">${cliente.nombre || 'Cliente'}</h3>
        <p class="text-xs text-[var(--text-dim)]">${cliente.telefono || 'Sin teléfono'}</p>
      </div>
      <div class="grid justify-items-end gap-2">
        <span class="badge badge-primary w-fit">Cliente</span>
      </div>
      <span class="accordion-icon flex-shrink-0 !rounded-full !w-10 !h-10">+</span>
    </button>
    <div class="accordion-panel hidden mt-4 grid gap-3 text-sm text-[var(--text-dim)]">
      <div class="grid gap-2 sm:grid-cols-2">
        <div><span class="text-[var(--text)]">Nombre:</span> ${cliente.nombre || '-'}</div>
        <div><span class="text-[var(--text)]">Cédula:</span> ${cliente.cedula || '-'}</div>
        <div><span class="text-[var(--text)]">Teléfono:</span> ${cliente.telefono || '-'}</div>
        <div><span class="text-[var(--text)]">Dirección:</span> ${cliente.direccion || '-'}</div>
      </div>
      <div class="flex justify-center">
        <button type="button" class="btn-primary btn-small" data-action="ver-equipos">Ver equipos</button>
      </div>
    </div>
  `

  const header = card.querySelector('.accordion-header')
  const panel = card.querySelector('.accordion-panel')
  const icon = card.querySelector('.accordion-icon')
  const verEquiposBtn = card.querySelector('[data-action="ver-equipos"]')

  header?.addEventListener('click', () => {
    const expanded = header.classList.toggle('expanded')
    header.setAttribute('aria-expanded', expanded.toString())
    panel?.classList.toggle('hidden', !expanded)
    if (icon) icon.textContent = '+'
  })

  verEquiposBtn?.addEventListener('click', (event) => {
    event.stopPropagation()
    openClienteEquipos(cliente, clienteId)
  })

  return card
}

async function fetchEquiposPorCliente(clienteId) {
  return apiFetch(`/api/tecnico/equipos/cliente/${clienteId}`)
}

async function fetchTodosEquipos() {
  return apiFetch('/api/tecnico/equipos/')
}

function buildEquipoCardMini(equipo) {
  const card = document.createElement('article')
  card.className = 'card surface-raised'
  card.innerHTML = `
    <div class="card-head">
      <div>
        <p class="card-title">${equipo.marca || equipo.modelo || 'Equipo'}</p>
        <p class="text-sm text-[var(--text-dim)]">${equipo.btus ? equipo.btus + ' BTU' : (equipo.modelo || '')}</p>
      </div>
      <span class="badge ${equipo.estado && equipo.estado.includes('ATENC') ? 'badge-danger' : 'badge-primary'}">${(equipo.estado || '').replace(/_/g, ' ')}</span>
    </div>
    <div class="mt-3">
      <div class="text-sm text-[var(--text-dim)]">Próximo mantenimiento</div>
      <div class="font-mono">${formatColombiaDate(equipo.fecha_proximo_mantenimiento)}</div>
    </div>
  `
  return card
}

function formatColombiaDate(value) {
  if (!value) return '-'
  const dateString = typeof value === 'string' ? value.split('T')[0] : value instanceof Date ? value.toISOString().split('T')[0] : ''
  if (!dateString) return '-'
  const [year, month, day] = dateString.split('-').map(Number)
  if (!year || !month || !day) return '-'
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

async function openClienteEquipos(cliente, clienteId) {
  // Open equipos in a new window/tab instead of using the modal
  const nombre = cliente?.nombre || ''
  const cedula = cliente?.cedula || ''
  const url = `/equipos.html?cliente_id=${encodeURIComponent(clienteId)}&nombre=${encodeURIComponent(nombre)}&cedula=${encodeURIComponent(cedula)}`
  window.location.href = url
}

function closeClienteEquiposModal() {
  if (!clienteEquiposModal) return
  clienteEquiposModal.classList.add('hidden')
  clienteEquiposModal.classList.remove('flex')
  if (modalEquiposList) modalEquiposList.innerHTML = ''
}

closeClienteEquipos?.addEventListener('click', closeClienteEquiposModal)
clienteEquiposBackdrop?.addEventListener('click', closeClienteEquiposModal)
verTodosEquiposBtn?.addEventListener('click', async (e) => {
  e.preventDefault()
  if (!modalEquiposList) return
  modalEquiposList.innerHTML = ''
  try {
    const equipos = await fetchTodosEquipos()
    if (!equipos?.length) {
      modalEmpty.classList.remove('hidden')
      return
    }
    modalEmpty.classList.add('hidden')
    equipos.forEach((eq) => modalEquiposList.appendChild(buildEquipoCardMini(eq)))
  } catch (err) {
    modalEmpty.classList.remove('hidden')
    modalEmpty.textContent = 'Error cargando equipos.'
  }
})

function renderClientes() {
  if (!clientesList || !emptyState) return
  clientesList.innerHTML = ''

  if (!state.clientes?.length) {
    clientesSection?.classList.add('hidden')
    if (clientesSectionCount) clientesSectionCount.textContent = '0'
    emptyState.classList.remove('hidden')
    emptyState.textContent = 'No hay clientes registrados por este técnico.'
    return
  }

  emptyState.classList.add('hidden')
  clientesSection?.classList.remove('hidden')
  state.clientes.forEach((cliente) => {
    clientesList.appendChild(buildClienteCard(cliente))
  })

  if (clientesSectionCount) clientesSectionCount.textContent = String(state.clientes.length)

  if (clientesCount) clientesCount.textContent = String(state.clientes.length)
  if (lastCliente) {
    const ultimo = state.clientes[state.clientes.length - 1]
    lastCliente.textContent = ultimo ? `${ultimo.nombre} (${ultimo.cedula})` : '-'
  }

  if (statusBadges) {
    statusBadges.innerHTML = `
      <span class="badge badge-success">Clientes: ${state.clientes.length}</span>
      <span class="badge badge-primary">Registrados por ti</span>
    `
  }
  if (menuTechnicianName && state.tecnico) {
    menuTechnicianName.textContent = `Técnico: ${state.tecnico.nombres} ${state.tecnico.apellidos}`
  }
}

async function init() {
  if (!loginForm || !logoutButton || !statsPanel || !clientesSection || !agendasSection || !notificacionesSection) return

  showInstallButton(false)
  void registerAppServiceWorker()

  void ensureForegroundFcmListener()

  if (state.token && state.tecnico) {
    setAuth(state.token, state.tecnico)
    setMessage('Recuperando clientes...')
    try {
      state.clientes = await listarClientes()
      renderClientes()
      void cargarSolicitudesRecibidas()
      void tryRegisterTecnicoFcm({ interactive: false })
      setMessage('Clientes cargados correctamente.')
    } catch (err) {
      clearAuth()
      setMessage(err.message, true)
    }
  } else {
    clearAuth()
  }
}

loginForm?.addEventListener('submit', async (event) => {
  event.preventDefault()
  unlockNotificationAudio()
  setMessage('Cargando...')
  try {
    const cedula = cedulaInput.value.trim()
    const password = passwordInput.value.trim()
    if (!cedula || !password) throw new Error('Ingresa cédula y contraseña válidas.')
    const data = await loginTecnico(cedula, password)
    setAuth(data.access_token, data.tecnico)
    state.clientes = await listarClientes()
    renderClientes()
    void cargarSolicitudesRecibidas()
    void tryRegisterTecnicoFcm({ interactive: true })
    setMessage('Sesión iniciada. Clientes cargados.')
  } catch (err) {
    clearAuth()
    setMessage(err.message, true)
  }
})

logoutButton?.addEventListener('click', () => {
  clearAuth()
  closeMenu()
  setMessage('Sesión cerrada. Ingresa tus credenciales para continuar.')
})

menuToggle?.addEventListener('click', () => {
  toggleMenu()
})

menuItems.forEach((item) => {
  item.addEventListener('click', () => {
    const action = item.getAttribute('data-action')
    if (action === 'agenda') {
      expandAgendasPanel()
      agendasSection?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      void cargarSolicitudesRecibidas()
    }
    if (action === 'notificaciones') {
      expandNotificacionesPanel()
      notificacionesSection?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      void cargarSolicitudesRecibidas()
    }
    closeMenu()
  })
})

clientesHeader?.addEventListener('click', toggleClientesPanel)
agendasHeader?.addEventListener('click', toggleAgendasPanel)
notificacionesHeader?.addEventListener('click', toggleNotificacionesPanel)

agendasMonthPrev?.addEventListener('click', () => {
  state.agendasCalendarMonth = new Date(state.agendasCalendarMonth.getFullYear(), state.agendasCalendarMonth.getMonth() - 1, 1)
  renderAgendasCalendar()
  renderAgendasDayDetail()
})

agendasMonthNext?.addEventListener('click', () => {
  state.agendasCalendarMonth = new Date(state.agendasCalendarMonth.getFullYear(), state.agendasCalendarMonth.getMonth() + 1, 1)
  renderAgendasCalendar()
  renderAgendasDayDetail()
})

document.addEventListener('click', (event) => {
  if (!menuContainer || !menuDropdown) return
  const target = event.target
  if (menuContainer.contains(target)) return
  if (menuBackdrop?.contains(target)) {
    closeMenu()
    return
  }
  closeMenu()
})

init()

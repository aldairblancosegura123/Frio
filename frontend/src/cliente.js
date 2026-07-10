import './index.css'
import { canUseNotifications, registerFcmToken, subscribeForegroundFcmMessages } from './fcm.js'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

const storageKey = 'friotech_cliente_token'
const clienteDataKey = 'friotech_cliente_data'

const clienteLoginForm = document.querySelector('#clienteLoginForm')
const clienteCedulaInput = document.querySelector('#clienteCedulaInput')
const clienteLoginMessage = document.querySelector('#clienteLoginMessage')
const clienteSubtitle = document.querySelector('#clienteSubtitle')
const menuContainer = document.querySelector('#menuContainer')
const menuToggle = document.querySelector('#menuToggle')
const menuDropdown = document.querySelector('#menuDropdown')
const menuBackdrop = document.querySelector('#menuBackdrop')
const menuClientName = document.querySelector('#menuClientName')
const menuItems = document.querySelectorAll('.menu-item[data-target]')
const logoutBtn = document.querySelector('#logoutBtn')
const clienteAppSection = document.querySelector('#clienteAppSection')

const equiposCount = document.querySelector('#equiposCount')
const equiposEmpty = document.querySelector('#equiposEmpty')
const equiposList = document.querySelector('#equiposList')
const equiposFilter = document.querySelector('#equiposFilter')

const calificarForm = document.querySelector('#calificarForm')
const calificarTecnico = document.querySelector('#calificarTecnico')
const calificarPuntaje = document.querySelector('#calificarPuntaje')
const calificarComentario = document.querySelector('#calificarComentario')
const calificarMsg = document.querySelector('#calificarMsg')

const solicitudInstalacionForm = document.querySelector('#solicitudInstalacionForm')
const instalacionTecnico = document.querySelector('#instalacionTecnico')
const instalacionDescripcion = document.querySelector('#instalacionDescripcion')
const instalacionMsg = document.querySelector('#instalacionMsg')

const solicitudRevisionForm = document.querySelector('#solicitudRevisionForm')
const revisionTecnico = document.querySelector('#revisionTecnico')
const revisionEquipo = document.querySelector('#revisionEquipo')
const revisionPrioridad = document.querySelector('#revisionPrioridad')
const revisionDescripcion = document.querySelector('#revisionDescripcion')
const revisionMsg = document.querySelector('#revisionMsg')

const solicitudesEmpty = document.querySelector('#solicitudesEmpty')
const solicitudesList = document.querySelector('#solicitudesList')
const solicitudesEstadoFilter = document.querySelector('#solicitudesEstadoFilter')
const solicitudesPrioridadFilter = document.querySelector('#solicitudesPrioridadFilter')
const agendasList = document.querySelector('#agendasList')
const agendasEmpty = document.querySelector('#agendasEmpty')
const agendasSmartFilter = document.querySelector('#agendasSmartFilter')
const agendasEstadoFilter = document.querySelector('#agendasEstadoFilter')
const accordionToggleButtons = document.querySelectorAll('[data-accordion-toggle]')

const state = {
  token: localStorage.getItem(storageKey) || null,
  cliente: JSON.parse(localStorage.getItem(clienteDataKey) || 'null'),
  equipos: [],
  tecnicos: [],
  solicitudes: [],
  tecnicoPorEquipo: {},
  agendaObjetivoId: null,
  equipoObjetivoId: null,
}

let foregroundFcmListenerReady = false

function getSolicitudId(solicitud) {
  if (!solicitud) return ''
  const rawId = solicitud.id ?? solicitud._id
  return toIdString(rawId)
}

function formatDateTime(value) {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleString()
}

function isToday(date) {
  const now = new Date()
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate()
}

function isWithinThisWeek(date) {
  const now = new Date()
  const end = new Date(now)
  end.setDate(now.getDate() + 7)
  return date >= now && date <= end
}

function matchesAgendaSmartFilter(solicitud, filter) {
  const fechaRaw = solicitud?.fecha_agendada
  if (!fechaRaw) return filter === 'todas'

  const fecha = new Date(fechaRaw)
  if (Number.isNaN(fecha.getTime())) return filter === 'todas'

  if (filter === 'todas') return true
  if (filter === 'hoy') return isToday(fecha)
  if (filter === 'semana') return isWithinThisWeek(fecha)
  if (filter === 'proximas') return fecha >= new Date()
  if (filter === 'vencidas') return fecha < new Date() && solicitud?.estado !== 'completada'
  return true
}

function renderAgendas() {
  if (!agendasList || !agendasEmpty) return

  const smartFilter = agendasSmartFilter?.value || 'todas'
  const estadoFilter = agendasEstadoFilter?.value || 'todos'

  const agendas = state.solicitudes.filter((solicitud) => {
    if (!solicitud?.fecha_agendada) return false
    const matchesSmart = matchesAgendaSmartFilter(solicitud, smartFilter)
    const matchesEstado = estadoFilter === 'todos' || solicitud.estado === estadoFilter
    return matchesSmart && matchesEstado
  })

  agendasList.innerHTML = ''
  if (!agendas.length) {
    agendasEmpty.classList.remove('hidden')
    agendasEmpty.textContent = 'No hay agendas para ese filtro.'
    return
  }

  agendasEmpty.classList.add('hidden')
  agendas.forEach((solicitud) => {
    const solicitudId = getSolicitudId(solicitud)
    const equipoLabel = getEquipoAgendaLabel(solicitud)
    const card = document.createElement('article')
    card.className = 'accordion-item surface-raised'
    card.dataset.solicitudId = solicitudId

    const estado = (solicitud.estado || '').toString()
    const badgeClass = estado === 'completada' ? 'badge-success' : 'badge-primary'
    card.innerHTML = `
      <button type="button" class="accordion-header" aria-expanded="false">
        <div>
          <p class="card-title">${solicitud.tipo === 'instalacion' ? 'Instalación' : 'Revisión'}</p>
          <p class="text-sm text-[var(--text-dim)] line-clamp-1">${solicitud.descripcion || 'Sin descripción'}</p>
        </div>
        <div class="flex items-center gap-3">
          <span class="badge ${badgeClass}">${formatEstadoSolicitudLabel(solicitud.estado)}</span>
          <span class="accordion-icon">+</span>
        </div>
      </button>
      <div class="accordion-panel hidden">
        <div class="mt-3 text-sm text-[var(--text-dim)]">
          Fecha agendada: <strong class="text-[var(--text)]">${formatDateTime(solicitud.fecha_agendada)}</strong>
        </div>
        <div class="mt-2 text-sm text-[var(--text-dim)]">
          Equipo: <strong class="text-[var(--text)]">${equipoLabel}</strong>
        </div>
        ${solicitud.nota ? `<div class="mt-3 text-sm text-[var(--text-dim)]">Nota: <span class="text-[var(--text)]">${solicitud.nota}</span></div>` : ''}
        <div class="mt-3 text-sm text-[var(--text-dim)]">
          Estado: <strong class="text-[var(--text)]">${formatEstadoSolicitudLabel(solicitud.estado)}</strong>
        </div>
        <div class="mt-3 text-sm text-[var(--text-dim)]">
          Historial de acciones:
          ${renderHistorialAccionesHtml(solicitud)}
        </div>
      </div>
    `

    const header = card.querySelector('.accordion-header')
    const panel = card.querySelector('.accordion-panel')
    header?.addEventListener('click', () => {
      const expanded = header.classList.toggle('expanded')
      header.setAttribute('aria-expanded', expanded.toString())
      panel?.classList.toggle('hidden', !expanded)
    })

    agendasList.appendChild(card)

    if (state.agendaObjetivoId && state.agendaObjetivoId === solicitudId) {
      header?.classList.add('expanded')
      header?.setAttribute('aria-expanded', 'true')
      panel?.classList.remove('hidden')
      card.classList.add('solicitud-flash')
      card.scrollIntoView({ behavior: 'smooth', block: 'center' })
      state.agendaObjetivoId = null
    }
  })
}

function openAgendasFromUrlIfNeeded() {
  try {
    const url = new URL(window.location.href)
    const shouldOpen = url.searchParams.get('agendas') === '1' || url.hash === '#agendas'
    const targetAgenda = url.searchParams.get('agenda')
    if (!shouldOpen && !targetAgenda) return

    const agendaBtn = document.querySelector('[data-accordion-toggle="agendasPanel"]')
    const agendaPanel = document.getElementById('agendasPanel')
    if (agendaBtn && agendaPanel?.classList.contains('hidden')) {
      agendaBtn.classList.add('expanded')
      agendaBtn.setAttribute('aria-expanded', 'true')
      agendaPanel.classList.remove('hidden')
    }

    const section = document.getElementById('agendasSection')
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' })

    if (targetAgenda) {
      state.agendaObjetivoId = targetAgenda
    }
  } catch (_) {
    // no-op
  }
}

function readEquipoTargetFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search)
    return params.get('equipo') || null
  } catch (_) {
    return null
  }
}

function clearEquipoTargetFromUrl() {
  try {
    const url = new URL(window.location.href)
    url.searchParams.delete('equipo')
    url.searchParams.delete('equipos')
    if (url.hash === '#equiposSection') {
      url.hash = ''
    }
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
  } catch (_) {
    // no-op
  }
}

function expandEquipoCardById(equipoId, { scroll = true } = {}) {
  const normalizedId = toIdString(equipoId)
  if (!normalizedId || !equiposList) return false

  const card = equiposList.querySelector(`[data-equipo-id="${normalizedId}"]`)
  if (!(card instanceof HTMLElement)) return false

  const equiposBtn = document.querySelector('[data-accordion-toggle="equiposPanel"]')
  const equiposPanel = document.getElementById('equiposPanel')
  if (equiposBtn && equiposPanel?.classList.contains('hidden')) {
    equiposBtn.classList.add('expanded')
    equiposBtn.setAttribute('aria-expanded', 'true')
    equiposPanel.classList.remove('hidden')
  }

  const header = card.querySelector('.accordion-header')
  const panel = card.querySelector('.accordion-panel')
  if (header instanceof HTMLElement && panel instanceof HTMLElement) {
    header.classList.add('expanded')
    header.setAttribute('aria-expanded', 'true')
    panel.classList.remove('hidden')
  }

  card.classList.remove('solicitud-flash')
  void card.offsetWidth
  card.classList.add('solicitud-flash')
  window.setTimeout(() => {
    card.classList.remove('solicitud-flash')
  }, 1800)

  if (scroll) {
    const section = document.getElementById('equiposSection')
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    card.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return true
}

function applyPendingEquipoTarget() {
  if (!state.equipoObjetivoId) return
  const opened = expandEquipoCardById(state.equipoObjetivoId)
  if (!opened) return
  state.equipoObjetivoId = null
  clearEquipoTargetFromUrl()
}

function openEquiposFromUrlIfNeeded() {
  try {
    const url = new URL(window.location.href)
    const shouldOpen = url.searchParams.get('equipos') === '1' || url.hash === '#equiposSection'
    const targetEquipo = url.searchParams.get('equipo')
    if (!shouldOpen && !targetEquipo) return

    const equiposBtn = document.querySelector('[data-accordion-toggle="equiposPanel"]')
    const equiposPanel = document.getElementById('equiposPanel')
    if (equiposBtn && equiposPanel?.classList.contains('hidden')) {
      equiposBtn.classList.add('expanded')
      equiposBtn.setAttribute('aria-expanded', 'true')
      equiposPanel.classList.remove('hidden')
    }

    const section = document.getElementById('equiposSection')
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' })

    if (targetEquipo) {
      state.equipoObjetivoId = targetEquipo
    }
  } catch (_) {
    // no-op
  }
}

function openCalificacionesFromUrlIfNeeded() {
  try {
    const url = new URL(window.location.href)
    const shouldOpen = url.searchParams.get('calificar') === '1' || url.hash === '#calificacionesSection'
    if (!shouldOpen) return

    const tecnicoTarget = url.searchParams.get('tecnico')
    openCalificacionesSection({ tecnicoId: tecnicoTarget, message: 'Tu servicio fue completado. Puedes calificar a tu técnico.' })
  } catch (_) {
    // no-op
  }
}

function openCalificacionesSection({ tecnicoId = '', message = '' } = {}) {
  const calificacionesBtn = document.querySelector('[data-accordion-toggle="calificacionesPanel"]')
  const calificacionesPanel = document.getElementById('calificacionesPanel')
  if (calificacionesBtn && calificacionesPanel?.classList.contains('hidden')) {
    calificacionesBtn.classList.add('expanded')
    calificacionesBtn.setAttribute('aria-expanded', 'true')
    calificacionesPanel.classList.remove('hidden')
  }

  if (tecnicoId && calificarTecnico) {
    const hasOption = [...calificarTecnico.options].some((opt) => opt.value === tecnicoId)
    if (hasOption) {
      calificarTecnico.value = tecnicoId
    }
  }

  const section = document.getElementById('calificacionesSection')
  section?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  if (message) {
    setMessage(calificarMsg, message)
  }
}

function buildNotificationTargetUrl(data = {}) {
  const rawUrl = data?.url || '/cliente.html'
  try {
    const url = new URL(rawUrl, window.location.origin)
    return `${url.pathname}${url.search}${url.hash}`
  } catch (_) {
    return rawUrl
  }
}

function handleForegroundFcmMessage(payload) {
  const notification = payload?.notification || {}
  const data = payload?.data || {}
  const title = notification.title || 'FrioTech'
  const body = notification.body || 'Tienes una nueva notificación.'
  const targetUrl = buildNotificationTargetUrl(data)

  if (data?.tipo === 'solicitud_completada') {
    openCalificacionesSection({
      tecnicoId: data?.id_tecnico || '',
      message: 'Tu servicio fue completado. Puedes calificar a tu técnico.',
    })
  }

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
        if (data?.tipo === 'solicitud_completada') {
          openCalificacionesSection({
            tecnicoId: data?.id_tecnico || '',
            message: 'Tu servicio fue completado. Puedes calificar a tu técnico.',
          })
          return
        }
        if (data?.tipo === 'recordatorio_mantenimiento' && data?.id_equipo) {
          state.equipoObjetivoId = data.id_equipo
        }
        window.location.href = targetUrl
      }
    } catch (error) {
      console.warn('[FCM][cliente] No se pudo mostrar notificación en primer plano:', error?.message || error)
    }
  }
}

async function ensureForegroundFcmListener() {
  if (foregroundFcmListenerReady) return
  try {
    await subscribeForegroundFcmMessages(handleForegroundFcmMessage)
    foregroundFcmListenerReady = true
  } catch (error) {
    console.warn('[FCM][cliente] No se pudo activar listener en primer plano:', error?.message || error)
  }
}

function getEquipoId(equipo) {
  if (!equipo) return ''
  const rawId = equipo.id ?? equipo._id
  return toIdString(rawId)
}

function getSolicitudEquipoId(solicitud) {
  if (!solicitud) return ''
  const rawId = solicitud.id_equipo ?? solicitud._id_equipo ?? solicitud.idEquipo
  return toIdString(rawId)
}

function getEquipoAgendaLabel(solicitud) {
  const solicitudEquipoId = getSolicitudEquipoId(solicitud)
  if (!solicitudEquipoId) return 'Sin equipo asociado'

  const equipo = state.equipos.find((item) => getEquipoId(item) === solicitudEquipoId)
  if (!equipo) return `Equipo #${solicitudEquipoId}`

  const marca = (equipo.marca || '').trim()
  const modelo = (equipo.modelo || '').trim()
  const btus = equipo.btus ? `${equipo.btus} BTU` : ''
  const nombreBase = [marca, modelo].filter(Boolean).join(' ').trim() || 'Equipo'
  return btus ? `${nombreBase} (${btus})` : nombreBase
}

function toIdString(value) {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    return String(value.$oid ?? value.oid ?? value.value ?? value.id ?? value._id ?? '')
  }
  return String(value)
}

function formatSolicitudLabel(value) {
  const prioridad = (value || '').toString()
  if (prioridad === 'urgent' || prioridad === 'urgente') return 'Urgente'
  if (prioridad === 'normal') return 'Normal'
  return prioridad ? prioridad.replace(/_/g, ' ') : 'Sin solicitudes'
}

function formatEstadoSolicitudLabel(value) {
  const estado = (value || '').toString()
  const labels = {
    pendiente: 'Pendiente',
    aceptada: 'Aceptada',
    rechazada: 'Rechazada',
    completada: 'Completada',
  }
  return labels[estado] || 'Sin solicitudes'
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
      const fechaLabel = formatDateTime(entry?.fecha)
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

function setMessage(el, text, isError = false) {
  if (!el) return
  el.textContent = text
  el.style.color = isError ? 'var(--danger)' : 'var(--text-dim)'
}

function closeMenu() {
  if (!menuDropdown) return
  menuDropdown.classList.add('hidden')
  menuBackdrop?.classList.add('hidden')
  menuToggle?.setAttribute('aria-expanded', 'false')
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

function setAuth(token, cliente) {
  state.token = token
  state.cliente = cliente
  localStorage.setItem(storageKey, token)
  localStorage.setItem(clienteDataKey, JSON.stringify(cliente))

  clienteLoginForm?.classList.add('hidden')
  clienteAppSection?.classList.remove('hidden')
  menuContainer?.classList.remove('hidden')
  if (menuClientName) {
    menuClientName.textContent = cliente?.nombre || 'Cliente'
  }
  if (clienteSubtitle) {
    clienteSubtitle.textContent = `${cliente?.nombre || 'cliente'}`
  }
}

async function tryRegisterClienteFcm({ interactive = false } = {}) {
  if (!state.token || !canUseNotifications()) return
  if (!interactive && Notification.permission !== 'granted') return

  try {
    await registerFcmToken({
      apiBase: API_BASE,
      authToken: state.token,
      audience: 'cliente',
    })
  } catch (error) {
    console.warn('[FCM][cliente] No se pudo registrar token:', error?.message || error)
  }
}

function clearAuth() {
  state.token = null
  state.cliente = null
  state.equipos = []
  state.tecnicos = []
  state.solicitudes = []
  state.tecnicoPorEquipo = {}
  localStorage.removeItem(storageKey)
  localStorage.removeItem(clienteDataKey)

  clienteLoginForm?.classList.remove('hidden')
  clienteAppSection?.classList.add('hidden')
  menuContainer?.classList.add('hidden')
  closeMenu()
  if (menuClientName) menuClientName.textContent = 'Cliente'
  if (clienteSubtitle) {
    clienteSubtitle.textContent = 'Ingresa con tu cédula o NIT para ver tus equipos, calificar y crear solicitudes.'
  }
  if (equiposList) equiposList.innerHTML = ''
  if (solicitudesList) solicitudesList.innerHTML = ''
}

async function apiFetch(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  if (state.token) headers.Authorization = `Bearer ${state.token}`

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const err = await response.json().catch(() => null)
    throw new Error(err?.detail || response.statusText || 'Error de red')
  }

  return response.json().catch(() => null)
}

function formatDate(value) {
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

function formatEstadoLabel(value) {
  const estado = (value || '').toString()
  const labels = {
    operativo: 'Operativo',
    en_revision: 'En revisión',
    fuera_de_servicio: 'Averiado',
  }
  return labels[estado] || estado.replace(/_/g, ' ') || '-'
}

function renderTecnicosSelects() {
  const options = state.tecnicos.length
    ? state.tecnicos.map((t) => `<option value="${t.id}">${t.nombres} ${t.apellidos} (${Number(t.calificacion_promedio || 0).toFixed(1)}★)</option>`).join('')
    : '<option value="">Sin tecnicos disponibles</option>'

  if (calificarTecnico) calificarTecnico.innerHTML = options
  if (instalacionTecnico) instalacionTecnico.innerHTML = options
  if (revisionTecnico) revisionTecnico.innerHTML = options
}

function renderEquiposForRevision() {
  if (!revisionEquipo) return
  revisionEquipo.value = state.equipos.length ? getEquipoId(state.equipos[0]) : ''
}

function buildSolicitudCard(s) {
  const card = document.createElement('article')
  card.className = 'accordion-item surface-raised border border-white/10'

  const prioridadLabel = s.prioridad === 'urgente' ? 'Urgente' : 'Normal'
  const prioridadClass = s.prioridad === 'urgente' ? 'badge-danger' : 'badge-primary'
  const estadoLabel = formatEstadoSolicitudLabel(s.estado)
  const estadoClass = s.estado === 'completada' ? 'badge-success' : 'badge-primary'

  card.innerHTML = `
    <button type="button" class="accordion-header items-start" aria-expanded="false">
      <div class="min-w-0 flex-1">
        <p class="card-title">${s.tipo === 'instalacion' ? 'Instalacion' : 'Revision'}</p>
        <p class="mt-1 text-sm text-[var(--text-dim)] break-words">${s.descripcion || 'Sin descripcion'}</p>
        <div class="mt-3 flex flex-wrap gap-2">
          <span class="badge ${prioridadClass}">${prioridadLabel}</span>
          <span class="badge ${estadoClass}">${estadoLabel}</span>
        </div>
      </div>
      <span class="accordion-icon shrink-0">+</span>
    </button>
    <div class="accordion-panel hidden p-4 pt-0">
      <div class="mt-3 text-sm text-[var(--text-dim)]">
        Estado: <strong class="text-[var(--text)]">${estadoLabel}</strong> · Fecha: <span class="font-mono">${formatDate(s.creado_en)}</span>
      </div>
      <div class="mt-2 text-sm text-[var(--text-dim)]">
        Descripcion: <span class="text-[var(--text)]">${s.descripcion || 'Sin descripcion'}</span>
      </div>
      ${s.nota ? `<div class="mt-2 text-sm text-[var(--text-dim)]">Nota: <span class="text-[var(--text)]">${s.nota}</span></div>` : ''}
      <div class="mt-3 border border-white/10 rounded-2xl overflow-hidden">
        <button type="button" class="accordion-header !p-3" data-role="historial-toggle" aria-expanded="false">
          <span class="text-sm text-[var(--text)]">Historial de acciones</span>
          <span class="accordion-icon !w-8 !h-8">+</span>
        </button>
        <div class="accordion-panel hidden p-3" data-role="historial-panel">
          ${renderHistorialAccionesHtml(s)}
        </div>
      </div>
    </div>
  `

  const header = card.querySelector('.accordion-header')
  const panel = card.querySelector('.accordion-panel')
  header?.addEventListener('click', () => {
    const expanded = header.classList.toggle('expanded')
    header.setAttribute('aria-expanded', expanded.toString())
    panel?.classList.toggle('hidden', !expanded)
  })

  const historyToggle = card.querySelector('[data-role="historial-toggle"]')
  const historyPanel = card.querySelector('[data-role="historial-panel"]')
  historyToggle?.addEventListener('click', (event) => {
    event.stopPropagation()
    const expanded = historyToggle.classList.toggle('expanded')
    historyToggle.setAttribute('aria-expanded', expanded.toString())
    historyPanel?.classList.toggle('hidden', !expanded)
  })

  return card
}

function buildEquipoCard(equipo) {
  const vencido = equipo.mantenimiento_vencido
  const badge = vencido
    ? '<span class="badge badge-danger">Mantenimiento vencido</span>'
    : '<span class="badge badge-success">Al día</span>'

  const estadoActual = (equipo.estado || 'operativo').toString()
  const estadoOptions = [
    { value: 'operativo', label: 'Operativo' },
    { value: 'en_revision', label: 'En revisión' },
    { value: 'fuera_de_servicio', label: 'Averiado' },
  ]
  const solicitudEstadoOptions = [
    { value: 'rutinaria', label: 'Rutinaria' },
    { value: 'prioritaria', label: 'Prioritaria' },
    { value: 'urgente', label: 'Urgente' },
  ]
  const tecnicoOptions = state.tecnicos.length
    ? state.tecnicos.map((t) => `<option value="${t.id}" ${String(t.id) === String(equipo.id_tecnico || '') ? 'selected' : ''}>${t.nombres} ${t.apellidos}</option>`).join('')
    : '<option value="">Sin técnicos disponibles</option>'
  const equipoId = getEquipoId(equipo)
  const ultimaSolicitud = [...state.solicitudes]
    .filter((s) => getSolicitudEquipoId(s) === equipoId)
    .sort((a, b) => new Date(b.creado_en || 0) - new Date(a.creado_en || 0))[0] || null

  const card = document.createElement('article')
  card.className = `accordion-item surface-raised ${vencido ? 'card-danger' : ''}`
  if (equipoId) card.dataset.equipoId = equipoId

  card.innerHTML = `
    <button type="button" class="accordion-header" aria-expanded="false">
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="card-title">${equipo.marca || 'Equipo'}</p>
          <p class="text-sm text-[var(--text-dim)]">${equipo.btus ? equipo.btus + ' BTU' : ''}</p>
        </div>
        ${badge}
      </div>
      <span class="accordion-icon">+</span>
    </button>
    <div class="accordion-panel hidden">
      <div class="mt-3">
        <div class="metric-row">
          <span>Estado</span>
          <strong>${formatEstadoLabel(equipo.estado)}</strong>
        </div>
        <div class="metric-row">
          <span>Solicitud</span>
          <strong class="font-mono ${ultimaSolicitud ? '' : 'text-[var(--text-dim)]'}">${formatEstadoSolicitudLabel(ultimaSolicitud?.estado)}</strong>
        </div>
        <div class="metric-row">
          <span>Instalación</span>
          <strong class="font-mono">${formatDate(equipo.fecha_instalacion)}</strong>
        </div>
        <div class="mt-1 flex justify-end">
          <div class="text-sm text-[var(--text-dim)] text-right" data-role="tecnico-instalacion">Instalación: cargando...</div>
        </div>
        <div class="metric-row">
          <span>Último mantenimiento</span>
          <strong class="font-mono">${formatDate(equipo.fecha_mantenimiento)}</strong>
        </div>
        <div class="mt-1 flex justify-end">
          <div class="text-sm text-[var(--text-dim)] text-right" data-role="tecnico-mantenimiento">Último mantenimiento: cargando...</div>
        </div>
        <div class="metric-row">
          <span>Próximo mantenimiento</span>
          <strong class="font-mono ${vencido ? 'text-[var(--danger)]' : ''}">${formatDate(equipo.fecha_proximo_mantenimiento)}</strong>
        </div>
        ${equipo.notas?.trim() ? `<div class="text-sm text-[var(--text-dim)] mt-3">Notas</div><div class="font-mono mt-1">${equipo.notas}</div>` : ''}
        <div class="mt-4 flex justify-center">
          <button type="button" class="btn-ghost notify-toggle-btn px-5 py-3 text-sm" data-action="toggle-notificacion" aria-expanded="false" data-expanded="false">
            <span>Notificación</span>
            <span class="accordion-icon notify-toggle-icon" aria-hidden="true">+</span>
          </button>
        </div>
        <div class="mt-4 hidden" data-role="notificacion-panel">
          <div class="surface rounded-2xl p-4 border border-white/10 grid gap-3">
            <div class="text-sm text-[var(--text-dim)]" data-role="tecnico-actual">Técnico que atendió el equipo: no consultado</div>
            <div>
              <label class="text-sm text-[var(--text-dim)]">Enviar a técnico</label>
              <select class="input-field mt-1" data-role="notify-tecnico-select">
                ${tecnicoOptions}
              </select>
            </div>
            <div>
              <label class="mt-2 inline-flex items-center gap-3 text-sm text-[var(--text)]">
                <input type="checkbox" data-role="notify-vencido-check" class="h-5 w-5 rounded border border-white/40 bg-white/10 accent-[var(--primary)] cursor-pointer" />
                <span>Mantenimiento vencido</span>
              </label>
              <label class="text-sm text-[var(--text-dim)] mt-2 block">Estado del aire</label>
              <select class="input-field mt-1" data-role="notify-estado-select">
                ${estadoOptions.map((opt) => `<option value="${opt.value}" ${opt.value === estadoActual ? 'selected' : ''}>${opt.label}</option>`).join('')}
              </select>
              <label class="text-sm text-[var(--text-dim)] mt-2 block">Estado de la solicitud</label>
              <select class="input-field mt-1" data-role="notify-solicitud-estado-select">
                ${solicitudEstadoOptions.map((opt) => `<option value="${opt.value}" ${opt.value === 'rutinaria' ? 'selected' : ''}>${opt.label}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="text-sm text-[var(--text-dim)]">Nota</label>
              <textarea class="input-field mt-1 rounded-2xl" rows="3" data-role="notify-nota" placeholder="Describe la novedad del equipo"></textarea>
            </div>
            <div class="flex flex-col items-center gap-2">
              <button class="btn-primary btn-small" data-action="enviar-notificacion">Enviar notificación</button>
              <p class="text-sm text-[var(--text-dim)] text-center" data-role="notify-msg"></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `

  const header = card.querySelector('.accordion-header')
  const panel = card.querySelector('.accordion-panel')
  header?.addEventListener('click', () => {
    const expanded = header.classList.toggle('expanded')
    header.setAttribute('aria-expanded', expanded.toString())
    panel?.classList.toggle('hidden', !expanded)
  })

  const tecnicoInstalacionEl = card.querySelector('[data-role="tecnico-instalacion"]')
  const tecnicoMantenimientoEl = card.querySelector('[data-role="tecnico-mantenimiento"]')
  const toggleNotificacionBtn = card.querySelector('[data-action="toggle-notificacion"]')
  const toggleNotificacionIcon = card.querySelector('.notify-toggle-icon')
  const notificacionPanel = card.querySelector('[data-role="notificacion-panel"]')
  const tecnicoActualEl = card.querySelector('[data-role="tecnico-actual"]')
  const notifyTecnicoSelect = card.querySelector('[data-role="notify-tecnico-select"]')
  const notifyEstadoSelect = card.querySelector('[data-role="notify-estado-select"]')
  const notifySolicitudEstadoSelect = card.querySelector('[data-role="notify-solicitud-estado-select"]')
  const notifyVencidoCheck = card.querySelector('[data-role="notify-vencido-check"]')
  const notifyNota = card.querySelector('[data-role="notify-nota"]')
  const notifyMsg = card.querySelector('[data-role="notify-msg"]')
  const enviarNotificacionBtn = card.querySelector('[data-action="enviar-notificacion"]')

  const setNotifyMessage = (text, isError = false) => {
    if (!notifyMsg) return
    notifyMsg.textContent = text
    notifyMsg.style.color = isError ? 'var(--danger)' : 'var(--text-dim)'
  }

  const syncNotifyEstadoByVencido = () => {
    if (!notifyEstadoSelect || !notifyVencidoCheck) return
    if (notifyVencidoCheck.checked) {
      notifyVencidoCheck.dataset.previousEstado = notifyEstadoSelect.value || 'operativo'
      notifyEstadoSelect.value = 'en_revision'
      notifyEstadoSelect.disabled = true
      notifyEstadoSelect.classList.add('opacity-60', 'cursor-not-allowed')
      return
    }

    notifyEstadoSelect.disabled = false
    notifyEstadoSelect.classList.remove('opacity-60', 'cursor-not-allowed')
    if (notifyVencidoCheck.dataset.previousEstado) {
      notifyEstadoSelect.value = notifyVencidoCheck.dataset.previousEstado
    }
  }

  if (notifyVencidoCheck) {
    notifyVencidoCheck.checked = !!vencido
    syncNotifyEstadoByVencido()
    notifyVencidoCheck.addEventListener('change', (event) => {
      event.stopPropagation()
      syncNotifyEstadoByVencido()
    })
  }

  const pintarTecnico = (tecnico) => {
    if (!tecnico) return
    const pintarBloqueTecnico = (el, dato, etiqueta) => {
      if (!el) return
      if (!dato) {
        el.textContent = `${etiqueta}: no disponible`
        return
      }
      el.textContent = `${etiqueta}: ${dato.nombres} ${dato.apellidos}`
    }

    pintarBloqueTecnico(tecnicoInstalacionEl, tecnico.instalacion, 'Instalación')
    pintarBloqueTecnico(tecnicoMantenimientoEl, tecnico.ultimo_mantenimiento, 'Último mantenimiento')

    if (tecnicoActualEl && tecnico.ultimo_mantenimiento) {
      tecnicoActualEl.textContent = `Técnico que atendió el equipo: ${tecnico.ultimo_mantenimiento.nombres} ${tecnico.ultimo_mantenimiento.apellidos}`
    }
    if (notifyTecnicoSelect && tecnico.ultimo_mantenimiento?.id) {
      notifyTecnicoSelect.value = String(tecnico.ultimo_mantenimiento.id)
    }
  }

  toggleNotificacionBtn?.addEventListener('click', (event) => {
    event.stopPropagation()
    if (!notificacionPanel) return
    const expanded = notificacionPanel.classList.toggle('hidden') ? false : true
    toggleNotificacionBtn.setAttribute('aria-expanded', expanded.toString())
    toggleNotificacionBtn.dataset.expanded = expanded.toString()
    if (toggleNotificacionIcon) {
      toggleNotificacionIcon.textContent = '+'
    }
    setNotifyMessage('')
  })

  const cargarTecnicosEquipo = async () => {
    if (!equipoId) {
      if (tecnicoInstalacionEl) tecnicoInstalacionEl.textContent = 'ID de equipo inválido.'
      if (tecnicoMantenimientoEl) tecnicoMantenimientoEl.textContent = 'ID de equipo inválido.'
      return
    }

    if (state.tecnicoPorEquipo[equipoId]) {
      pintarTecnico(state.tecnicoPorEquipo[equipoId])
      return
    }

    try {
      const tecnico = await apiFetch(`/api/cliente/equipos/${equipoId}/tecnico`)
      state.tecnicoPorEquipo[equipoId] = tecnico
      pintarTecnico(tecnico)
    } catch (error) {
      if (tecnicoInstalacionEl) tecnicoInstalacionEl.textContent = error.message || 'No se pudo cargar el técnico de instalación.'
      if (tecnicoMantenimientoEl) tecnicoMantenimientoEl.textContent = error.message || 'No se pudo cargar el técnico de mantenimiento.'
    }
  }

  header?.addEventListener('click', () => {
    const expanded = header.classList.contains('expanded')
    if (expanded) {
      cargarTecnicosEquipo()
    }
  })

  enviarNotificacionBtn?.addEventListener('click', async (event) => {
    event.stopPropagation()
    if (!equipo?.id || !notifyTecnicoSelect || !notifyEstadoSelect || !notifySolicitudEstadoSelect) return

    const idTecnico = notifyTecnicoSelect.value
    const estadoElegido = notifyVencidoCheck?.checked
      ? 'en_revision'
      : (notifyEstadoSelect.value || 'operativo')
    const estadoSolicitudElegido = notifySolicitudEstadoSelect.value || 'rutinaria'
    const nota = notifyNota?.value.trim() || ''

    if (!idTecnico) {
      setNotifyMessage('Selecciona un técnico para notificar.', true)
      return
    }

    const descripcion = [
      `Notificación de cliente para equipo ${equipo.marca || 'aire'}${equipo.btus ? ` (${equipo.btus} BTU)` : ''}.`,
      `Estado reportado: ${formatEstadoLabel(estadoElegido)}.`,
      `Estado de solicitud: ${estadoSolicitudElegido}.`,
      nota ? `Nota: ${nota}` : '',
    ].filter(Boolean).join(' ')

    setNotifyMessage('Enviando...')
    try {
      await apiFetch('/api/cliente/solicitudes/', {
        method: 'POST',
        body: JSON.stringify({
          tipo: 'revision',
          id_tecnico: idTecnico,
          id_equipo: equipoId,
          prioridad: estadoSolicitudElegido === 'urgente' ? 'urgente' : 'normal',
          nota,
          descripcion,
        }),
      })
      state.solicitudes = await apiFetch('/api/cliente/solicitudes/')
      renderSolicitudes()
      renderEquipos()
      setNotifyMessage('Notificación enviada correctamente.')
      if (notifyNota) notifyNota.value = ''
    } catch (error) {
      setNotifyMessage(error.message || 'No se pudo enviar la notificación.', true)
    }
  })

  return card
}

function renderEquipos() {
  if (!equiposList || !equiposCount || !equiposEmpty) return

  const filter = equiposFilter?.value || 'todos'
  const filteredEquipos = state.equipos.filter((e) => {
    if (filter === 'vencidos') return !!e.mantenimiento_vencido
    if (filter === 'al_dia') return !e.mantenimiento_vencido
    return true
  })

  equiposList.innerHTML = ''
  equiposCount.textContent = `${filteredEquipos.length} equipos`

  if (!filteredEquipos.length) {
    equiposEmpty.classList.remove('hidden')
    if (filter !== 'todos') {
      equiposEmpty.textContent = 'No hay equipos con ese filtro.'
    } else {
      equiposEmpty.textContent = 'No tienes equipos registrados.'
    }
    return
  }

  equiposEmpty.classList.add('hidden')
  filteredEquipos.forEach((e) => equiposList.appendChild(buildEquipoCard(e)))
  applyPendingEquipoTarget()
}

function renderSolicitudes() {
  if (!solicitudesList || !solicitudesEmpty) return

  const estadoFilter = solicitudesEstadoFilter?.value || 'todas'
  const prioridadFilter = solicitudesPrioridadFilter?.value || 'todas'
  const filteredSolicitudes = state.solicitudes.filter((s) => {
    const matchesEstado = estadoFilter === 'todas' || s.estado === estadoFilter
    const matchesPrioridad = prioridadFilter === 'todas' || s.prioridad === prioridadFilter
    return matchesEstado && matchesPrioridad
  })

  solicitudesList.innerHTML = ''
  if (!filteredSolicitudes.length) {
    solicitudesEmpty.classList.remove('hidden')
    solicitudesEmpty.textContent = 'No hay solicitudes con ese filtro.'
    return
  }

  solicitudesEmpty.classList.add('hidden')
  filteredSolicitudes.forEach((s) => solicitudesList.appendChild(buildSolicitudCard(s)))
}

async function loadDashboardData() {
  const [equipos, tecnicos, solicitudes] = await Promise.all([
    apiFetch('/api/cliente/equipos/'),
    apiFetch('/api/cliente/tecnicos/recomendados'),
    apiFetch('/api/cliente/solicitudes/'),
  ])

  state.equipos = Array.isArray(equipos)
    ? equipos.map((equipo) => ({
      ...equipo,
      id: getEquipoId(equipo),
    }))
    : []
  state.tecnicos = Array.isArray(tecnicos) ? tecnicos : []
  state.solicitudes = Array.isArray(solicitudes) ? solicitudes : []

  renderEquipos()
  renderTecnicosSelects()
  renderEquiposForRevision()
  renderSolicitudes()
  renderAgendas()
  state.equipoObjetivoId = readEquipoTargetFromUrl()
  openEquiposFromUrlIfNeeded()
  openAgendasFromUrlIfNeeded()
  openCalificacionesFromUrlIfNeeded()
}

async function loginCliente(credencial) {
  const response = await fetch(`${API_BASE}/api/cliente/auth/ingresar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cedula: credencial }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => null)
    throw new Error(error?.detail || response.statusText || 'No se pudo iniciar sesión')
  }

  return response.json()
}

clienteLoginForm?.addEventListener('submit', async (event) => {
  event.preventDefault()
  const credencial = clienteCedulaInput?.value.trim()
  if (!credencial || credencial.length < 5) {
    setMessage(clienteLoginMessage, 'Ingresa una cédula o teléfono válido.', true)
    return
  }

  setMessage(clienteLoginMessage, 'Ingresando...')
  try {
    const data = await loginCliente(credencial)
    setAuth(data.access_token, data.cliente)
    await loadDashboardData()
    void ensureForegroundFcmListener()
    void tryRegisterClienteFcm({ interactive: true })
    setMessage(clienteLoginMessage, '')
  } catch (error) {
    setMessage(clienteLoginMessage, error.message || 'No se pudo ingresar.', true)
  }
})

logoutBtn?.addEventListener('click', () => {
  clearAuth()
  setMessage(clienteLoginMessage, 'Sesión cerrada correctamente.')
})

menuToggle?.addEventListener('click', (event) => {
  event.stopPropagation()
  toggleMenu()
})

menuBackdrop?.addEventListener('click', closeMenu)

document.addEventListener('click', (event) => {
  const target = event.target
  if (!menuContainer || !(target instanceof Node)) return
  if (menuContainer.contains(target)) return
  closeMenu()
})

menuItems.forEach((item) => {
  item.addEventListener('click', () => {
    const targetId = item.getAttribute('data-target')
    if (!targetId) return
    const section = document.getElementById(targetId)
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    closeMenu()
  })
})

accordionToggleButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const panelId = button.getAttribute('data-accordion-toggle')
    if (!panelId) return
    const panel = document.getElementById(panelId)
    if (!panel) return

    const expanded = button.classList.toggle('expanded')
    button.setAttribute('aria-expanded', expanded.toString())
    panel.classList.toggle('hidden', !expanded)
  })
})

calificarForm?.addEventListener('submit', async (event) => {
  event.preventDefault()

  const payload = {
    id_tecnico: calificarTecnico?.value,
    puntaje: Number(calificarPuntaje?.value || 0),
    comentario: calificarComentario?.value.trim() || null,
  }

  if (!payload.id_tecnico || !payload.puntaje) {
    setMessage(calificarMsg, 'Selecciona tecnico y puntaje.', true)
    return
  }

  setMessage(calificarMsg, 'Enviando...')
  try {
    await apiFetch('/api/cliente/calificaciones/', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    setMessage(calificarMsg, 'Calificacion registrada correctamente.')
    calificarPuntaje.value = ''
    calificarComentario.value = ''
    state.tecnicos = await apiFetch('/api/cliente/tecnicos/recomendados')
    renderTecnicosSelects()
  } catch (error) {
    setMessage(calificarMsg, error.message || 'No se pudo enviar calificacion.', true)
  }
})

solicitudInstalacionForm?.addEventListener('submit', async (event) => {
  event.preventDefault()

  const payload = {
    tipo: 'instalacion',
    id_tecnico: instalacionTecnico?.value,
    prioridad: 'normal',
    nota: instalacionDescripcion?.value.trim() || null,
    descripcion: instalacionDescripcion?.value.trim() || null,
  }

  if (!payload.id_tecnico) {
    setMessage(instalacionMsg, 'Selecciona un tecnico.', true)
    return
  }

  setMessage(instalacionMsg, 'Enviando solicitud...')
  try {
    await apiFetch('/api/cliente/solicitudes/', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    setMessage(instalacionMsg, 'Solicitud de instalacion enviada.')
    instalacionDescripcion.value = ''
    state.solicitudes = await apiFetch('/api/cliente/solicitudes/')
    renderSolicitudes()
    renderEquipos()
  } catch (error) {
    setMessage(instalacionMsg, error.message || 'No se pudo crear la solicitud.', true)
  }
})

solicitudRevisionForm?.addEventListener('submit', async (event) => {
  event.preventDefault()

  const payload = {
    tipo: 'revision',
    id_tecnico: revisionTecnico?.value,
    id_equipo: revisionEquipo?.value,
    prioridad: revisionPrioridad?.value || 'normal',
    nota: revisionDescripcion?.value.trim() || null,
    descripcion: revisionDescripcion?.value.trim() || null,
  }

  if (!payload.id_tecnico || !payload.id_equipo) {
    setMessage(revisionMsg, 'Selecciona tecnico y equipo.', true)
    return
  }

  setMessage(revisionMsg, 'Enviando solicitud...')
  try {
    await apiFetch('/api/cliente/solicitudes/', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    setMessage(revisionMsg, 'Solicitud de revision enviada.')
    revisionDescripcion.value = ''
    state.solicitudes = await apiFetch('/api/cliente/solicitudes/')
    renderSolicitudes()
    renderEquipos()
  } catch (error) {
    setMessage(revisionMsg, error.message || 'No se pudo crear la solicitud.', true)
  }
})

equiposFilter?.addEventListener('change', renderEquipos)
solicitudesEstadoFilter?.addEventListener('change', renderSolicitudes)
solicitudesPrioridadFilter?.addEventListener('change', renderSolicitudes)
agendasSmartFilter?.addEventListener('change', renderAgendas)
agendasEstadoFilter?.addEventListener('change', renderAgendas)

async function bootstrap() {
  if (!state.token || !state.cliente) {
    clearAuth()
    return
  }

  setAuth(state.token, state.cliente)
  try {
    await loadDashboardData()
    void ensureForegroundFcmListener()
    void tryRegisterClienteFcm({ interactive: false })
  } catch (error) {
    clearAuth()
    setMessage(clienteLoginMessage, 'Sesion expirada, inicia nuevamente.', true)
  }
}

bootstrap()

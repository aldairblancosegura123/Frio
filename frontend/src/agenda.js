import './index.css'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
const storageKey = 'friotech_tecnico_token'

const agendaForm = document.querySelector('#agendaForm')
const agendaFecha = document.querySelector('#agendaFecha')
const agendaHora = document.querySelector('#agendaHora')
const agendaMsg = document.querySelector('#agendaMsg')
const solicitudResumen = document.querySelector('#solicitudResumen')
const solicitudesPendientesList = document.querySelector('#solicitudesPendientesList')
const solicitudesPendientesHeader = document.querySelector('#solicitudesPendientesHeader')
const solicitudesPendientesPanel = document.querySelector('#solicitudesPendientesPanel')
const volverPanelBtn = document.querySelector('#volverPanelBtn')
const calendarioAgendaHeader = document.querySelector('#calendarioAgendaHeader')
const calendarioAgendaPanel = document.querySelector('#calendarioAgendaPanel')
const agendaMonthPrev = document.querySelector('#agendaMonthPrev')
const agendaMonthNext = document.querySelector('#agendaMonthNext')
const agendaCalendarMonthLabel = document.querySelector('#agendaCalendarMonthLabel')
const agendaCalendarGrid = document.querySelector('#agendaCalendarGrid')
const agendaDayDetail = document.querySelector('#agendaDayDetail')

const state = {
  token: localStorage.getItem(storageKey) || null,
  solicitudes: [],
  solicitudActiva: null,
  calendarMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  selectedCalendarDate: null,
}

function getSolicitudesPendientesNoAgendadas() {
  return state.solicitudes.filter((solicitud) => solicitud.estado === 'pendiente' && !solicitud.fecha_agendada)
}

function setMessage(text, isError = false) {
  if (!agendaMsg) return
  agendaMsg.textContent = text
  agendaMsg.style.color = isError ? 'var(--danger)' : 'var(--text-dim)'
}

function toIdString(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') {
    if (typeof value.toString === 'function') return value.toString()
    return ''
  }
  return String(value)
}

function formatSolicitudTipo(tipo) {
  if (tipo === 'instalacion') return 'Instalación'
  if (tipo === 'revision') return 'Revisión'
  return tipo || 'Solicitud'
}

function formatSolicitudFecha(fecha) {
  if (!fecha) return '-'
  const value = new Date(fecha)
  return Number.isNaN(value.getTime()) ? '-' : value.toLocaleString()
}

function getSolicitudById(solicitudId) {
  const normalizedId = toIdString(solicitudId)
  if (!normalizedId) return null
  return state.solicitudes.find((s) => toIdString(s._id || s.id) === normalizedId) || null
}

function toDateKey(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getAgendasByDate() {
  const map = new Map()
  state.solicitudes.forEach((solicitud) => {
    if (!solicitud?.fecha_agendada) return
    const key = toDateKey(solicitud.fecha_agendada)
    if (!key) return
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(solicitud)
  })
  return map
}

function formatMonthLabel(date) {
  return new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(date)
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

function renderAgendaDayDetail() {
  if (!agendaDayDetail) return

  const selectedKey = state.selectedCalendarDate
  if (!selectedKey) {
    agendaDayDetail.innerHTML = 'Selecciona un día del calendario para ver las agendas.'
    return
  }

  const agendasByDate = getAgendasByDate()
  const agendas = agendasByDate.get(selectedKey) || []
  const selectedDate = new Date(`${selectedKey}T12:00:00`)
  const label = Number.isNaN(selectedDate.getTime())
    ? selectedKey
    : formatBogotaLongDate(selectedDate)

  if (!agendas.length) {
    agendaDayDetail.innerHTML = `<strong class="text-[var(--text)]">${label}</strong><div class="mt-2">Sin agendas para este día.</div>`
    return
  }

  const rows = agendas
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

  agendaDayDetail.innerHTML = `
    <strong class="text-[var(--text)]">${label}</strong>
    <div class="mt-3 grid gap-2">${rows}</div>
  `
}

function renderAgendaCalendar() {
  if (!agendaCalendarGrid || !agendaCalendarMonthLabel) return

  const monthBase = new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth(), 1)
  agendaCalendarMonthLabel.textContent = formatMonthLabel(monthBase)

  const agendasByDate = getAgendasByDate()
  const firstWeekday = monthBase.getDay()
  const daysInMonth = new Date(monthBase.getFullYear(), monthBase.getMonth() + 1, 0).getDate()
  const todayKey = toDateKey(new Date())

  agendaCalendarGrid.innerHTML = ''

  for (let i = 0; i < firstWeekday; i += 1) {
    const pad = document.createElement('div')
    pad.className = 'agenda-day-pad'
    agendaCalendarGrid.appendChild(pad)
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(monthBase.getFullYear(), monthBase.getMonth(), day)
    const key = toDateKey(date)
    const agendas = agendasByDate.get(key) || []

    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'agenda-day-btn'
    if (key === todayKey) btn.classList.add('is-today')
    if (agendas.length) btn.classList.add('has-agendas')
    if (state.selectedCalendarDate === key) btn.classList.add('is-selected')

    btn.innerHTML = `
      <span class="agenda-day-number">${day}</span>
      <span class="agenda-day-count">${agendas.length ? `${agendas.length} agenda${agendas.length > 1 ? 's' : ''}` : ''}</span>
    `

    btn.addEventListener('click', () => {
      state.selectedCalendarDate = key
      renderAgendaCalendar()
      renderAgendaDayDetail()
    })

    agendaCalendarGrid.appendChild(btn)
  }

  if (!state.selectedCalendarDate) {
    const monthWithAgenda = [...agendasByDate.keys()].find((key) => {
      const d = new Date(`${key}T00:00:00`)
      return d.getFullYear() === monthBase.getFullYear() && d.getMonth() === monthBase.getMonth()
    })
    if (monthWithAgenda) {
      state.selectedCalendarDate = monthWithAgenda
      renderAgendaCalendar()
      return
    }
  }
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

  if (!response.ok) {
    const error = await response.json().catch(() => null)
    throw new Error(error?.detail || response.statusText || 'Error de red')
  }

  return response.json().catch(() => null)
}

function renderSolicitudActiva() {
  if (!solicitudResumen) return

  if (!state.solicitudActiva) {
    solicitudResumen.innerHTML = '<p class="text-[var(--danger)]">No hay solicitud seleccionada.</p>'
    return
  }

  const solicitud = state.solicitudActiva
  solicitudResumen.innerHTML = `
    <div><span class="text-[var(--text)]">Solicitud:</span> <strong>${formatSolicitudTipo(solicitud.tipo)}</strong></div>
    <div><span class="text-[var(--text)]">Descripción:</span> ${solicitud.descripcion || 'Sin descripción'}</div>
    <div><span class="text-[var(--text)]">Creada:</span> ${formatSolicitudFecha(solicitud.creado_en)}</div>
    <div><span class="text-[var(--text)]">Agenda actual:</span> ${formatSolicitudFecha(solicitud.fecha_agendada)}</div>
  `
}

function setSolicitudActivaById(solicitudId) {
  const normalizedId = toIdString(solicitudId)
  const solicitud = getSolicitudById(normalizedId)
  if (!solicitud || solicitud.estado === 'rechazada' || solicitud.estado === 'completada') {
    state.solicitudActiva = null
  } else {
    state.solicitudActiva = solicitud
  }
  renderSolicitudActiva()
}

function renderSolicitudesPendientes() {
  if (!solicitudesPendientesList) return

  const candidatas = getSolicitudesPendientesNoAgendadas()
  solicitudesPendientesList.innerHTML = ''

  if (!candidatas.length) {
    solicitudesPendientesList.innerHTML = '<div class="text-[var(--text-dim)]">No hay solicitudes pendientes para agendar.</div>'
    return
  }

  candidatas.forEach((solicitud) => {
    const solicitudId = toIdString(solicitud._id || solicitud.id)
    const card = document.createElement('article')
    card.className = 'surface rounded-2xl p-4 border border-white/10 flex flex-wrap items-center justify-between gap-3'
    card.innerHTML = `
      <div>
        <p class="text-sm text-[var(--text-dim)]">${formatSolicitudTipo(solicitud.tipo)}</p>
        <p class="text-sm text-[var(--text-dim)]">${solicitud.descripcion || 'Sin descripción'}</p>
      </div>
      <button type="button" class="btn-secondary" data-action="seleccionar">Seleccionar</button>
    `

    card.querySelector('[data-action="seleccionar"]')?.addEventListener('click', () => {
      setSolicitudActivaById(solicitudId)
      const url = new URL(window.location.href)
      url.searchParams.set('solicitud', solicitudId)
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
      setMessage('Solicitud seleccionada. Ahora elige día y hora.')
    })

    solicitudesPendientesList.appendChild(card)
  })
}

function getQuerySolicitudId() {
  try {
    const params = new URLSearchParams(window.location.search)
    return params.get('solicitud') || ''
  } catch (_) {
    return ''
  }
}

async function loadSolicitudes() {
  state.solicitudes = await apiFetch('/api/tecnico/solicitudes/')
  const pendientes = getSolicitudesPendientesNoAgendadas()

  const solicitudId = getQuerySolicitudId()
  if (solicitudId) {
    setSolicitudActivaById(solicitudId)
  }

  if (!state.solicitudActiva) {
    const primeraPendiente = pendientes[0] || null
    if (primeraPendiente) {
      setSolicitudActivaById(toIdString(primeraPendiente._id || primeraPendiente.id))
    }
  }

  const agendas = state.solicitudes.filter((solicitud) => solicitud?.fecha_agendada)
  const primeraAgenda = agendas
    .sort((a, b) => new Date(a.fecha_agendada).getTime() - new Date(b.fecha_agendada).getTime())[0]
  if (primeraAgenda) {
    const date = new Date(primeraAgenda.fecha_agendada)
    if (!Number.isNaN(date.getTime())) {
      state.calendarMonth = new Date(date.getFullYear(), date.getMonth(), 1)
      state.selectedCalendarDate = toDateKey(date)
    }
  }

  renderSolicitudesPendientes()
  renderAgendaCalendar()
  renderAgendaDayDetail()
}

agendaForm?.addEventListener('submit', async (event) => {
  event.preventDefault()

  if (!state.solicitudActiva) {
    setMessage('Selecciona una solicitud antes de agendar.', true)
    return
  }

  const fecha = agendaFecha?.value
  const hora = agendaHora?.value
  if (!fecha || !hora) {
    setMessage('Debes seleccionar día y hora.', true)
    return
  }

  const fechaLocal = new Date(`${fecha}T${hora}:00`)
  if (Number.isNaN(fechaLocal.getTime())) {
    setMessage('Fecha u hora inválida.', true)
    return
  }

  const solicitudId = toIdString(state.solicitudActiva._id || state.solicitudActiva.id)
  const eraPendienteSinAgenda = state.solicitudActiva.estado === 'pendiente' && !state.solicitudActiva.fecha_agendada
  setMessage('Guardando agenda...')

  try {
    const updated = await apiFetch(`/api/tecnico/solicitudes/${solicitudId}/agendar`, {
      method: 'PATCH',
      body: JSON.stringify({
        fecha_agendada: fechaLocal.toISOString(),
      }),
    })

    state.solicitudActiva = updated
    state.solicitudes = state.solicitudes.map((item) => {
      const id = toIdString(item._id || item.id)
      return id === solicitudId ? updated : item
    })

    if (eraPendienteSinAgenda) {
      const pendientes = getSolicitudesPendientesNoAgendadas()
      state.solicitudActiva = pendientes[0] || null
    } else {
      state.solicitudActiva = updated
    }

    if (updated?.fecha_agendada) {
      const agendaDate = new Date(updated.fecha_agendada)
      if (!Number.isNaN(agendaDate.getTime())) {
        state.calendarMonth = new Date(agendaDate.getFullYear(), agendaDate.getMonth(), 1)
        state.selectedCalendarDate = toDateKey(agendaDate)
      }
    }

    renderSolicitudActiva()
    renderSolicitudesPendientes()
    renderAgendaCalendar()
    renderAgendaDayDetail()
    setMessage('Solicitud aceptada y agendada correctamente.')

    const url = new URL(window.location.href)
    if (state.solicitudActiva) {
      const nextId = toIdString(state.solicitudActiva._id || state.solicitudActiva.id)
      url.searchParams.set('solicitud', nextId)
    } else {
      url.searchParams.delete('solicitud')
    }
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
  } catch (error) {
    setMessage(error.message || 'No se pudo guardar la agenda.', true)
  }
})

volverPanelBtn?.addEventListener('click', () => {
  const solicitudId = state.solicitudActiva ? toIdString(state.solicitudActiva._id || state.solicitudActiva.id) : ''
  const query = solicitudId ? `?solicitud=${encodeURIComponent(solicitudId)}` : ''
  window.location.href = `/index.html${query}#notificaciones`
})

calendarioAgendaHeader?.addEventListener('click', () => {
  const expanded = calendarioAgendaHeader.classList.toggle('expanded')
  calendarioAgendaHeader.setAttribute('aria-expanded', expanded.toString())
  calendarioAgendaPanel?.classList.toggle('hidden', !expanded)
})

solicitudesPendientesHeader?.addEventListener('click', () => {
  const expanded = solicitudesPendientesHeader.classList.toggle('expanded')
  solicitudesPendientesHeader.setAttribute('aria-expanded', expanded.toString())
  solicitudesPendientesPanel?.classList.toggle('hidden', !expanded)
})

agendaMonthPrev?.addEventListener('click', () => {
  state.calendarMonth = new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth() - 1, 1)
  renderAgendaCalendar()
  renderAgendaDayDetail()
})

agendaMonthNext?.addEventListener('click', () => {
  state.calendarMonth = new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth() + 1, 1)
  renderAgendaCalendar()
  renderAgendaDayDetail()
})

async function bootstrap() {
  if (!state.token) {
    window.location.href = '/index.html'
    return
  }

  setMessage('Cargando solicitudes...')
  try {
    await loadSolicitudes()
    setMessage('Selecciona día y hora para confirmar la agenda.')
  } catch (error) {
    setMessage(error.message || 'No se pudieron cargar las solicitudes.', true)
  }
}

bootstrap()

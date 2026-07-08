const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

const MARCAS = [
  'Mabe', 'LG', 'Samsung', 'Daikin', 'Carrier', 'York', 'Trane',
  'Lennox', 'Panasonic', 'Mitsubishi Electric', 'Hisense', 'Gree','Olimpo',
  'TCL', 'Whirlpool', 'Electrolux', 'ComfortStar', 'Mirage',
  'Frigidaire', 'Haier', 'Sharp'
]

const BTUS_OPTIONS = [9000, 12000, 18000, 24000, 30000, 36000, 48000, 60000]

const equiposContainer = document.querySelector('#equiposContainer')
const clienteNombreEl = document.querySelector('#clienteNombre')
const clienteCedulaEl = document.querySelector('#clienteCedula')
const equiposEmpty = document.querySelector('#equiposEmpty')
const verTodosBtn = document.querySelector('#verTodos')
const volverBtn = document.querySelector('#volverBtn')
const registrarEquipoBtn = document.querySelector('#registrarEquipoBtn')
const equipoUpdateModal = document.querySelector('#equipoUpdateModal')
const equipoUpdateBackdrop = document.querySelector('#equipoUpdateBackdrop')
const equipoUpdateClose = document.querySelector('#equipoUpdateClose')
const equipoUpdateTitle = document.querySelector('#equipoUpdateTitle')
const equipoUpdateLastMaintenance = document.querySelector('#equipoUpdateLastMaintenance')
const equipoUpdateDate = document.querySelector('#equipoUpdateDate')
const equipoUpdateEstado = document.querySelector('#equipoUpdateEstado')
const equipoUpdateMantenimientoVencido = document.querySelector('#equipoUpdateMantenimientoVencido')
const equipoUpdateNotas = document.querySelector('#equipoUpdateNotas')
const equipoUpdateError = document.querySelector('#equipoUpdateError')
const equipoUpdateSuccess = document.querySelector('#equipoUpdateSuccess')
const equipoUpdateCancel = document.querySelector('#equipoUpdateCancel')
const equipoUpdateSave = document.querySelector('#equipoUpdateSave')
const registrarEquipoModal = document.querySelector('#registrarEquipoModal')
const registrarEquipoBackdrop = document.querySelector('#registrarEquipoBackdrop')
const registrarEquipoClose = document.querySelector('#registrarEquipoClose')
const registrarEquipoMarca = document.querySelector('#registrarEquipoMarca')
const registrarEquipoBtus = document.querySelector('#registrarEquipoBtus')
const registrarEquipoPresion = document.querySelector('#registrarEquipoPresion')
const registrarEquipoAmperaje = document.querySelector('#registrarEquipoAmperaje')
const registrarEquipoVoltaje = document.querySelector('#registrarEquipoVoltaje')
const registrarEquipoEstado = document.querySelector('#registrarEquipoEstado')
const registrarEquipoMantenimientoVencido = document.querySelector('#registrarEquipoMantenimientoVencido')
const registrarEquipoInstalacion = document.querySelector('#registrarEquipoInstalacion')
const registrarEquipoNotas = document.querySelector('#registrarEquipoNotas')
const registrarEquipoError = document.querySelector('#registrarEquipoError')
const registrarEquipoSuccess = document.querySelector('#registrarEquipoSuccess')
const registrarEquipoCancel = document.querySelector('#registrarEquipoCancel')
const registrarEquipoSave = document.querySelector('#registrarEquipoSave')

let currentClienteId = null
let currentEditingEquipoId = null
let targetEquipoId = null

function getToken() {
  return localStorage.getItem('friotech_tecnico_token') || null
}

async function apiFetch(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  if (!token) console.warn('apiFetch: no token found in localStorage (friotech_tecnico_token)')
  console.log('apiFetch ->', path, { headers, options })
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })

  if (!res.ok) {
    // Try to get a helpful body for debugging
    let bodyText = null
    try {
      bodyText = await res.text()
    } catch (e) {
      bodyText = '<unable to read body>'
    }
    console.error('apiFetch error', res.status, res.statusText, bodyText)
    const err = (() => {
      try {
        return JSON.parse(bodyText)
      } catch (e) {
        return null
      }
    })()
    throw new Error(err?.detail || res.statusText || `HTTP ${res.status}`)
  }

  const json = await res.json().catch(() => null)
  console.log('apiFetch response', path, json)
  return json
}

function getTodayISO() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today.toISOString().split('T')[0]
}

function parseDateOnly(value) {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function formatDateOnly(value) {
  if (!value) return '-'
  const dateString = typeof value === 'string' ? value.split('T')[0] : value
  const dateObj = typeof dateString === 'string' ? parseDateOnly(dateString) : value
  if (!dateObj) return '-'
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(dateObj)
}

function isDateBeforeToday(value) {
  if (!value) return false
  const date = parseDateOnly(String(value).split('T')[0])
  if (!date) return false
  const today = new Date(getTodayISO())
  return date < today
}

function syncEstadoDisabledByVencido(checkboxEl, selectEl) {
  if (!checkboxEl || !selectEl) return

  if (checkboxEl.checked) {
    checkboxEl.dataset.previousEstado = selectEl.value || 'operativo'
    selectEl.value = 'en_revision'
    selectEl.disabled = true
    selectEl.classList.add('opacity-60', 'cursor-not-allowed')
    return
  }

  selectEl.disabled = false
  selectEl.classList.remove('opacity-60', 'cursor-not-allowed')
  if (checkboxEl.dataset.previousEstado) {
    selectEl.value = checkboxEl.dataset.previousEstado
  }
}

function showEquipoUpdateError(message) {
  if (!equipoUpdateError) return
  equipoUpdateError.textContent = message
  equipoUpdateError.classList.remove('hidden')
}

function clearEquipoUpdateError() {
  if (!equipoUpdateError) return
  equipoUpdateError.textContent = ''
  equipoUpdateError.classList.add('hidden')
}

function clearEquipoUpdateSuccess() {
  if (!equipoUpdateSuccess) return
  equipoUpdateSuccess.textContent = ''
  equipoUpdateSuccess.classList.add('hidden')
}

function showRegistrarEquipoError(message) {
  if (!registrarEquipoError) return
  registrarEquipoError.textContent = message
  registrarEquipoError.classList.remove('hidden')
}

function clearRegistrarEquipoError() {
  if (!registrarEquipoError) return
  registrarEquipoError.textContent = ''
  registrarEquipoError.classList.add('hidden')
}

function clearRegistrarEquipoSuccess() {
  if (!registrarEquipoSuccess) return
  registrarEquipoSuccess.textContent = ''
  registrarEquipoSuccess.classList.add('hidden')
}

function populateRegistrarEquipoDropdowns() {
  if (registrarEquipoMarca) {
    registrarEquipoMarca.innerHTML = MARCAS.map(
      (marca) => `<option value="${marca}">${marca}</option>`
    ).join('')
  }

  if (registrarEquipoBtus) {
    registrarEquipoBtus.innerHTML = BTUS_OPTIONS.map(
      (btus) => `<option value="${btus}">${btus}</option>`
    ).join('')
  }
}

function openRegistrarEquipoModal() {
  populateRegistrarEquipoDropdowns()
  if (!registrarEquipoModal) return

  const today = getTodayISO()
  registrarEquipoMarca.value = MARCAS[0]
  registrarEquipoBtus.value = String(BTUS_OPTIONS[0])
  registrarEquipoPresion.value = '0'
  registrarEquipoAmperaje.value = '0'
  registrarEquipoVoltaje.value = '220'
  registrarEquipoEstado.value = 'operativo'
  if (registrarEquipoMantenimientoVencido) {
    registrarEquipoMantenimientoVencido.checked = false
    syncEstadoDisabledByVencido(registrarEquipoMantenimientoVencido, registrarEquipoEstado)
  }
  registrarEquipoInstalacion.value = today
  registrarEquipoInstalacion.min = today
  registrarEquipoNotas.value = ''
  clearRegistrarEquipoError()
  clearRegistrarEquipoSuccess()

  registrarEquipoModal.classList.remove('hidden')
  registrarEquipoModal.classList.add('flex')
}

function closeRegistrarEquipoModal() {
  if (!registrarEquipoModal) return
  registrarEquipoModal.classList.add('hidden')
  registrarEquipoModal.classList.remove('flex')
  clearRegistrarEquipoError()
}

function openEquipoUpdateModal(equipo) {
  if (!equipoUpdateModal || !equipoUpdateDate || !equipoUpdateEstado || !equipoUpdateNotas) return

  currentEditingEquipoId = equipo.id || equipo._id || null
  equipoUpdateTitle.textContent = `Actualizar ${equipo.marca || 'equipo'}`
  equipoUpdateLastMaintenance.textContent = equipo.fecha_mantenimiento
    ? formatDateOnly(equipo.fecha_mantenimiento)
    : 'Sin mantenimiento registrado'

  const today = getTodayISO()
  equipoUpdateDate.value = today
  equipoUpdateDate.min = today
  equipoUpdateEstado.value = equipo.estado || 'operativo'
  if (equipoUpdateMantenimientoVencido) {
    equipoUpdateMantenimientoVencido.checked = isDateBeforeToday(equipo.fecha_proximo_mantenimiento)
    syncEstadoDisabledByVencido(equipoUpdateMantenimientoVencido, equipoUpdateEstado)
  }
  equipoUpdateNotas.value = equipo.notas || ''
  clearEquipoUpdateError()
  clearEquipoUpdateSuccess()
  equipoUpdateModal.classList.remove('hidden')
  equipoUpdateModal.classList.add('flex')
}

function closeEquipoUpdateModal() {
  if (!equipoUpdateModal) return
  currentEditingEquipoId = null
  equipoUpdateModal.classList.add('hidden')
  equipoUpdateModal.classList.remove('flex')
  clearEquipoUpdateError()
}

async function saveEquipoUpdate() {
  if (!currentEditingEquipoId || !equipoUpdateDate || !equipoUpdateEstado) return

  const fechaMantenimiento = equipoUpdateDate.value
  const estado = equipoUpdateMantenimientoVencido?.checked
    ? 'en_revision'
    : (equipoUpdateEstado.value || 'operativo')
  const notas = equipoUpdateNotas?.value.trim() || ''
  const today = new Date(getTodayISO())
  const selectedDate = parseDateOnly(fechaMantenimiento)

  if (!fechaMantenimiento || !selectedDate) {
    showEquipoUpdateError('Indica la fecha de mantenimiento.')
    return
  }

  if (!selectedDate || selectedDate < today) {
    showEquipoUpdateError('La fecha de mantenimiento no puede ser anterior a hoy.')
    return
  }

  try {
    await apiFetch(`/api/tecnico/equipos/${currentEditingEquipoId}`, {
      method: 'PATCH',
      body: JSON.stringify({ fecha_mantenimiento: fechaMantenimiento, estado, notas }),
    })
    if (equipoUpdateSuccess) {
      equipoUpdateSuccess.textContent = 'Guardado correctamente.'
      equipoUpdateSuccess.classList.remove('hidden')
    }
    clearEquipoUpdateError()
    setTimeout(async () => {
      closeEquipoUpdateModal()
      if (currentClienteId) {
        await loadEquiposForCliente(currentClienteId)
      } else {
        await loadAllEquipos()
      }
    }, 800)
  } catch (error) {
    showEquipoUpdateError(error.message || 'No se pudo guardar el mantenimiento.')
  }
}

async function saveRegistrarEquipo() {
  if (!currentClienteId) {
    showRegistrarEquipoError('Cliente no encontrado.')
    return
  }

  const marca = registrarEquipoMarca?.value.trim() || ''
  const btus = Number(registrarEquipoBtus?.value || 0)
  const presion = Number(registrarEquipoPresion?.value || 0)
  const amperaje = Number(registrarEquipoAmperaje?.value || 0)
  const voltaje = Number(registrarEquipoVoltaje?.value || 0)
  const estado = registrarEquipoMantenimientoVencido?.checked
    ? 'en_revision'
    : (registrarEquipoEstado?.value || 'operativo')
  const fechaInstalacion = registrarEquipoInstalacion?.value
  const notas = registrarEquipoNotas?.value.trim() || ''

  const today = new Date(getTodayISO())
  const instalacionDate = parseDateOnly(fechaInstalacion)

  if (!marca) {
    showRegistrarEquipoError('La marca es obligatoria.')
    return
  }
  if (!fechaInstalacion || !instalacionDate) {
    showRegistrarEquipoError('Indica la fecha de instalación.')
    return
  }
  if (instalacionDate < today) {
    showRegistrarEquipoError('La fecha de instalación no puede ser anterior a hoy.')
    return
  }

  const payload = {
    id_cliente: currentClienteId,
    marca,
    btus,
    presion,
    amperaje,
    voltaje,
    estado,
    fecha_instalacion: fechaInstalacion,
    notas,
  }

  try {
    await apiFetch('/api/tecnico/equipos/', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (registrarEquipoSuccess) {
      registrarEquipoSuccess.textContent = 'Equipo registrado correctamente.'
      registrarEquipoSuccess.classList.remove('hidden')
    }
    clearRegistrarEquipoError()
    setTimeout(async () => {
      closeRegistrarEquipoModal()
      await loadEquiposForCliente(currentClienteId)
    }, 800)
  } catch (error) {
    showRegistrarEquipoError(error.message || 'No se pudo registrar el equipo.')
  }
}

function getEstadoBadge(equipo) {
  const estado = equipo.estado || ''

  if (estado === 'en_revision') {
    return { css: 'badge-warning blink', label: 'Revisión' }
  }

  if (estado === 'requiere_mantenimiento') {
    return { css: 'badge-warning', label: 'Requiere mantenimiento' }
  }

  if (estado === 'fuera_de_servicio') {
    return { css: 'badge-danger', label: 'Averiado' }
  }

  const today = new Date()
  const proximo = equipo.fecha_proximo_mantenimiento
    ? parseDateOnly(String(equipo.fecha_proximo_mantenimiento).split('T')[0])
    : null

  if (proximo && proximo > today) {
    return { css: 'badge-primary', label: 'Operativo' }
  }

  return { css: 'badge-warning blink', label: 'Revisión' }
}

function buildEquipoCard(equipo) {
  console.log('buildEquipoCard:', equipo)
  const { css: estadoClass, label: estadoLabel } = getEstadoBadge(equipo)
  const card = document.createElement('article')
  const equipoId = String(equipo.id || equipo._id || '')
  if (equipoId) card.dataset.equipoId = equipoId
  card.className = 'accordion-item surface-raised'
  card.innerHTML = `
    <button type="button" class="accordion-header" aria-expanded="false">
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="card-title">${equipo.marca || equipo.modelo || 'Equipo'}</p>
          <p class="text-sm text-[var(--text-dim)]">${equipo.btus ? equipo.btus + ' BTU' : (equipo.modelo || '')}</p>
        </div>
        <span class="badge ${estadoClass}">${estadoLabel}</span>
      </div>
      <span class="accordion-icon">+</span>
    </button>
    <div class="accordion-panel hidden">
      <div class="mt-3">
        <div class="text-sm text-[var(--text-dim)]">Fecha instalación</div>
        <div class="font-mono">${equipo.fecha_instalacion ? formatDateOnly(equipo.fecha_instalacion) : '-'}</div>

        <div class="text-sm text-[var(--text-dim)] mt-2">Último mantenimiento</div>
        <div class="font-mono">${equipo.fecha_mantenimiento ? formatDateOnly(equipo.fecha_mantenimiento) : '-'}</div>

        <div class="text-sm text-[var(--text-dim)] mt-2">Próximo mantenimiento</div>
        <div class="font-mono">${equipo.fecha_proximo_mantenimiento ? formatDateOnly(equipo.fecha_proximo_mantenimiento) : '-'}</div>
        ${equipo.notas?.trim() ? `<div class="text-sm text-[var(--text-dim)] mt-3">Notas</div><div class="font-mono">${String(equipo.notas)}</div>` : ''}
        <div class="mt-4 flex justify-center">
          <button type="button" class="btn-secondary btn-update-equipo">Actualizar</button>
        </div>
      </div>
    </div>
  `

  const header = card.querySelector('.accordion-header')
  const panel = card.querySelector('.accordion-panel')
  header?.addEventListener('click', () => {
    const expanded = header.classList.toggle('expanded')
    header.setAttribute('aria-expanded', expanded.toString())
    if (panel) panel.classList.toggle('hidden', !expanded)
  })

  const updateButton = card.querySelector('.btn-update-equipo')
  updateButton?.addEventListener('click', (event) => {
    event.stopPropagation()
    openEquipoUpdateModal(equipo)
  })

  return card
}

function focusTargetEquipoIfNeeded() {
  if (!targetEquipoId || !equiposContainer) return
  const card = equiposContainer.querySelector(`[data-equipo-id="${targetEquipoId}"]`)
  if (!(card instanceof HTMLElement)) return

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

  card.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

async function loadEquiposForCliente(clienteId) {
  try {
    equiposContainer.innerHTML = ''
    equiposEmpty.classList.add('hidden')
    const equipos = await apiFetch(`/api/tecnico/equipos/cliente/${clienteId}`)
    console.log('loadEquiposForCliente -> equipos:', clienteId, equipos)
    if (!equipos || !equipos.length) {
      equiposEmpty.textContent = 'No se encontraron equipos para este cliente.'
      equiposEmpty.classList.remove('hidden')
      return
    }
    equipos.forEach(e => {
      console.log('equipo item:', e)
      equiposContainer.appendChild(buildEquipoCard(e))
    })
    focusTargetEquipoIfNeeded()
  } catch (err) {
    console.error('loadEquiposForCliente error', err)
    equiposEmpty.textContent = `Error cargando equipos: ${err.message || err}`
    equiposEmpty.classList.remove('hidden')
  }
}

async function loadAllEquipos() {
  try {
    equiposContainer.innerHTML = ''
    equiposEmpty.classList.add('hidden')
    const equipos = await apiFetch('/api/tecnico/equipos/')
    console.log('loadAllEquipos -> equipos:', equipos)
    if (!equipos || !equipos.length) {
      equiposEmpty.textContent = 'No se encontraron equipos.'
      equiposEmpty.classList.remove('hidden')
      return
    }
    equipos.forEach(e => {
      console.log('equipo item:', e)
      equiposContainer.appendChild(buildEquipoCard(e))
    })
    focusTargetEquipoIfNeeded()
  } catch (err) {
    console.error('loadAllEquipos error', err)
    equiposEmpty.textContent = `Error cargando equipos: ${err.message || err}`
    equiposEmpty.classList.remove('hidden')
  }
}

function getQuery() {
  return new URLSearchParams(window.location.search)
}

function init() {
  const q = getQuery()
  const clienteId = q.get('cliente_id')
  const nombre = q.get('nombre')
  const cedula = q.get('cedula')
  targetEquipoId = q.get('equipo')

  if (nombre) clienteNombreEl.textContent = decodeURIComponent(nombre)
  if (cedula) clienteCedulaEl.textContent = `Cédula: ${decodeURIComponent(cedula)}`

  console.log('equipos page init', { clienteId, nombre, cedula, targetEquipoId, token: getToken() })

  if (clienteId) {
    currentClienteId = clienteId
    registrarEquipoBtn?.classList.remove('hidden')
    registrarEquipoBtn?.addEventListener('click', openRegistrarEquipoModal)
    loadEquiposForCliente(clienteId)
  } else {
    currentClienteId = null
    registrarEquipoBtn?.classList.add('hidden')
    loadAllEquipos()
  }

  verTodosBtn?.addEventListener('click', (e) => {
    e.preventDefault()
    loadAllEquipos()
  })

  volverBtn?.addEventListener('click', () => window.close())

  volverBtn?.addEventListener('click', () => {
    if (window.history.length > 1) {
      window.history.back()
    } else {
      window.location.href = '/index.html'
    }
  })

  equipoUpdateBackdrop?.addEventListener('click', closeEquipoUpdateModal)
  equipoUpdateClose?.addEventListener('click', closeEquipoUpdateModal)
  equipoUpdateCancel?.addEventListener('click', closeEquipoUpdateModal)
  equipoUpdateSave?.addEventListener('click', saveEquipoUpdate)
  registrarEquipoBackdrop?.addEventListener('click', closeRegistrarEquipoModal)
  registrarEquipoClose?.addEventListener('click', closeRegistrarEquipoModal)
  registrarEquipoCancel?.addEventListener('click', closeRegistrarEquipoModal)
  registrarEquipoSave?.addEventListener('click', saveRegistrarEquipo)
  equipoUpdateMantenimientoVencido?.addEventListener('change', () => {
    syncEstadoDisabledByVencido(equipoUpdateMantenimientoVencido, equipoUpdateEstado)
  })
  registrarEquipoMantenimientoVencido?.addEventListener('change', () => {
    syncEstadoDisabledByVencido(registrarEquipoMantenimientoVencido, registrarEquipoEstado)
  })
}

init()

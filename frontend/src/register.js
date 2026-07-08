const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

const registerForm = document.querySelector('#registerForm')
const registerMessage = document.querySelector('#registerMessage')
const regNombres = document.querySelector('#regNombres')
const regApellidos = document.querySelector('#regApellidos')
const regCedula = document.querySelector('#regCedula')
const regTelefono = document.querySelector('#regTelefono')
const regPassword = document.querySelector('#regPassword')
const regFotoPerfil = document.querySelector('#regFotoPerfil')

function setMessage(text, error = false) {
  if (!registerMessage) return
  registerMessage.textContent = text
  registerMessage.style.color = error ? '#FF5A5F' : 'var(--text-dim)'
}

async function registerTecnico(data) {
  const response = await fetch(`${API_BASE}/api/tecnico/auth/registro`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  const raw = await response.text().catch(() => '')
  let body = null
  if (raw) {
    try {
      body = JSON.parse(raw)
    } catch (_) {
      body = { _raw: raw }
    }
  }

  if (!response.ok) {
    throw new Error(body?.detail || response.statusText || 'Error al registrar técnico')
  }

  return body
}

registerForm?.addEventListener('submit', async (event) => {
  event.preventDefault()
  setMessage('Registrando técnico...')

  try {
    const payload = {
      nombres: regNombres.value.trim(),
      apellidos: regApellidos.value.trim(),
      cedula: regCedula.value.trim(),
      telefono: regTelefono.value.trim(),
      password: regPassword.value,
      foto_perfil_url: regFotoPerfil.value.trim() || undefined,
    }

    await registerTecnico(payload)
    setMessage('Registro exitoso. Volviendo al login en 1.5 segundos...', false)
    registerForm.reset()
    setTimeout(() => {
      window.location.href = './index.html'
    }, 1500)
  } catch (err) {
    setMessage(err.message || 'Error al registrar técnico.', true)
  }
})

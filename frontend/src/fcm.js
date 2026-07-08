import { initializeApp } from 'firebase/app'
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

let firebaseApp = null
let firebaseMessaging = null
let messagingSwRegistration = null
let foregroundMessageUnsubscribe = null

function buildMessagingSwUrl() {
  const params = new URLSearchParams({
    apiKey: firebaseConfig.apiKey || '',
    authDomain: firebaseConfig.authDomain || '',
    projectId: firebaseConfig.projectId || '',
    storageBucket: firebaseConfig.storageBucket || '',
    messagingSenderId: firebaseConfig.messagingSenderId || '',
    appId: firebaseConfig.appId || '',
  })

  return `/firebase-messaging-sw.js?${params.toString()}`
}

async function ensureMessagingServiceWorker() {
  if (messagingSwRegistration) return messagingSwRegistration
  if (!('serviceWorker' in navigator)) {
    throw new Error('Este navegador no soporta Service Worker.')
  }

  const swUrl = buildMessagingSwUrl()
  messagingSwRegistration = await navigator.serviceWorker.register(swUrl)
  await navigator.serviceWorker.ready
  if (!messagingSwRegistration.active) {
    await new Promise((resolve) => {
      const existing = messagingSwRegistration.installing || messagingSwRegistration.waiting
      if (!existing) {
        resolve()
        return
      }

      const handleStateChange = () => {
        if (existing.state === 'activated') {
          existing.removeEventListener('statechange', handleStateChange)
          resolve()
        }
      }

      existing.addEventListener('statechange', handleStateChange)
      handleStateChange()
    })
  }

  return messagingSwRegistration
}

function hasFirebaseConfig() {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.projectId &&
      firebaseConfig.messagingSenderId &&
      firebaseConfig.appId,
  )
}

async function ensureMessaging() {
  if (firebaseMessaging) return firebaseMessaging
  if (!hasFirebaseConfig()) {
    throw new Error('Faltan variables Firebase en .env (VITE_FIREBASE_*).')
  }

  const supported = await isSupported().catch(() => false)
  if (!supported) {
    throw new Error('FCM no está soportado en este navegador/dispositivo.')
  }

  if (!firebaseApp) {
    firebaseApp = initializeApp(firebaseConfig)
  }

  firebaseMessaging = getMessaging(firebaseApp)
  return firebaseMessaging
}

async function requestFcmToken() {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Permiso de notificaciones denegado.')
  }

  const messaging = await ensureMessaging()
  const serviceWorkerRegistration = await ensureMessagingServiceWorker()
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY

  if (!vapidKey) {
    throw new Error('Falta VITE_FIREBASE_VAPID_KEY en .env.')
  }

  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration })
  if (!token) {
    throw new Error('No se pudo obtener token FCM.')
  }

  return token
}

export async function registerFcmToken({
  apiBase,
  authToken,
  audience,
}) {
  if (!apiBase) throw new Error('apiBase es requerido para registrar token FCM.')
  if (!authToken) throw new Error('authToken es requerido para registrar token FCM.')
  if (!audience || !['cliente', 'tecnico'].includes(audience)) {
    throw new Error("audience debe ser 'cliente' o 'tecnico'.")
  }

  const token = await requestFcmToken()
  const response = await fetch(`${apiBase}/api/${audience}/fcm-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ fcm_token: token }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.detail || 'No se pudo registrar el token FCM en backend.')
  }

  return { token }
}

export async function subscribeForegroundFcmMessages(handler) {
  if (typeof handler !== 'function') {
    throw new Error('handler es requerido para escuchar mensajes FCM en primer plano.')
  }

  const messaging = await ensureMessaging()
  if (foregroundMessageUnsubscribe) {
    return foregroundMessageUnsubscribe
  }

  foregroundMessageUnsubscribe = onMessage(messaging, (payload) => {
    handler(payload)
  })

  return foregroundMessageUnsubscribe
}

export function canUseNotifications() {
  return typeof window !== 'undefined' && 'Notification' in window
}

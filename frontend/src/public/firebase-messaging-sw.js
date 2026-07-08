/* global firebase, importScripts, self, clients */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js')

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  event.respondWith(fetch(event.request))
})

function getFirebaseConfigFromQuery() {
  try {
    const url = new URL(self.location.href)
    return {
      apiKey: url.searchParams.get('apiKey') || '',
      authDomain: url.searchParams.get('authDomain') || '',
      projectId: url.searchParams.get('projectId') || '',
      storageBucket: url.searchParams.get('storageBucket') || '',
      messagingSenderId: url.searchParams.get('messagingSenderId') || '',
      appId: url.searchParams.get('appId') || '',
    }
  } catch (_) {
    return null
  }
}

function isValidConfig(config) {
  return Boolean(config && config.apiKey && config.projectId && config.messagingSenderId && config.appId)
}

const firebaseConfig = getFirebaseConfigFromQuery()

if (isValidConfig(firebaseConfig)) {
  firebase.initializeApp(firebaseConfig)
  const messaging = firebase.messaging()

  const buildNotificationTargetUrl = (data = {}) => {
    const rawUrl = data.url || '/index.html'

    try {
      const url = new URL(rawUrl, self.location.origin)
      const isClienteView = url.pathname.includes('cliente.html')
      if (data.id_solicitud && !isClienteView) {
        url.searchParams.set('solicitud', data.id_solicitud)
        url.hash = 'notificaciones'
      }
      if (data.id_equipo) {
        if (isClienteView) {
          url.searchParams.set('equipos', '1')
          url.searchParams.set('equipo', data.id_equipo)
          url.hash = 'equiposSection'
        } else if (url.pathname.includes('equipos.html')) {
          url.searchParams.set('equipo', data.id_equipo)
        }
      }
      return `${url.pathname}${url.search}${url.hash}`
    } catch (_) {
      if (!data.id_solicitud || rawUrl.includes('cliente.html')) return rawUrl
      const separator = rawUrl.includes('?') ? '&' : '?'
      return `${rawUrl}${separator}solicitud=${encodeURIComponent(data.id_solicitud)}#notificaciones`
    }
  }

  messaging.onBackgroundMessage((payload) => {
    const notification = payload?.notification || {}
    const data = payload?.data || {}
    const title = notification.title || 'FrioTech'
    const body = notification.body || 'Tienes una nueva notificación.'
    const url = buildNotificationTargetUrl(data)

    self.registration.showNotification(title, {
      body,
      icon: '/vite.svg',
      badge: '/vite.svg',
      data: {
        ...data,
        url,
      },
    })
  })
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification?.data?.url || '/index.html'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }
      return undefined
    }),
  )
})

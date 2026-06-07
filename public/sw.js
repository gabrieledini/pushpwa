// Service Worker della PoC Web Push
// Gestisce: installazione, ricezione evento "push", click sulla notifica.

self.addEventListener('install', (event) => {
  // Attiva subito la nuova versione senza attendere la chiusura delle tab
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Prende il controllo dei client esistenti immediatamente
  event.waitUntil(self.clients.claim());
});

// Evento ricevuto quando il push service consegna un messaggio.
// Il payload arriva cifrato e viene decifrato automaticamente dal browser.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    // payload non-JSON: lo usiamo come testo grezzo
    data = { title: 'Notifica', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Push PoC';
  const options = {
    body: data.body || 'Messaggio ricevuto.',
    icon: data.icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'push-poc',
    data: { url: data.url || '/' },
    requireInteraction: false,
    timestamp: Date.now()
  };

  // waitUntil tiene vivo il SW finché la notifica non è mostrata
  event.waitUntil(self.registration.showNotification(title, options));
});

// Click sulla notifica: apre/mette a fuoco la PWA
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});

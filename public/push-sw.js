// Avisos nativos (Web Push): se importa dentro del service worker que genera
// vite-plugin-pwa (workbox.importScripts en vite.config.js).
self.addEventListener('push', (event) => {
  let datos = {};
  try {
    datos = event.data ? event.data.json() : {};
  } catch {
    datos = { cuerpo: event.data ? event.data.text() : '' };
  }
  event.waitUntil(self.registration.showNotification(datos.titulo || 'Centro de Cultura Física', {
    body: datos.cuerpo || '',
    icon: '/logos/icono-192.png',
    badge: '/logos/icono-192.png',
    tag: datos.tag || 'ccf',
    renotify: true,
    data: { url: datos.url || '/' },
  }));
});

// Al tocar el aviso: enfoca la app si ya está abierta (y la lleva al destino)
// o la abre.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const ventana of ventanas) {
      if (new URL(ventana.url).origin === self.location.origin) {
        await ventana.focus();
        if ('navigate' in ventana) await ventana.navigate(url);
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});

// Clear only the deprecated generic cache; never other workers' caches.
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(names => Promise.allSettled(names.filter(name => /^esporte-360-v\d+$/.test(name)).map(name => caches.delete(name))))));

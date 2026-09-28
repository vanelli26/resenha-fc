// Entrada do service worker (DIRETRIZES 6.3). Requisições de outras origens (Firestore, Storage, login
// Google, fotos) vão direto para a rede: o service worker do Angular responderia a todas, e o tráfego
// contínuo do Firestore passando por ele deixa o app lento (principalmente no iPhone).
// Este listener precisa ser registrado antes do importScripts, para parar o evento antes do Angular.
self.addEventListener('fetch', (event) => {
  if (new URL(event.request.url).origin !== self.location.origin) {
    event.stopImmediatePropagation();
  }
});

importScripts('./ngsw-worker.js');

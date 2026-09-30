// Entrada do service worker (DIRETRIZES 6.3). Requisições de outras origens (Firestore, Storage, login
// Google, fotos) e as páginas de login do Firebase no próprio domínio (/__/auth/) vão direto para a rede:
// o service worker do Angular responderia a todas, e o tráfego contínuo do Firestore passando por ele
// deixa o app lento (principalmente no iPhone).
// Este listener precisa ser registrado antes do importScripts, para parar o evento antes do Angular.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // /__/ = páginas do login do Firebase servidas pelo Hosting no próprio domínio: sempre da rede.
  if (url.origin !== self.location.origin || url.pathname.startsWith('/__/')) {
    event.stopImmediatePropagation();
  }
});

importScripts('./ngsw-worker.js');

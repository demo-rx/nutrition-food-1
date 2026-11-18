if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

if (window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches) {
  document.documentElement.classList.add('is-pwa');
}

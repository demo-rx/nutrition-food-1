(function gateApp() {
  const page = (location.pathname.split('/').pop() || 'index.html') + location.search;
  if (!window.HNP) return;
  if (!HNP.isLoggedIn()) {
    location.replace('login.html?next=' + encodeURIComponent(page));
    return;
  }
  if (!HNP.isPremium()) {
    location.replace('subscribe.html?next=' + encodeURIComponent(page));
  }
})();

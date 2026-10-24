import './style.css';

// Der Service Worker wird von vite-plugin-pwa automatisch registriert
// (registerType: 'autoUpdate'). Hier nur eine kleine Statusanzeige.
const status = document.getElementById('status');

function render() {
  if (!status) return;
  const sw = 'serviceWorker' in navigator;
  status.textContent = navigator.onLine
    ? sw ? 'Online · installierbar als App' : 'Online'
    : 'Offline · läuft aus dem Cache';
  status.dataset.state = navigator.onLine ? 'online' : 'offline';
}

window.addEventListener('online', render);
window.addEventListener('offline', render);
render();

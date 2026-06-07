// Logica client della PoC Web Push.

const logEl = document.getElementById('log');
const btnEnable = document.getElementById('btn-enable');
const btnTest = document.getElementById('btn-test');
const btnDisable = document.getElementById('btn-disable');
const dot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');

let swRegistration = null;
let currentSubscription = null;

function log(msg, kind = 'info') {
  const ts = new Date().toLocaleTimeString('it-IT');
  const line = document.createElement('div');
  line.className = `line line--${kind}`;
  line.textContent = `[${ts}] ${msg}`;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

function setStatus(state, text) {
  dot.className = `dot dot--${state}`;
  statusText.textContent = text;
}

// Converte la chiave VAPID pubblica (base64url) in Uint8Array per applicationServerKey
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function init() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    setStatus('error', 'Browser non supportato');
    log('Questo browser non supporta Service Worker o Push API.', 'error');
    btnEnable.disabled = true;
    return;
  }

  try {
    swRegistration = await navigator.serviceWorker.register('/sw.js');
    log('Service worker registrato.', 'ok');
    await navigator.serviceWorker.ready;

    currentSubscription = await swRegistration.pushManager.getSubscription();
    if (currentSubscription) {
      setStatus('ok', 'Iscritto alle notifiche');
      btnEnable.disabled = true;
      btnTest.disabled = false;
      btnDisable.disabled = false;
      log('Sottoscrizione esistente trovata.', 'ok');
    } else {
      setStatus('idle', 'Non iscritto');
      log('Nessuna sottoscrizione attiva. Premi "Abilita notifiche".');
    }
  } catch (e) {
    setStatus('error', 'Errore registrazione SW');
    log('Errore: ' + e.message, 'error');
  }
}

async function enable() {
  btnEnable.disabled = true;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      log('Permesso negato dall\'utente.', 'error');
      setStatus('error', 'Permesso negato');
      btnEnable.disabled = false;
      return;
    }
    log('Permesso concesso.', 'ok');

    // Recupera la chiave pubblica VAPID dal backend
    const res = await fetch('/api/vapid');
    const { publicKey } = await res.json();
    if (!publicKey) throw new Error('VAPID public key non configurata sul server');
    log('Chiave VAPID pubblica ricevuta dal server.');

    currentSubscription = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });
    log('Sottoscrizione push creata dal browser.', 'ok');

    const save = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentSubscription)
    });
    if (!save.ok) throw new Error('Salvataggio sottoscrizione fallito (' + save.status + ')');
    log('Sottoscrizione salvata sul server (Netlify Blobs).', 'ok');

    setStatus('ok', 'Iscritto alle notifiche');
    btnTest.disabled = false;
    btnDisable.disabled = false;
  } catch (e) {
    log('Errore: ' + e.message, 'error');
    setStatus('error', 'Errore iscrizione');
    btnEnable.disabled = false;
  }
}

async function sendTest() {
  btnTest.disabled = true;
  try {
    log('Richiesta invio notifica di test al server...');
    const res = await fetch('/api/send-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: currentSubscription,
        payload: {
          title: 'PoC Web Push',
          body: 'Round trip completato: server -> push service -> SW ✔',
          url: '/'
        }
      })
    });
    const out = await res.json();
    if (!res.ok) throw new Error(out.error || ('HTTP ' + res.status));
    log('Server ha inviato il push (status ' + out.statusCode + '). Attendi la notifica.', 'ok');
  } catch (e) {
    log('Errore: ' + e.message, 'error');
  } finally {
    btnTest.disabled = false;
  }
}

async function disable() {
  btnDisable.disabled = true;
  try {
    if (currentSubscription) {
      await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: currentSubscription.endpoint })
      });
      await currentSubscription.unsubscribe();
      log('Sottoscrizione rimossa (client e server).', 'ok');
    }
    currentSubscription = null;
    setStatus('idle', 'Non iscritto');
    btnEnable.disabled = false;
    btnTest.disabled = true;
  } catch (e) {
    log('Errore: ' + e.message, 'error');
    btnDisable.disabled = false;
  }
}

btnEnable.addEventListener('click', enable);
btnTest.addEventListener('click', sendTest);
btnDisable.addEventListener('click', disable);

init();

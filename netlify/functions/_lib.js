// Helper condivisi tra le functions (store, invio push, broadcast, coda).
import { getStore } from '@netlify/blobs';
import { createHash } from 'node:crypto';
import webpush from 'web-push';

// Store delle sottoscrizioni (persistente a livello di sito).
export function subscriptionsStore() {
  return getStore({ name: 'push-subscriptions', consistency: 'strong' });
}

// Store della coda di messaggi da consegnare al prossimo giro del cron.
export function queueStore() {
  return getStore({ name: 'push-queue', consistency: 'strong' });
}

// Chiave deterministica derivata dall'endpoint (le chiavi Blobs non ammettono char arbitrari).
export function keyForEndpoint(endpoint) {
  return createHash('sha256').update(endpoint).digest('hex');
}

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export function hasVapid() {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let vapidReady = false;
function configureVapid() {
  if (vapidReady) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:test@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  vapidReady = true;
}

// Invio a una singola sottoscrizione (rilancia gli errori al chiamante).
export async function sendToSubscription(subscription, payload) {
  configureVapid();
  return webpush.sendNotification(subscription, JSON.stringify(payload));
}

// Broadcast a tutte le sottoscrizioni salvate; rimuove quelle scadute (404/410).
export async function broadcastToAll(payload) {
  configureVapid();
  const store = subscriptionsStore();
  const { blobs } = await store.list();
  const message = JSON.stringify({
    title: payload.title || 'Push PoC',
    body: payload.body || '',
    url: payload.url || '/'
  });

  let sent = 0, removed = 0, failed = 0;
  for (const { key } of blobs) {
    const sub = await store.get(key, { type: 'json' });
    if (!sub) continue;
    try {
      await webpush.sendNotification(sub, message);
      sent++;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await store.delete(key);
        removed++;
      } else {
        failed++;
      }
    }
  }
  return { sent, removed, failed, total: blobs.length };
}

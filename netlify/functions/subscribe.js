// POST /api/subscribe -> salva la PushSubscription su Netlify Blobs.
import { subscriptionsStore, keyForEndpoint, json } from './_lib.js';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let sub;
  try {
    sub = await req.json();
  } catch {
    return json({ error: 'Body JSON non valido' }, 400);
  }

  if (!sub || !sub.endpoint) {
    return json({ error: 'Sottoscrizione priva di endpoint' }, 400);
  }

  const store = subscriptionsStore();
  const key = keyForEndpoint(sub.endpoint);
  await store.setJSON(key, { ...sub, createdAt: new Date().toISOString() });

  return json({ ok: true, key });
};

export const config = { path: '/api/subscribe' };

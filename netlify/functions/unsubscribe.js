// POST /api/unsubscribe -> rimuove la sottoscrizione dallo store.
import { subscriptionsStore, keyForEndpoint, json } from './_lib.js';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Body JSON non valido' }, 400);
  }

  if (!body || !body.endpoint) return json({ error: 'endpoint mancante' }, 400);

  const store = subscriptionsStore();
  await store.delete(keyForEndpoint(body.endpoint));
  return json({ ok: true });
};

export const config = { path: '/api/unsubscribe' };

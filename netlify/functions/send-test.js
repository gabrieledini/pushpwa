// POST /api/send-test -> invia UN push alla sottoscrizione passata nel body.
// Verifica il round trip completo dal client durante la PoC.
import { sendToSubscription, hasVapid, json } from './_lib.js';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!hasVapid()) return json({ error: 'Chiavi VAPID non configurate sul server' }, 500);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Body JSON non valido' }, 400); }

  const { subscription, payload } = body || {};
  if (!subscription || !subscription.endpoint) return json({ error: 'subscription mancante' }, 400);

  try {
    const res = await sendToSubscription(subscription, payload || { title: 'PoC', body: 'Test' });
    return json({ ok: true, statusCode: res.statusCode });
  } catch (err) {
    return json({ error: err.body || err.message, statusCode: err.statusCode || 500 }, 502);
  }
};

export const config = { path: '/api/send-test' };

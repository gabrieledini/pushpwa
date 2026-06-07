// POST /api/enqueue -> accoda un messaggio che il cron invierà al prossimo giro.
// È l'endpoint che il tuo sistema di cattura allerte (es. da Telegram) chiamerebbe.
// Protetto da Authorization: Bearer <SEND_SECRET>.
//
// Esempio:
//   curl -X POST https://<sito>.netlify.app/api/enqueue \
//     -H "Authorization: Bearer $SEND_SECRET" \
//     -H "Content-Type: application/json" \
//     -d '{"title":"Allerta meteo ARANCIONE","body":"Versilia, 12:00-18:00","url":"/"}'
import { queueStore, json } from './_lib.js';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const secret = process.env.SEND_SECRET;
  if (!secret) return json({ error: 'SEND_SECRET non configurato' }, 500);
  if ((req.headers.get('authorization') || '') !== `Bearer ${secret}`) {
    return json({ error: 'Non autorizzato' }, 401);
  }

  let payload;
  try { payload = await req.json(); } catch { return json({ error: 'Body JSON non valido' }, 400); }

  const store = queueStore();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await store.setJSON(id, {
    title: payload.title || 'Push PoC',
    body: payload.body || '',
    url: payload.url || '/',
    queuedAt: new Date().toISOString()
  });

  return json({ ok: true, id });
};

export const config = { path: '/api/enqueue' };

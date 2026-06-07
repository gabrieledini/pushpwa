// POST /api/send -> BROADCAST immediato a TUTTE le sottoscrizioni salvate.
// Il "servizio server": lo chiami dal tuo backend per un invio sincrono.
// Protetto da Authorization: Bearer <SEND_SECRET>.
import { broadcastToAll, hasVapid, json } from './_lib.js';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const secret = process.env.SEND_SECRET;
  if (!secret) return json({ error: 'SEND_SECRET non configurato' }, 500);
  if ((req.headers.get('authorization') || '') !== `Bearer ${secret}`) {
    return json({ error: 'Non autorizzato' }, 401);
  }
  if (!hasVapid()) return json({ error: 'Chiavi VAPID non configurate' }, 500);

  let payload;
  try { payload = await req.json(); } catch { return json({ error: 'Body JSON non valido' }, 400); }

  const result = await broadcastToAll(payload);
  return json({ ok: true, ...result });
};

export const config = { path: '/api/send' };

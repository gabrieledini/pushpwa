// Scheduled Function (cron): drena la coda e invia ogni messaggio in broadcast.
// Riproduce il pattern allerte: un producer accoda -> il cron consegna come push.
//
// NB: una scheduled function NON è raggiungibile via HTTP: la invoca lo scheduler.
// La pianificazione è dichiarata inline in `config.schedule` (niente toml necessario).
import { queueStore, broadcastToAll, hasVapid } from './_lib.js';

export default async () => {
  if (!hasVapid()) {
    console.log('[cron] VAPID non configurato: salto il giro.');
    return;
  }

  const queue = queueStore();
  const { blobs } = await queue.list();

  if (blobs.length === 0) {
    console.log('[cron] Coda vuota, nulla da inviare.');
    return;
  }

  console.log(`[cron] ${blobs.length} messaggi in coda.`);
  for (const { key } of blobs) {
    const msg = await queue.get(key, { type: 'json' });
    if (!msg) continue;
    const result = await broadcastToAll(msg);
    console.log(`[cron] "${msg.title}" -> ${JSON.stringify(result)}`);
    await queue.delete(key); // consumato: rimuovo dalla coda
  }
};

// Ogni 5 minuti. Sintassi cron standard (UTC). Es. alternativi: "@hourly", "0 * * * *".
export const config = { schedule: '*/5 * * * *' };

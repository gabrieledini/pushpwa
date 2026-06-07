// GET /api/vapid -> restituisce la chiave VAPID pubblica al client.
// La chiave pubblica NON è segreta: serve al browser per pushManager.subscribe().

export default async () => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  return new Response(JSON.stringify({ publicKey: publicKey || null }), {
    status: publicKey ? 200 : 500,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const config = { path: '/api/vapid' };

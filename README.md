# Push PoC — Web Push su Netlify

Proof of concept che verifica il flusso completo: una **PWA** si iscrive a un
**servizio server** (Netlify Functions + Blobs) e riceve **notifiche Web Push**.

```
push-poc/
├── netlify.toml                # publish=public, functions dir, header SW
├── package.json
├── public/                     # la PWA (hosting statico)
│   ├── index.html              # UI terminale/CRT
│   ├── app.js                  # registra SW, gestisce subscribe/test/unsubscribe
│   ├── sw.js                   # service worker: eventi push / notificationclick
│   ├── manifest.json
│   ├── icon-192.png · icon-512.png
└── netlify/functions/          # il servizio server (serverless)
    ├── _lib.js                 # store Blobs + hashing chiave + helper JSON
    ├── vapid.js                # GET  /api/vapid        -> chiave pubblica
    ├── subscribe.js            # POST /api/subscribe    -> salva sottoscrizione
    ├── unsubscribe.js          # POST /api/unsubscribe  -> rimuove sottoscrizione
    ├── send-test.js            # POST /api/send-test    -> push alla TUA sottoscrizione
    ├── send.js                 # POST /api/send         -> BROADCAST immediato (protetto)
    ├── enqueue.js              # POST /api/enqueue      -> accoda un messaggio (protetto)
    └── scheduled-broadcast.js  # CRON */5 * * * *       -> drena la coda e invia in broadcast
```

## Flusso

1. Il client registra `sw.js`, chiede il permesso, scarica la chiave VAPID pubblica da `/api/vapid`.
2. `pushManager.subscribe()` crea la sottoscrizione → POST a `/api/subscribe` → salvata su Netlify Blobs.
3. `/api/send-test` (verifica PoC) o `/api/send` (broadcast dal tuo backend) usano `web-push` per inviare.
4. Il push service del browser consegna → `sw.js` riceve l'evento `push` → `showNotification`.

## 1. Chiavi VAPID

Generale tu stesso (consigliato):

```bash
npx web-push generate-vapid-keys
```

Oppure usa questa coppia già generata **solo per un test usa-e-getta**
(rigenerala per qualunque cosa seria — la privata qui non è più segreta):

```
VAPID_PUBLIC_KEY=BLwnNUuCGQVx6hmpI39bOCw669A8Xos2gBnmZJCUdV43hQIhrehoeD45zRGaEkeSiwPVApWuXFu2pm7FI7WGyNc
VAPID_PRIVATE_KEY=s6-HjoVm9mhGozTQQLcWQxm9ZkA7JpF0gnc5GYsaSOQ
```

## 2. Variabili d'ambiente (Netlify → Site settings → Environment variables)

| Variabile           | Valore                                            |
|---------------------|---------------------------------------------------|
| `VAPID_PUBLIC_KEY`  | chiave pubblica                                   |
| `VAPID_PRIVATE_KEY` | chiave privata                                    |
| `VAPID_SUBJECT`     | `mailto:tua@email.it` (o un URL https del sito)   |
| `SEND_SECRET`       | una stringa casuale per autorizzare il broadcast  |

## 3. Deploy

**Opzione A — Netlify CLI**
```bash
npm install
netlify deploy --prod    # oppure: netlify dev  (per il locale)
```

**Opzione B — Git**
Push del repo su GitHub/GitLab, poi "Import from Git" su Netlify.
`netlify.toml` configura già `publish` e `functions`, nessuna build necessaria.

> In locale usa **`netlify dev`**: Blobs e le Functions richiedono il runtime
> Netlify. Aprendo `index.html` con un semplice file server le Functions non esistono.

## 4. Test

1. Apri il sito (HTTPS — Netlify lo fornisce di default; `localhost` è ok).
2. **Abilita notifiche** → concedi il permesso.
3. **Invia notifica di test** → dovrebbe arrivare anche con la tab in background.

Broadcast dal tuo backend (la parte "servizio server"):

```bash
curl -X POST https://<tuo-sito>.netlify.app/api/send \
  -H "Authorization: Bearer $SEND_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"title":"Allerta meteo","body":"Messaggio a tutti gli iscritti","url":"/"}'
```

## 5. Cron (Scheduled Function) — pattern a coda

`scheduled-broadcast.js` gira ogni 5 minuti, legge la coda su Blobs, invia ogni
messaggio in broadcast a tutti gli iscritti e poi lo rimuove. Riproduce esattamente
il flusso di un sistema di allerte: **un producer accoda, il cron consegna**.

```
[cattura allerta] --POST /api/enqueue--> [coda Blobs] --cron */5--> [broadcast push]
```

Accodare un messaggio (è ciò che farebbe il tuo capture da Telegram):

```bash
curl -X POST https://<tuo-sito>.netlify.app/api/enqueue \
  -H "Authorization: Bearer $SEND_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"title":"Allerta meteo ARANCIONE","body":"Versilia 12:00-18:00","url":"/"}'
```

Note sul cron:
- La pianificazione è **inline** in `export const config = { schedule: '*/5 * * * *' }`
  (cron standard, fuso **UTC**). Nessuna voce in `netlify.toml` necessaria.
- Una scheduled function **non** è raggiungibile via HTTP: la invoca solo lo scheduler.
- In locale puoi forzarne l'esecuzione con `netlify functions:invoke scheduled-broadcast`.
- I log del giro li vedi in Netlify → Logs → Functions.
- `/api/send` resta disponibile per l'invio **immediato** e sincrono, in parallelo al cron.

## Note e limiti (rilevanti per architetture event-driven)

- Le Functions sono **stateless ed effimere**: niente consumer Kafka persistente né
  WebSocket. L'invio si innesca via HTTP (`/api/send`) o **Scheduled Function** (cron).
  Per agganciare un flusso Kafka → Web Push, il producer chiama `/api/send` via HTTP,
  oppure si tiene il consumer su un servizio long-running esterno che poi invoca Netlify.
- **iOS/Safari**: il Web Push funziona solo se la PWA è **installata sulla Home**.
- **Netlify Blobs** va benissimo come store per la PoC. Per volumi/query reali valuta
  Netlify DB (Postgres) o un DB esterno.
- Lo store usa una chiave = SHA-256 dell'endpoint, così la stessa sottoscrizione non
  viene duplicata. Le sottoscrizioni morte (404/410) vengono rimosse durante il broadcast.

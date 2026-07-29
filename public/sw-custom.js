// Custom service worker additions for Background Sync
// This file is imported by the generated SW via vite-plugin-pwa importScripts.

const DB_NAME = 'hrms-offline'
const STORE_NAME = 'punch-queue'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function getPunches() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function deletePunch(id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const req = tx.objectStore(STORE_NAME).delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

async function getAuthToken() {
  const stored = await new Promise((resolve) => {
    // Read from IDB or ask clients for token
    const req = indexedDB.open('hrms-offline', 1)
    req.onsuccess = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('auth')) { resolve(null); return }
      const tx = db.transaction('auth', 'readonly')
      const r = tx.objectStore('auth').get('token')
      r.onsuccess = () => resolve(r.result?.value ?? null)
      r.onerror = () => resolve(null)
    }
    req.onerror = () => resolve(null)
  })
  return stored
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-punches') {
    event.waitUntil(syncPunches())
  }
})

async function syncPunches() {
  const punches = await getPunches()
  if (!punches.length) return

  // Get token from clients (main thread stores it)
  let token = null
  const clients = await self.clients.matchAll()
  for (const client of clients) {
    const msg = await new Promise((resolve) => {
      const channel = new MessageChannel()
      channel.port1.onmessage = (e) => resolve(e.data)
      client.postMessage({ type: 'GET_AUTH_TOKEN' }, [channel.port2])
      setTimeout(() => resolve(null), 500)
    })
    if (msg?.token) { token = msg.token; break }
  }

  for (const punch of punches) {
    const endpoint = punch.type === 'check-in'
      ? '/api/attendance/check-in'
      : '/api/attendance/check-out'

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(punch.payload),
      })

      if (res.ok || res.status === 422) {
        // 422 = validation error (e.g. already checked in) — still remove from queue
        await deletePunch(punch.id)
        // Notify all clients to refresh attendance
        const allClients = await self.clients.matchAll()
        allClients.forEach((c) => c.postMessage({ type: 'PUNCH_SYNCED', punch }))
      }
    } catch (_) {
      // Network still down — leave in queue
    }
  }
}

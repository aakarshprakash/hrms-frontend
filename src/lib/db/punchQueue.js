// IndexedDB-backed offline punch queue.
// Punches queued here are synced via Background Sync when online.
// Falls back to immediate retry on online event if Background Sync is unavailable.

const DB_NAME = 'hrms-offline'
const STORE_NAME = 'punch-queue'
const DB_VERSION = 1

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function enqueuePunch(type, payload) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req = store.add({ type, payload, queuedAt: new Date().toISOString() })
    req.onsuccess = () => resolve(req.result) // returns the auto-increment id
    req.onerror = () => reject(req.error)
  })
}

export async function getPendingPunches() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function deletePunch(id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const req = tx.objectStore(STORE_NAME).delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function clearPunchQueue() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const req = tx.objectStore(STORE_NAME).clear()
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

// Register a Background Sync tag so the service worker syncs when online.
export async function requestBackgroundSync() {
  try {
    const reg = await navigator.serviceWorker.ready
    if ('sync' in reg) {
      await reg.sync.register('sync-punches')
    }
  } catch (_) {
    // Background Sync not supported — online handler will cover it
  }
}

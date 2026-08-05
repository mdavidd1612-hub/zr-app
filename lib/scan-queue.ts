import { Database } from '@/lib/database.types'

export interface PendingScan {
  id?: string
  sessionId: string
  qrCode: string
  scannedAt: string
  deviceId: string
  synced: boolean
  createdAt?: string
}

const DB_NAME = 'ZRApp'
const STORE_NAME = 'pendingScans'

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
        store.createIndex('synced', 'synced', { unique: false })
        store.createIndex('scannedAt', 'scannedAt', { unique: false })
      }
    }
  })
}

export async function encolar(scan: Omit<PendingScan, 'id' | 'createdAt' | 'synced'>): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.add({
      ...scan,
      synced: false,
      createdAt: new Date().toISOString(),
    })
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

export async function sincronizar(
  apiFn: (scan: PendingScan) => Promise<{ ok: boolean; duplicate?: boolean }>
): Promise<{ sincronizados: number; errores: number }> {
  const db = await openDB()
  const tx = db.transaction([STORE_NAME], 'readwrite')
  const store = tx.objectStore(STORE_NAME)
  const index = store.index('synced')
  const pendingScans = await new Promise<PendingScan[]>((resolve, reject) => {
    const request = index.getAll(IDBKeyRange.only(false))
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })

  let sincronizados = 0
  let errores = 0

  // Ordenar por scannedAt
  const sorted = pendingScans.sort((a, b) => new Date(a.scannedAt).getTime() - new Date(b.scannedAt).getTime())

  for (const scan of sorted) {
    try {
      const result = await apiFn(scan)
      if (result.ok || result.duplicate) {
        // Marcar como sincronizado (duplicate cuenta como éxito)
        const updateTx = db.transaction([STORE_NAME], 'readwrite')
        const updateStore = updateTx.objectStore(STORE_NAME)
        updateStore.delete(scan.id!)
        sincronizados++
      } else {
        errores++
      }
    } catch (error) {
      console.error('Error sincronizando escaneo:', error)
      errores++
    }
  }

  return { sincronizados, errores }
}

export async function contarPendientes(): Promise<number> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const index = store.index('synced')
    const request = index.count(IDBKeyRange.only(false))
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

export function listenToOnline(onlineCallback: () => void): () => void {
  window.addEventListener('online', onlineCallback)
  return () => window.removeEventListener('online', onlineCallback)
}

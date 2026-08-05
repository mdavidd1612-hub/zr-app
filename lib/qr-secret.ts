'use client'

// T-107: Almacenamiento seguro del secreto TOTP en IndexedDB
// Nunca localStorage: es visible en document.localStorage y atraviesa archivos.

const DB_NAME = 'zr_app_secrets'
const STORE_NAME = 'qr_secrets'
const DB_VERSION = 1

interface StoredSecret {
  secret: string
  issuer: string
  label: string
  periodSeconds: number
  storedAt: number
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'label' })
      }
    }
  })

  return dbPromise
}

// Guarda el secreto después de que provision-qr lo entregó
export async function saveQRSecret(
  secret: string,
  issuer: string,
  label: string,
  periodSeconds: number
): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)

  const stored: StoredSecret = {
    secret,
    issuer,
    label,
    periodSeconds,
    storedAt: Date.now(),
  }

  return new Promise((resolve, reject) => {
    const request = store.put(stored)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

// Lee el secreto para generar el TOTP actual
export async function getQRSecret(label: string): Promise<StoredSecret | null> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)

  return new Promise((resolve, reject) => {
    const request = store.get(label)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result || null)
  })
}

// Borra el secreto (cuando el usuario cambia de teléfono)
export async function deleteQRSecret(label: string): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)

  return new Promise((resolve, reject) => {
    const request = store.delete(label)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

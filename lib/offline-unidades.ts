'use client'

import { createClient } from '@/lib/supabase/client'

/**
 * Unidades descargadas para ver sin internet (18-nov-2026, pedido del coordinador:
 * en la academia a veces no hay internet). Se guardan DENTRO de la app (IndexedDB),
 * no en el gestor de archivos del teléfono, y se leen con el mismo visor.
 *
 * Qué se descarga: PDF, imágenes, documentos Word y los bloques de texto.
 * Video, audio, presentaciones y enlaces no (pesan mucho o viven fuera de la app).
 * Exámenes y tareas siguen necesitando internet.
 */

const DB = 'zr_offline'
const MAX_ARCHIVO = 40 * 1024 * 1024
const MAX_TOTAL = 150 * 1024 * 1024

export interface ItemDescargable {
  contentItemId: string
  titulo: string
  tipo: string | null
  esTexto: boolean
  cuerpoTexto: string | null
}

export interface UnidadGuardada {
  unitId: string
  titulo: string
  savedAt: number
  bytes: number
  items: { id: string; titulo: string; tipo: string | null; esTexto: boolean; cuerpoTexto: string | null; hayArchivo: boolean }[]
}

interface ArchivoGuardado { itemId: string; unitId: string; blob: Blob; tipo: string | null; storagePath: string }

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1)
    r.onerror = () => reject(r.error)
    r.onsuccess = () => resolve(r.result)
    r.onupgradeneeded = () => {
      const db = r.result
      if (!db.objectStoreNames.contains('unidades')) db.createObjectStore('unidades', { keyPath: 'unitId' })
      if (!db.objectStoreNames.contains('archivos')) db.createObjectStore('archivos', { keyPath: 'itemId' })
    }
  })
}

function pedir<T>(db: IDBDatabase, store: string, modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, modo)
    const req = fn(tx.objectStore(store))
    req.onsuccess = () => resolve(req.result as T)
    req.onerror = () => reject(req.error)
  })
}

export const SE_DESCARGAN = new Set(['pdf', 'imagen', 'documento'])

export async function listarDescargas(): Promise<UnidadGuardada[]> {
  const db = await abrir()
  const todas = await pedir<UnidadGuardada[]>(db, 'unidades', 'readonly', (s) => s.getAll())
  return todas.sort((a, b) => b.savedAt - a.savedAt)
}

export async function unidadDescargada(unitId: string): Promise<UnidadGuardada | null> {
  const db = await abrir()
  return (await pedir<UnidadGuardada | undefined>(db, 'unidades', 'readonly', (s) => s.get(unitId))) ?? null
}

export async function leerArchivoLocal(itemId: string): Promise<ArchivoGuardado | null> {
  const db = await abrir()
  return (await pedir<ArchivoGuardado | undefined>(db, 'archivos', 'readonly', (s) => s.get(itemId))) ?? null
}

export async function borrarDescarga(unitId: string): Promise<void> {
  const db = await abrir()
  const u = await unidadDescargada(unitId)
  for (const it of u?.items ?? []) await pedir(db, 'archivos', 'readwrite', (s) => s.delete(it.id))
  await pedir(db, 'unidades', 'readwrite', (s) => s.delete(unitId))
}

/** Descarga lo que se pueda de la unidad. Devuelve cuántos archivos y cuántos se omitieron. */
export async function descargarUnidad(
  unitId: string,
  titulo: string,
  items: ItemDescargable[],
  alAvanzar?: (hechos: number, total: number) => void,
): Promise<{ guardados: number; omitidos: number; bytes: number }> {
  const supabase = createClient()
  const db = await abrir()

  const conArchivo = items.filter((i) => !i.esTexto && i.tipo && SE_DESCARGAN.has(i.tipo))
  const ids = conArchivo.map((i) => i.contentItemId)
  const { data: filas } = ids.length > 0
    ? await supabase.from('content_items').select('id, storage_path').in('id', ids)
    : { data: [] as { id: string; storage_path: string | null }[] }
  const rutaDe = new Map((filas ?? []).map((f) => [f.id, f.storage_path]))

  if (navigator.storage?.estimate) {
    const { quota = 0, usage = 0 } = await navigator.storage.estimate()
    if (quota > 0 && quota - usage < 20 * 1024 * 1024) throw new Error('espacio')
  }

  await borrarDescarga(unitId).catch(() => {})

  let bytes = 0
  let omitidos = 0
  const guardadosIds = new Set<string>()
  let hechos = 0
  for (const it of conArchivo) {
    const ruta = rutaDe.get(it.contentItemId)
    hechos++
    alAvanzar?.(hechos, conArchivo.length)
    if (!ruta) { omitidos++; continue }
    const { data: firma } = await supabase.storage.from('contenido').createSignedUrl(ruta, 600)
    if (!firma?.signedUrl) { omitidos++; continue }
    const resp = await fetch(firma.signedUrl)
    if (!resp.ok) { omitidos++; continue }
    const blob = await resp.blob()
    if (blob.size > MAX_ARCHIVO || bytes + blob.size > MAX_TOTAL) { omitidos++; continue }
    await pedir(db, 'archivos', 'readwrite', (s) => s.put({ itemId: it.contentItemId, unitId, blob, tipo: it.tipo, storagePath: ruta } satisfies ArchivoGuardado))
    bytes += blob.size
    guardadosIds.add(it.contentItemId)
  }

  const guardar: UnidadGuardada = {
    unitId,
    titulo,
    savedAt: Date.now(),
    bytes,
    items: items
      .filter((i) => i.esTexto || guardadosIds.has(i.contentItemId))
      .map((i) => ({ id: i.contentItemId, titulo: i.titulo, tipo: i.tipo, esTexto: i.esTexto, cuerpoTexto: i.cuerpoTexto, hayArchivo: guardadosIds.has(i.contentItemId) })),
  }
  await pedir(db, 'unidades', 'readwrite', (s) => s.put(guardar))
  return { guardados: guardadosIds.size, omitidos: omitidos + items.filter((i) => !i.esTexto && !(i.tipo && SE_DESCARGAN.has(i.tipo))).length, bytes }
}

export function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`
}

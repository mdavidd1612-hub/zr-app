'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { descargarUnidad, borrarDescarga, unidadDescargada, mb, type ItemDescargable, type UnidadGuardada } from '@/lib/offline-unidades'
import { IconoDocumento } from '@/components/ui/Iconos'

/**
 * "Descargar para ver sin conexión" (18-nov-2026): guarda la unidad dentro de la app.
 * Los materiales (PDF, imágenes, Word y textos) se leen luego en "Sin conexión",
 * sin internet. Video, audio, presentaciones, exámenes y tareas siguen con internet.
 */
export function BotonDescargarUnidad({ unitId, titulo, items }: { unitId: string; titulo: string; items: ItemDescargable[] }) {
  const [guardada, setGuardada] = useState<UnidadGuardada | null>(null)
  const [progreso, setProgreso] = useState<string | null>(null)
  const [aviso, setAviso] = useState('')

  useEffect(() => { unidadDescargada(unitId).then(setGuardada).catch(() => {}) }, [unitId])

  async function descargar() {
    setAviso('')
    setProgreso('Descargando…')
    try {
      const r = await descargarUnidad(unitId, titulo, items, (h, t) => setProgreso(`Descargando ${h} de ${t}…`))
      setGuardada(await unidadDescargada(unitId))
      // Deja lista la pantalla "Sin conexión" en el caché del teléfono para abrirla sin internet.
      void fetch('/descargas').catch(() => {})
      setAviso(
        r.guardados + items.filter((i) => i.esTexto).length === 0
          ? 'Esta unidad no tiene nada que se pueda descargar (video, audio y presentaciones necesitan internet).'
          : r.omitidos > 0 ? `Listo. ${r.omitidos} material${r.omitidos === 1 ? '' : 'es'} (video, audio, presentaciones o muy pesados) necesitan internet.` : '',
      )
    } catch (e) {
      setAviso((e as Error).message === 'espacio' ? 'No hay espacio suficiente en el teléfono.' : 'No se pudo descargar. Revisa tu conexión e inténtalo otra vez.')
    }
    setProgreso(null)
  }

  async function quitar() {
    await borrarDescarga(unitId)
    setGuardada(null)
    setAviso('')
  }

  return (
    <div className="zr-card space-y-3 p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zr-surface text-zr-blue-mid"><IconoDocumento size={20} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-zr-text">Ver sin conexión</p>
          <p className="text-xs text-zr-text-muted">
            {guardada ? `Descargada · ${mb(guardada.bytes)}` : 'Descarga esta unidad en la app para leerla sin internet.'}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={descargar}
          disabled={progreso !== null}
          className="min-h-11 rounded-xl bg-zr-blue px-4 text-sm font-bold text-white disabled:opacity-50"
        >
          {progreso ?? (guardada ? 'Actualizar descarga' : 'Descargar unidad')}
        </button>
        {guardada && (
          <>
            <Link href="/descargas" className="inline-flex min-h-11 items-center rounded-xl border border-zr-border px-4 text-sm font-bold text-zr-text">Abrir descargas</Link>
            <button onClick={quitar} className="min-h-11 rounded-xl px-3 text-sm font-semibold text-zr-error">Quitar</button>
          </>
        )}
      </div>
      {aviso && <p className="text-xs text-zr-text-muted">{aviso}</p>}
    </div>
  )
}

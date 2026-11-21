'use client'

import { useEffect, useState } from 'react'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { EstadoVacio } from '@/components/ui/EstadoVacio'
import { TarjetaHero } from '@/components/ui/TarjetaHero'
import { TextoRico } from '@/components/ui/TextoRico'
import { VisorMaterial } from '@/components/ui/VisorMaterial'
import { IconoDocumento, IconoChevron } from '@/components/ui/Iconos'
import { iconoDeMaterial } from '@/components/ui/IconoMaterial'
import { listarDescargas, leerArchivoLocal, borrarDescarga, mb, type UnidadGuardada } from '@/lib/offline-unidades'
import type { TipoMaterial } from '@/lib/material'

/**
 * Sin conexión (18-nov-2026): lo que el estudiante descargó, leído dentro de la
 * app y sin internet. Esta pantalla no consulta la base de datos: todo sale del
 * almacenamiento del teléfono (lib/offline-unidades.ts). No registra "material
 * visto": ese avance se cuenta cuando lo abre con internet.
 */

type Item = UnidadGuardada['items'][number]

export default function Descargas() {
  const [unidades, setUnidades] = useState<UnidadGuardada[]>([])
  const [cargando, setCargando] = useState(true)
  const [unidad, setUnidad] = useState<UnidadGuardada | null>(null)
  const [item, setItem] = useState<Item | null>(null)
  const [archivo, setArchivo] = useState<{ blob: Blob; storagePath: string } | null>(null)

  async function refrescar() {
    setUnidades(await listarDescargas().catch(() => []))
    setCargando(false)
  }
  useEffect(() => { void refrescar() }, [])

  async function abrir(it: Item) {
    setItem(it)
    setArchivo(null)
    if (it.hayArchivo) {
      const a = await leerArchivoLocal(it.id)
      if (a) setArchivo({ blob: a.blob, storagePath: a.storagePath })
    }
  }

  // Lector de un material
  if (unidad && item) {
    return (
      <div className="min-h-dvh bg-zr-bg px-5 pb-28 pt-[calc(3.5rem+env(safe-area-inset-top))]">
        <div className="space-y-5">
          <button onClick={() => { setItem(null); setArchivo(null) }} className="text-sm font-bold text-zr-blue">← {unidad.titulo}</button>
          <h1 className="zr-display text-2xl text-zr-text">{item.titulo}</h1>
          {item.esTexto ? (
            <div className="zr-card p-5"><TextoRico texto={item.cuerpoTexto ?? ''} /></div>
          ) : archivo ? (
            <VisorMaterial
              contentItemId={item.id}
              tipo={(item.tipo ?? 'pdf') as TipoMaterial}
              storagePath={archivo.storagePath}
              archivoLocal={archivo.blob}
              registrarProgreso={false}
            />
          ) : (
            <div className="zr-skel h-64 w-full rounded-xl" />
          )}
        </div>
      </div>
    )
  }

  // Contenido de una unidad
  if (unidad) {
    return (
      <div className="min-h-dvh bg-zr-bg px-5 pb-28 pt-[calc(3.5rem+env(safe-area-inset-top))]">
        <div className="space-y-5">
          <button onClick={() => setUnidad(null)} className="text-sm font-bold text-zr-blue">← Sin conexión</button>
          <h1 className="zr-display text-2xl text-zr-text">{unidad.titulo}</h1>
          <p className="text-xs text-zr-text-muted">Descargada el {new Date(unidad.savedAt).toLocaleDateString('es-VE', { day: 'numeric', month: 'long' })} · {mb(unidad.bytes)}</p>
          <div className="space-y-2">
            {unidad.items.map((it) => {
              const Icono = iconoDeMaterial(it.esTexto ? null : it.tipo)
              return (
                <button key={it.id} onClick={() => abrir(it)} className="zr-card flex w-full items-center gap-3 p-4 text-left">
                  <span className="text-zr-blue-mid"><Icono size={20} /></span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zr-text">{it.titulo}</span>
                  <IconoChevron size={16} className="-rotate-90 text-zr-text-muted" />
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-zr-bg px-5 pb-28 pt-[calc(3.5rem+env(safe-area-inset-top))]">
      <div className="space-y-7">
        <BotonVolver href="/unidades" />
        <TarjetaHero
          sobretitulo="Unidades"
          titulo="Sin conexión"
          texto="Las unidades que descargaste, para leerlas aunque no haya internet. Se descargan desde cada unidad."
          icono={<IconoDocumento size={24} />}
        />
        {!cargando && unidades.length === 0 ? (
          <EstadoVacio
            Icono={IconoDocumento}
            titulo="No has descargado nada"
            explicacion="Entra a una unidad y toca “Descargar unidad”. Con internet y a la vez en el teléfono, queda guardada aquí."
          />
        ) : (
          <div className="space-y-3">
            {unidades.map((u) => (
              <div key={u.unitId} className="zr-card space-y-3 p-5">
                <button onClick={() => setUnidad(u)} className="flex w-full items-center gap-3 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-bold text-zr-text">{u.titulo}</span>
                    <span className="block text-xs text-zr-text-muted">{u.items.length} material{u.items.length === 1 ? '' : 'es'} · {mb(u.bytes)}</span>
                  </span>
                  <IconoChevron size={16} className="-rotate-90 text-zr-text-muted" />
                </button>
                <button onClick={async () => { await borrarDescarga(u.unitId); await refrescar() }} className="text-xs font-bold text-zr-error">Quitar descarga</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

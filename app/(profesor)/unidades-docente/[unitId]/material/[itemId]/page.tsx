'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Encabezado } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { PantallaEsqueleto } from '@/components/ui/Esqueleto'
import { VisorMaterial } from '@/components/ui/VisorMaterial'
import type { TipoMaterial } from '@/lib/material'

/**
 * Aula Virtual — el profesor (y dirección/super_admin, que comparten esta
 * vista) PREVISUALIZA un material tal cual lo ve el estudiante, con el mismo
 * VisorMaterial. Pedido del coordinador (nov. 2026): desde la unidad, cada
 * material tiene que poder "Verse" -- antes solo el estudiante podía abrirlo.
 *
 * No mide progreso ni mini-chequeo: esto es una previsualización del docente,
 * no una clase. (VisorMaterial intenta guardar material_progress con su propio
 * id; la RLS de esa tabla solo admite al estudiante dueño, así que para el
 * profesor el upsert se rechaza sin romper nada -- no se registra avance.)
 */

interface Material {
  title: string
  type: TipoMaterial
  storage_path: string | null
  external_url: string | null
  description: string | null
}

export default function MaterialDocente() {
  const router = useRouter()
  const params = useParams()
  const itemId = params.itemId as string
  const unitId = params.unitId as string

  const [material, setMaterial] = useState<Material | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const { data } = await supabase
        .from('content_items')
        .select('title, type, storage_path, external_url, description')
        .eq('id', itemId)
        .maybeSingle()

      // Un video de YouTube (type='enlace') nunca tiene storage_path.
      if (!data || (data.type !== 'enlace' && !data.storage_path)) {
        router.replace(`/unidades-docente/${unitId}`)
        return
      }
      setMaterial(data as unknown as Material)
      setCargando(false)
    }
    cargar()
  }, [itemId, unitId, router])

  if (cargando || !material) return <PantallaEsqueleto />

  return (
    <div className="min-h-dvh bg-zr-bg px-5 pb-28 pt-[calc(3.5rem+env(safe-area-inset-top))]">
      <div className="space-y-8">
        <BotonVolver href={`/unidades-docente/${unitId}`} />

        <Encabezado
          sobretitulo="Vista previa del material"
          titulo={material.title}
          descripcion={material.description ?? undefined}
        />

        <VisorMaterial
          contentItemId={itemId}
          tipo={material.type}
          storagePath={material.storage_path ?? ''}
          externalUrl={material.external_url}
        />
      </div>
    </div>
  )
}

'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Encabezado } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { PantallaEsqueleto } from '@/components/ui/Esqueleto'
import { VisorMaterial } from '@/components/ui/VisorMaterial'
import type { TipoMaterial } from '@/lib/material'

interface Material {
  title: string
  type: TipoMaterial
  storage_path: string
  description: string | null
}

export default function MaterialDeUnidad() {
  const router = useRouter()
  const params = useParams()
  const itemId = params.itemId as string
  const unitId = params.unitId as string

  const [material, setMaterial] = useState<Material | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data } = await supabase
        .from('content_items')
        .select('title, type, storage_path, description')
        .eq('id', itemId)
        .maybeSingle()

      if (!data?.storage_path) {
        router.back()
        return
      }

      setMaterial(data as Material)
      setCargando(false)
    }
    cargar()
  }, [itemId, router])

  if (cargando || !material) return <PantallaEsqueleto />

  return (
    <div className="min-h-dvh bg-zr-bg px-5 pb-28 pt-14">
      <div className="space-y-8">
        <BotonVolver href={`/unidades/${unitId}`} />

        <Encabezado sobretitulo="Material" titulo={material.title} descripcion={material.description ?? undefined} />

        <VisorMaterial
          contentItemId={itemId}
          tipo={material.type}
          storagePath={material.storage_path}
        />
      </div>
    </div>
  )
}

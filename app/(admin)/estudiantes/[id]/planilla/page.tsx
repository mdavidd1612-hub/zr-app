'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { PlanillaDocumento, type DatosPlanilla } from '@/components/planilla/PlanillaDocumento'
import { cargarDatosPlanilla } from '@/lib/planilla-datos'

// "Imprimir" usa el diálogo del navegador (Guardar como PDF), sin depender de
// ninguna librería de PDF en el servidor. El diseño de la planilla vive en
// components/planilla/PlanillaDocumento.tsx — se reusa también al descargar
// todas las de un programa de una vez (ver estudiantes/page.tsx).

export default function PlanillaEstudiante() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [datos, setDatos] = useState<DatosPlanilla | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargar() {
      const datos = await cargarDatosPlanilla(id)
      setDatos(datos)
      setCargando(false)
    }
    cargar()
  }, [id, router])

  if (cargando || !datos) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando planilla…</p>
      </div>
    )
  }

  return (
    <div className="px-5 pb-16 pt-14 print:px-0 print:pt-0">
      <div className="print:hidden">
        <BotonVolver href={`/estudiantes/${id}`} />
        <button
          onClick={() => window.print()}
          className="mt-6 min-h-14 w-full rounded-lg bg-zr-blue text-base font-bold text-white"
        >
          Imprimir / Guardar como PDF
        </button>
      </div>

      <PlanillaDocumento datos={datos} />
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { PlanillaDocumento, type DatosPlanilla } from '@/components/planilla/PlanillaDocumento'
import { cargarDatosPlanilla } from '@/lib/planilla-datos'
import { CAMPOS_TODOS, type CamposPlanilla } from '@/lib/planilla-campos'
import { SelectorCampos } from '@/components/planilla/SelectorCampos'
import { PantallaEsqueleto } from '@/components/ui/Esqueleto'

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
  // Checklist de campos (pedido de Dirección Académica, nov. 2026): se puede
  // quitar lo que no se quiera imprimir. Lo elegido se refleja en la planilla
  // que se ve en pantalla, que es exactamente lo que sale al imprimir/guardar.
  const [campos, setCampos] = useState<CamposPlanilla>(CAMPOS_TODOS)
  const [abiertoSelector, setAbiertoSelector] = useState(false)

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
      <PantallaEsqueleto />
    )
  }

  return (
    <div className="px-5 pb-16 pt-14 print:px-0 print:pt-0">
      <div className="print:hidden">
        <BotonVolver href={`/estudiantes/${id}`} />

        {/* Elegir qué campos salen impresos. Se despliega para no estorbar a
            quien solo quiere imprimir la planilla completa (todo marcado). */}
        <button
          onClick={() => setAbiertoSelector((v) => !v)}
          className="mt-6 flex min-h-14 w-full items-center justify-between rounded-lg border border-zr-border px-5 text-sm font-bold text-zr-text"
        >
          <span>Elegir campos a imprimir</span>
          <span className="text-zr-text-muted">{abiertoSelector ? 'Ocultar' : 'Mostrar'}</span>
        </button>
        {abiertoSelector && (
          <div className="mt-3 rounded-lg border border-zr-border bg-zr-surface p-5">
            <SelectorCampos campos={campos} onCambiar={setCampos} />
          </div>
        )}

        <button
          onClick={() => window.print()}
          className="mt-3 min-h-14 w-full rounded-lg bg-zr-blue text-base font-bold text-white"
        >
          Imprimir / Guardar como PDF
        </button>
      </div>

      <PlanillaDocumento datos={datos} campos={campos} />
    </div>
  )
}

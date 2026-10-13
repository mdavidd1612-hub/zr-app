'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Seccion } from '@/components/ui/Editorial'
import { EstadoVacio } from '@/components/ui/EstadoVacio'
import { ContextoDocente, AvisoModuloBloqueado, type ContextoSel } from '@/components/ui/ContextoDocente'
import { ResultadosFeedback, type FilaResumenFeedback } from '@/components/ui/ResultadosFeedback'

/**
 * Feedback de módulo, del lado del profesor — pedido explícito del
 * coordinador (sept. 2026): "el profesor le va a llegar solamente el del
 * módulo que le corresponde". Nunca ve una fila por estudiante ni el texto
 * libre en crudo — solo el mismo agregado que ve Dirección Académica
 * (`v_feedback_macro_summary`, migración 097). No puede abrir ni cerrar el
 * formulario, eso es de Dirección Académica (/feedback-modulos).
 *
 * No está en la barra fija del profesor a propósito (Fase 0: "las 5
 * secciones que quedan caben todas en la barra") — se llega desde una
 * tarjeta en /hoy, igual que /feedback-clase/[sessionId] se llega desde
 * /sesiones.
 */

function FeedbackInterno({ ctx }: { ctx: ContextoSel }) {
  const [cargando, setCargando] = useState(true)
  const [abierto, setAbierto] = useState(false)
  const [filas, setFilas] = useState<FilaResumenFeedback[]>([])

  useEffect(() => {
    let vigente = true
    async function cargar() {
      const supabase = createClient()
      setCargando(true)
      // El formulario lo abre Dirección Académica; si no lo ha abierto para este
      // programa y módulo, no aparece en la lista del profesor.
      const { data: lista } = await supabase.rpc('fn_feedback_modulos_docente')
      const hay = (lista ?? []).some((c) => c.cohort_id === ctx.cohortId && c.module_id === ctx.moduleId)
      if (!vigente) return
      setAbierto(hay)
      if (hay) {
        const { data: resumen } = await supabase
          .from('v_feedback_macro_summary')
          .select('question, avg_score, response_count')
          .eq('cohort_id', ctx.cohortId).eq('module_id', ctx.moduleId)
        if (!vigente) return
        setFilas((resumen ?? []).map((r) => ({
          pregunta: r.question ?? '', promedio: Number(r.avg_score), respuestas: Number(r.response_count),
        })))
      }
      setCargando(false)
    }
    cargar()
    return () => { vigente = false }
  }, [ctx.cohortId, ctx.moduleId])

  return (
    <div className="space-y-9 px-5 pb-16 pt-8">
      <Encabezado
        sobretitulo="Docencia"
        titulo="Feedback de módulo"
        descripcion={`${ctx.cohorteNombre}${ctx.sede ? ` · ${ctx.sede}` : ''} · Módulo ${ctx.moduloOrden} · ${ctx.moduloNombre}`}
      />

      <Regla delay={60} />

      {ctx.estado === 'no_empezo' && <AvisoModuloBloqueado estado={ctx.estado} />}

      {cargando ? (
        <p className="text-sm text-zr-text-muted">Cargando…</p>
      ) : !abierto ? (
        <EstadoVacio
          titulo="Nada por aquí todavía"
          explicacion="Cuando Dirección Académica abra el formulario de este módulo, el promedio del grupo aparece aquí."
        />
      ) : (
        <Seccion numero={1} titulo="Promedio del grupo" delay={120}>
          <ResultadosFeedback filas={filas} />
        </Seccion>
      )}
    </div>
  )
}

export default function FeedbackModuloDocente() {
  return (
    <ContextoDocente sobretitulo="Docencia" titulo="Feedback de módulo">
      {(ctx) => <FeedbackInterno ctx={ctx} />}
    </ContextoDocente>
  )
}

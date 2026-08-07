'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { IconoAviso } from '@/components/ui/Iconos'
import { BotonVolver } from '@/components/ui/BotonVolver'

/**
 * T-405/406 · Mis clases + aviso de feedback pendiente.
 *
 * Una sesión 'cerrada' sin fila en feedback_micro para este estudiante
 * dispara el aviso — es la única señal de "todavía puedes opinar de esta
 * clase". Una vez que responde, la fila existe (unique(session_id, student_id))
 * y el aviso desaparece solo, sin que nadie tenga que marcarlo a mano.
 */

interface Clase {
  id: string
  titulo: string
  fecha: string
  semana: number
  modulo: string
  estado: 'programada' | 'abierta' | 'cerrada' | 'reprogramada' | 'cancelada'
  necesitaFeedback: boolean
}

const ETIQUETA_ESTADO: Record<Clase['estado'], string> = {
  programada: 'Próxima',
  abierta: 'En curso',
  cerrada: 'Completada',
  reprogramada: 'Reprogramada',
  cancelada: 'Cancelada',
}

export default function Clases() {
  const router = useRouter()
  const [clases, setClases] = useState<Clase[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: sesiones } = await supabase
        .from('class_sessions')
        .select('id, session_date, week_number, status, modules(name)')
        .order('session_date', { ascending: false })

      const filas = (sesiones ?? []) as unknown as {
        id: string; session_date: string; week_number: number
        status: Clase['estado']; modules: { name: string } | null
      }[]

      const { data: yaOpino } = await supabase
        .from('feedback_micro')
        .select('session_id')
        .eq('student_id', user.id)

      const respondidas = new Set((yaOpino ?? []).map((f) => f.session_id))

      setClases(
        filas.map((s) => ({
          id: s.id,
          titulo: s.modules?.name ?? 'Clase',
          fecha: new Date(s.session_date + 'T12:00:00').toLocaleDateString('es-VE', {
            weekday: 'long', day: 'numeric', month: 'long',
          }),
          semana: s.week_number,
          modulo: s.modules?.name ?? 'Módulo',
          estado: s.status,
          necesitaFeedback: s.status === 'cerrada' && !respondidas.has(s.id),
        })),
      )

      setLoading(false)
    }

    cargar()
  }, [router])

  if (loading) {
    return (
      <div className="h-dvh bg-zr-background flex items-center justify-center">
        <div className="text-zr-text-muted">Cargando...</div>
      </div>
    )
  }

  const proximas = clases.filter((c) => c.estado === 'programada' || c.estado === 'abierta')
  const pasadas = clases.filter((c) => c.estado !== 'programada' && c.estado !== 'abierta')
  const conFeedbackPendiente = clases.filter((c) => c.necesitaFeedback)

  return (
    <div className="flex flex-col bg-zr-background min-h-dvh">
      <div className="flex-1 overflow-y-auto px-5 pb-24">
        <div className="space-y-8 pt-14 animate-fade-in">
          <BotonVolver href="/" />

          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-zr-text tracking-tight">Mis Clases</h1>
            <p className="text-sm text-zr-text-muted font-medium">
              {clases.length} sesión{clases.length === 1 ? '' : 'es'}
            </p>
          </div>

          <div className="h-px bg-zr-border" />

          {conFeedbackPendiente.length > 0 && (
            <button
              onClick={() => router.push(`/feedback/${conFeedbackPendiente[0].id}`)}
              className="w-full rounded-lg border border-zr-blue/30 bg-zr-blue/10 p-5 text-left transition-colors hover:border-zr-blue/50"
            >
              <p className="flex items-center gap-2 text-sm font-semibold text-zr-text">
                <IconoAviso size={18} className="text-zr-blue" />
                Danos tu opinión
              </p>
              <p className="mt-2 text-sm text-zr-text-muted">
                La clase de {conFeedbackPendiente[0].titulo} terminó. Tres preguntas, menos de un
                minuto, totalmente anónimo.
              </p>
            </button>
          )}

          {proximas.length > 0 && (
            <div className="space-y-4">
              <span className="text-xs text-zr-blue-mid font-bold tracking-widest">01 — PRÓXIMAS</span>
              <div className="space-y-3">
                {proximas.map((clase, idx) => (
                  <div
                    key={clase.id}
                    className="bg-zr-surface border border-zr-border rounded-lg p-5 animate-fade-in"
                    style={{ animationDelay: `${idx * 100}ms` }}
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold capitalize text-zr-text">{clase.fecha}</h3>
                        <p className="text-xs text-zr-blue-mid font-medium mt-1">
                          Semana {clase.semana} · {clase.modulo}
                        </p>
                      </div>
                      <div className="inline-flex shrink-0 items-center px-3 py-1 rounded-full bg-zr-blue/10 border border-zr-blue/30">
                        <span className="text-xs font-semibold text-zr-blue">{ETIQUETA_ESTADO[clase.estado]}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pasadas.length > 0 && (
            <div className="space-y-4">
              <span className="text-xs text-zr-blue-mid font-bold tracking-widest">
                {proximas.length > 0 ? '02' : '01'} — ANTERIORES
              </span>
              <div className="space-y-3">
                {pasadas.map((clase, idx) => (
                  <div
                    key={clase.id}
                    className="bg-zr-surface border border-zr-border rounded-lg p-5 animate-fade-in"
                    style={{ animationDelay: `${idx * 60}ms` }}
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold capitalize text-zr-text">{clase.fecha}</h3>
                        <p className="text-xs text-zr-text-muted mt-1">
                          Semana {clase.semana} · {clase.modulo}
                        </p>
                      </div>
                      <div className="inline-flex shrink-0 items-center px-3 py-1 rounded-full bg-zr-border/40">
                        <span className="text-xs font-semibold text-zr-text-muted">{ETIQUETA_ESTADO[clase.estado]}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {clases.length === 0 && (
            <div className="zr-card p-8 text-center">
              <p className="text-base font-semibold text-zr-text">Todavía no hay clases programadas</p>
            </div>
          )}

          <div className="bg-zr-blue/10 border border-zr-blue/30 rounded-lg p-5 space-y-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-zr-text">
              <IconoAviso size={18} className="text-zr-blue" />
              Antes de venir
            </p>
            <p className="text-sm text-zr-text-muted">
              Prepárate con el material de estudio disponible en la sección de Material.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

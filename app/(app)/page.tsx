'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Seccion, Regla, Dato } from '@/components/ui/Editorial'

interface ProximoSabado {
  sessionId: string
  fecha: string
  semana: number
  modulo: string
  competencia: string | null
  investigacion: string | null
}

interface Dominio {
  dominadas: number
  enProgreso: number
  pendientes: number
}

export default function Inicio() {
  const router = useRouter()
  const [nombre, setNombre] = useState('')
  const [proximo, setProximo] = useState<ProximoSabado | null>(null)
  const [dominio, setDominio] = useState<Dominio>({ dominadas: 0, enProgreso: 0, pendientes: 0 })
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: perfil } = await supabase
        .from('profiles').select('full_name').eq('id', user.id).single()
      if (perfil) setNombre(perfil.full_name)

      // T-414 · «Próximo sábado». El dato ya existe en learning_guides; hoy se
      // dice de palabra al final de la clase, cuando nadie presta atención.
      const { data: prox } = await supabase
        .from('v_proximo_sabado')
        .select('*')
        .eq('student_id', user.id)
        .maybeSingle()

      if (prox) {
        setProximo({
          sessionId: prox.session_id!,
          fecha: prox.session_date!,
          semana: prox.week_number!,
          modulo: prox.module_name!,
          competencia: prox.sub_competency_name,
          investigacion: prox.pre_practice_description,
        })
      }

      // T-415 · Estado de cada competencia. Sin puntos, sin niveles, sin
      // comparación con otros: solo dominada / en progreso / pendiente.
      const { data: comps } = await supabase
        .from('v_mi_dominio')
        .select('status')
        .eq('student_id', user.id)

      if (comps) {
        setDominio({
          dominadas:  comps.filter((c) => c.status === 'dominado').length,
          enProgreso: comps.filter((c) => c.status === 'en_progreso').length,
          // Sin fila en mastery_map la vista devuelve 'no_iniciado' o null;
          // para el estudiante las dos cosas son lo mismo: todavía no lo ha visto.
          pendientes: comps.filter((c) => c.status !== 'dominado' && c.status !== 'en_progreso').length,
        })
      }

      setCargando(false)
    }

    cargar()
  }, [router])

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando…</p>
      </div>
    )
  }

  const primerNombre = nombre.split(' ')[0] || 'Estudiante'
  const fechaCorta = proximo
    ? new Date(proximo.fecha + 'T12:00:00').toLocaleDateString('es-VE', { day: 'numeric', month: 'long' })
    : ''

  return (
    <div className="min-h-dvh bg-zr-bg px-5 pb-28 pt-14">
      <div className="space-y-11">
        {/* Saludo */}
        <header className="animate-rise" style={{ animationDelay: '0ms' }}>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">
            ZR Mecademy
          </p>
          <h1 className="zr-display mt-3 text-4xl text-zr-text">{primerNombre}</h1>
        </header>

        <Regla delay={60} />

        {/* 01 — PRÓXIMO SÁBADO */}
        <Seccion numero={1} titulo="Próximo sábado" delay={120}>
          {!proximo ? (
            <div className="zr-card p-7">
              <p className="text-base font-semibold text-zr-text">Sin clase programada</p>
              <p className="mt-2 text-sm text-zr-text-muted">
                Cuando la academia programe tu próxima sesión, aquí verás qué tienes que
                preparar antes de llegar al taller.
              </p>
            </div>
          ) : (
            <div className="zr-card overflow-hidden">
              <div className="border-b border-zr-border px-6 py-5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="zr-display text-xl text-zr-text">{fechaCorta}</p>
                  <p className="text-xs font-semibold uppercase tracking-wider text-zr-text-muted">
                    Semana {proximo.semana}
                  </p>
                </div>
                <p className="mt-1 text-sm text-zr-blue-mid">{proximo.modulo}</p>
              </div>

              <div className="space-y-4 px-6 py-6">
                {proximo.competencia ? (
                  <>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-text-muted">
                        Competencia
                      </p>
                      <p className="mt-2 text-base font-semibold text-zr-text">
                        {proximo.competencia}
                      </p>
                    </div>

                    {/* Si la guía no está digitalizada, no se inventa texto. */}
                    {proximo.investigacion && (
                      <div className="rounded-lg border border-zr-blue/25 bg-zr-blue/10 p-4">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">
                          Trae investigado
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-zr-text">
                          {proximo.investigacion}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-zr-text-muted">
                    La guía de esta semana todavía no está cargada. Tu profesor te dirá qué
                    preparar al cierre de la clase.
                  </p>
                )}
              </div>
            </div>
          )}
        </Seccion>

        {/* 02 — MI PROGRESO */}
        <Seccion numero={2} titulo="Mi progreso" delay={200}>
          <div className="grid grid-cols-3 gap-3">
            <Dato valor={dominio.dominadas}  etiqueta="Dominadas"   tono="exito" />
            <Dato valor={dominio.enProgreso} etiqueta="En progreso" tono="azul" />
            <Dato valor={dominio.pendientes} etiqueta="Pendientes"  tono="neutro" />
          </div>
          <button
            onClick={() => router.push('/progreso')}
            className="zr-card zr-card-interactive w-full px-6 py-4 text-left"
          >
            <p className="text-sm font-semibold text-zr-text">Ver todas mis competencias</p>
            <p className="mt-1 text-xs text-zr-text-muted">
              Qué domino y qué me falta, módulo por módulo
            </p>
          </button>
        </Seccion>

        {/* 03 — ACCESOS */}
        <Seccion numero={3} titulo="Accesos" delay={280}>
          <div className="space-y-3">
            <button
              onClick={() => router.push('/perfil')}
              className="w-full overflow-hidden rounded-lg bg-gradient-to-r from-zr-blue-deep to-zr-blue px-6 py-5 text-left transition-all hover:shadow-lg hover:shadow-zr-blue/25"
            >
              <p className="text-base font-bold text-white">Mi carnet</p>
              <p className="mt-0.5 text-sm text-white/70">Código QR para pasar asistencia</p>
            </button>

            <div className="grid grid-cols-2 gap-3">
              {[
                { href: '/examenes',  titulo: 'Exámenes', sub: 'Evaluaciones' },
                { href: '/notas',     titulo: 'Notas',    sub: 'Calificaciones' },
                { href: '/clases',    titulo: 'Clases',   sub: 'Calendario' },
                { href: '/contenido', titulo: 'Material', sub: 'Guías y PDFs' },
              ].map((a) => (
                <button
                  key={a.href}
                  onClick={() => router.push(a.href)}
                  className="zr-card zr-card-interactive px-4 py-4 text-left"
                >
                  <p className="text-sm font-bold text-zr-text">{a.titulo}</p>
                  <p className="mt-0.5 text-xs text-zr-text-muted">{a.sub}</p>
                </button>
              ))}
            </div>
          </div>
        </Seccion>
      </div>
    </div>
  )
}

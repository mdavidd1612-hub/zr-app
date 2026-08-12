'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Etiqueta } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { EstadoVacio } from '@/components/ui/EstadoVacio'
import { esDireccionAcademica } from '@/lib/auth-helpers'
import type { UserRole } from '@/lib/types'

// Vista de solo lectura: Dirección Académica supervisa qué exámenes existen,
// quién los hizo y en qué estado están — no los edita desde aquí (eso sigue
// siendo del profesor dueño de la cohorte, dentro de su propio flujo de
// creación/calificación).

interface Examen {
  id: string
  titulo: string
  moduloNombre: string | null
  cohorteNombre: string | null
  profesorNombre: string | null
  publicado: boolean
  creadoEl: string
}

export default function ExamenesAcademicos() {
  const router = useRouter()
  const [autorizado, setAutorizado] = useState<boolean | null>(null)
  const [examenes, setExamenes] = useState<Examen[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vigente = true
    const supabase = createClient()

    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (!vigente) return

      if (!esDireccionAcademica(perfil?.role as UserRole | undefined)) {
        setAutorizado(false)
        return
      }
      setAutorizado(true)

      const { data } = await supabase
        .from('exams')
        .select('id, title, status, created_at, modules(name), cohorts(name), teachers(profiles(full_name))')
        .order('created_at', { ascending: false })

      if (!vigente) return

      type ExamenCrudo = {
        id: string
        title: string
        status: string
        created_at: string
        modules: { name: string } | null
        cohorts: { name: string } | null
        teachers: { profiles: { full_name: string } | null } | null
      }

      setExamenes(
        ((data ?? []) as unknown as ExamenCrudo[]).map((e) => ({
          id: e.id,
          titulo: e.title,
          moduloNombre: e.modules?.name ?? null,
          cohorteNombre: e.cohorts?.name ?? null,
          profesorNombre: e.teachers?.profiles?.full_name ?? null,
          publicado: e.status !== 'oculto',
          creadoEl: e.created_at,
        })),
      )
      setCargando(false)
    }

    cargar()
    return () => { vigente = false }
  }, [router])

  if (autorizado === false) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg px-5 text-center">
        <p className="text-sm text-zr-text-muted">Esta pantalla es solo para Dirección Académica.</p>
      </div>
    )
  }

  if (cargando || autorizado === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando exámenes…</p>
      </div>
    )
  }

  return (
    <div className="space-y-11 px-5 pt-14 pb-10">
      <BotonVolver href="/panel" />

      <Encabezado sobretitulo="Dirección Académica" titulo="Exámenes" descripcion={`${examenes.length} en total, de todos los profesores`} />

      <Regla delay={60} />

      {examenes.length === 0 ? (
        <EstadoVacio titulo="Sin exámenes" explicacion="Todavía ningún profesor ha creado un examen." />
      ) : (
        <div className="space-y-3">
          {examenes.map((e) => (
            <div key={e.id} className="zr-card space-y-2 p-5">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 truncate text-base font-semibold text-zr-text">{e.titulo}</p>
                <Etiqueta tono={e.publicado ? 'exito' : 'neutro'}>
                  {e.publicado ? 'Publicado' : 'Borrador'}
                </Etiqueta>
              </div>
              <p className="text-sm text-zr-text-muted">
                {e.moduloNombre ?? '—'}{e.cohorteNombre ? ` · ${e.cohorteNombre}` : ''}
              </p>
              <p className="text-xs text-zr-text-muted">
                {e.profesorNombre ?? 'Sin profesor'} · {new Date(e.creadoEl).toLocaleDateString('es-VE')}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

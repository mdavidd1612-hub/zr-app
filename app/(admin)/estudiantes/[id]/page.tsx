'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Seccion, Etiqueta } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import Link from 'next/link'

interface Ficha {
  nombre: string
  cedula: string
  correo: string
  telefono: string | null
  edad: number
  esMenor: boolean
  cohorteId: string | null
  estado: string
  ingreso: string
  validadoEn: string | null
}

export default function FichaEstudiante() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [ficha, setFicha] = useState<Ficha | null>(null)
  const [cohortes, setCohortes] = useState<{ id: string; name: string }[]>([])
  const [nuevaCohorte, setNuevaCohorte] = useState('')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const [{ data: est }, { data: cohs }] = await Promise.all([
        supabase
          .from('v_students')
          .select('full_name, cedula, contact_email, phone, age_years, is_minor, cohort_id, status, enrollment_date, validated_at')
          .eq('id', id)
          .single(),
        supabase.from('cohorts').select('id, name').eq('status', 'activa'),
      ])

      if (est) {
        setFicha({
          nombre: est.full_name ?? 'Sin nombre',
          cedula: est.cedula ?? '—',
          correo: est.contact_email ?? '—',
          telefono: est.phone,
          edad: est.age_years ?? 0,
          esMenor: est.is_minor ?? false,
          cohorteId: est.cohort_id,
          estado: est.status ?? 'activo',
          ingreso: est.enrollment_date ?? '',
          validadoEn: est.validated_at,
        })
        setNuevaCohorte(est.cohort_id ?? '')
      }

      setCohortes(cohs ?? [])
      setCargando(false)
    }

    cargar()
  }, [id, router])

  async function validar() {
    setGuardando(true)
    setMensaje(null)

    const { data: { user } } = await createClient().auth.getUser()
    const { error } = await createClient()
      .from('students')
      .update({ validated_at: new Date().toISOString(), validated_by: user?.id ?? null })
      .eq('id', id)

    if (error) {
      setMensaje(error.message)
    } else {
      setFicha((f) => (f ? { ...f, validadoEn: new Date().toISOString() } : f))
      setMensaje('Estudiante validado.')
    }
    setGuardando(false)
  }

  async function guardarCohorte() {
    setGuardando(true)
    setMensaje(null)

    const { error } = await createClient()
      .from('students')
      .update({ cohort_id: nuevaCohorte || null })
      .eq('id', id)

    if (error) {
      setMensaje(error.message)
    } else {
      setFicha((f) => (f ? { ...f, cohorteId: nuevaCohorte || null } : f))
      setMensaje('Programa actualizado.')
    }
    setGuardando(false)
  }

  if (cargando || !ficha) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando ficha…</p>
      </div>
    )
  }

  return (
    <div className="space-y-11 px-5 pt-14">
      <BotonVolver href="/estudiantes" />

      <Encabezado sobretitulo="Administración · Estudiantes" titulo={ficha.nombre} />

      <Regla delay={60} />

      {!ficha.validadoEn && (
        <Seccion numero={0} titulo="Validación pendiente" delay={80}>
          <div className="zr-card space-y-4 border-zr-warning/40 p-5">
            <p className="text-sm leading-relaxed text-zr-text-muted">
              Este estudiante todavía no puede usar la app completa — solo ve Inicio y Perfil,
              con un aviso de que su cuenta está en validación. Imprime su planilla, que la firme
              en persona, y valida aquí para desbloquearlo.
            </p>
            {mensaje && (
              <p className={`text-sm font-medium ${mensaje.includes('validado') ? 'text-zr-success' : 'text-zr-error'}`}>
                {mensaje}
              </p>
            )}
            <button
              onClick={validar}
              disabled={guardando}
              className="min-h-14 w-full rounded-lg bg-zr-blue text-base font-bold text-white disabled:opacity-40"
            >
              {guardando ? 'Validando…' : 'Validar estudiante (ya firmó en persona)'}
            </button>
          </div>
        </Seccion>
      )}

      <Seccion numero={1} titulo="Datos" delay={120}>
        <div className="zr-card divide-y divide-zr-border">
          <Fila etiqueta="Cédula" valor={ficha.cedula} mono />
          <Fila etiqueta="Correo de contacto" valor={ficha.correo} />
          <Fila etiqueta="Teléfono" valor={ficha.telefono ?? '—'} />
          <Fila etiqueta="Edad" valor={`${ficha.edad} años${ficha.esMenor ? ' · menor de edad' : ''}`} />
          <Fila etiqueta="Ingreso" valor={new Date(ficha.ingreso + 'T12:00:00').toLocaleDateString('es-VE')} />
          <div className="flex items-center justify-between px-5 py-4">
            <span className="text-xs font-bold uppercase tracking-wider text-zr-text-muted">Estado</span>
            <Etiqueta tono={ficha.estado === 'activo' ? 'exito' : ficha.estado === 'suspendido' ? 'error' : 'neutro'}>
              {ficha.estado}
            </Etiqueta>
          </div>
        </div>
      </Seccion>

      <Seccion numero={2} titulo="Programa" delay={200}>
        <div className="zr-card space-y-4 p-5">
          <select
            value={nuevaCohorte}
            onChange={(e) => setNuevaCohorte(e.target.value)}
            className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
          >
            <option value="">Sin programa</option>
            {cohortes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {mensaje && (
            <p className={`text-sm font-medium ${mensaje.includes('actualizado') ? 'text-zr-success' : 'text-zr-error'}`}>
              {mensaje}
            </p>
          )}

          <button
            onClick={guardarCohorte}
            disabled={guardando || nuevaCohorte === (ficha.cohorteId ?? '')}
            className="min-h-14 w-full rounded-lg bg-zr-blue text-base font-bold text-white disabled:opacity-40"
          >
            {guardando ? 'Guardando…' : 'Cambiar programa'}
          </button>
        </div>
      </Seccion>

      <Seccion numero={3} titulo="Planilla" delay={260}>
        <Link
          href={`/estudiantes/${id}/planilla`}
          className="zr-card zr-card-interactive flex min-h-14 w-full items-center justify-center px-6 text-base font-bold text-zr-blue"
        >
          Ver planilla para firmar
        </Link>
      </Seccion>
    </div>
  )
}

function Fila({ etiqueta, valor, mono }: { etiqueta: string; valor: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-5 py-4">
      <span className="shrink-0 text-xs font-bold uppercase tracking-wider text-zr-text-muted">{etiqueta}</span>
      <span className={`min-w-0 truncate text-right text-base text-zr-text ${mono ? 'tabular-nums' : ''}`}>{valor}</span>
    </div>
  )
}

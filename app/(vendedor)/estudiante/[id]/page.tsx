'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Seccion } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { EditarDatosEstudiante } from '@/components/ui/EditarDatosEstudiante'
import { BotonRestablecerPassword } from '@/components/ui/BotonRestablecerPassword'
import { Aviso } from '@/components/ui/Aviso'

/**
 * A pedido explícito del coordinador (transcripción de audio,
 * docs/19_PLAN_CAMBIOS_POST_DIRECTIVA.md): ventas también puede corregir
 * los datos de un estudiante que inscribió — no solo administración. La
 * RLS (migración 075) solo deja ver y editar aquí a quien el vendedor
 * mismo inscribió (`enrolled_by = auth.uid()`); un vendedor que intente
 * abrir el id de un estudiante ajeno simplemente no encuentra la fila.
 */

interface Ficha {
  nombre: string
  cedula: string
  correo: string
  telefono: string | null
  cohorteId: string | null
  cohorteNombre: string | null
}

export default function FichaEstudianteVendedor() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [ficha, setFicha] = useState<Ficha | null>(null)
  const [cohortes, setCohortes] = useState<{ id: string; name: string }[]>([])
  const [nuevaCohorte, setNuevaCohorte] = useState('')
  const [cargando, setCargando] = useState(true)
  const [noEncontrado, setNoEncontrado] = useState(false)
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
          .from('students')
          .select('cohort_id, profiles!students_id_fkey(full_name, cedula, contact_email, phone), cohorts(name)')
          .eq('id', id)
          .maybeSingle(),
        supabase.from('cohorts').select('id, name').eq('status', 'activa'),
      ])

      const fila = est as unknown as {
        cohort_id: string | null
        profiles: { full_name: string; cedula: string; contact_email: string | null; phone: string | null } | null
        cohorts: { name: string } | null
      } | null

      if (!fila || !fila.profiles) {
        setNoEncontrado(true)
        setCargando(false)
        return
      }

      setFicha({
        nombre: fila.profiles.full_name,
        cedula: fila.profiles.cedula,
        correo: fila.profiles.contact_email ?? '',
        telefono: fila.profiles.phone,
        cohorteId: fila.cohort_id,
        cohorteNombre: fila.cohorts?.name ?? null,
      })
      setNuevaCohorte(fila.cohort_id ?? '')
      setCohortes(cohs ?? [])
      setCargando(false)
    }

    cargar()
  }, [id, router])

  async function guardarCohorte() {
    setGuardando(true)
    setMensaje(null)

    const { error } = await createClient()
      .from('students')
      .update({ cohort_id: nuevaCohorte || null })
      .eq('id', id)

    if (error) {
      setMensaje('No se pudo cambiar el programa.')
    } else {
      const nombreNuevo = cohortes.find((c) => c.id === nuevaCohorte)?.name ?? null
      setFicha((f) => (f ? { ...f, cohorteId: nuevaCohorte || null, cohorteNombre: nombreNuevo } : f))
      setMensaje('Programa actualizado.')
    }
    setGuardando(false)
  }

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando…</p>
      </div>
    )
  }

  if (noEncontrado || !ficha) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-zr-bg px-5">
        <div className="zr-card max-w-sm p-8 text-center">
          <p className="text-base font-semibold text-zr-text">No encontrado</p>
          <p className="mt-2 text-sm text-zr-text-muted">
            Solo puedes ver la ficha de estudiantes que tú mismo inscribiste.
          </p>
        </div>
        <BotonVolver href="/mis-inscripciones" />
      </div>
    )
  }

  return (
    <div className="space-y-11 px-5 pt-14 pb-10">
      <BotonVolver href="/mis-inscripciones" />
      <Encabezado sobretitulo="Ventas · Estudiante" titulo={ficha.nombre} />
      <Regla delay={60} />

      <Seccion numero={1} titulo="Datos" delay={100}>
        <div className="zr-card divide-y divide-zr-border">
          <Fila etiqueta="Cédula" valor={ficha.cedula} mono />
          <Fila etiqueta="Correo de contacto" valor={ficha.correo || '—'} />
          <Fila etiqueta="Teléfono" valor={ficha.telefono ?? '—'} />
        </div>
        <EditarDatosEstudiante
          estudianteId={id}
          nombreInicial={ficha.nombre}
          correoInicial={ficha.correo}
          telefonoInicial={ficha.telefono}
          onGuardado={(d) => setFicha((f) => (f ? { ...f, nombre: d.nombre, correo: d.correo, telefono: d.telefono || null } : f))}
        />
        <BotonRestablecerPassword estudianteId={id} />
      </Seccion>

      <Seccion numero={2} titulo="Programa" delay={160}>
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
            <Aviso tipo={mensaje.includes('actualizado') ? 'exito' : 'error'}>{mensaje}</Aviso>
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

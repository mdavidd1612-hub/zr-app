'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Etiqueta } from '@/components/ui/Editorial'
import { EstadoVacio } from '@/components/ui/EstadoVacio'
import type { UserRole } from '@/lib/types'

/**
 * T-113 · Lista de estudiantes.
 *
 * spec/04 §5 pide tabla con columnas fijas; en 375px de ancho una tabla no
 * cabe sin scroll horizontal, así que se vuelve tarjeta — misma información,
 * layout que sí funciona con el pulgar.
 */

interface Estudiante {
  id: string
  nombre: string
  cedula: string
  edad: number
  cohorte: string | null
  cohorteId: string | null
  estado: string
  esMenor: boolean
  validado: boolean
}

type Filtro = 'todos' | 'pendientes' | 'menores' | 'sin_cohorte' | 'suspendidos'

export default function Estudiantes() {
  const router = useRouter()
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [cargando, setCargando] = useState(true)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [miRol, setMiRol] = useState<UserRole | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true

    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (vigente) setMiRol((perfil?.role as UserRole) ?? null)

      // Ordenado por cohorte y luego por nombre — Fase 0
      // (docs/15_FASE0_PLAN_ADMIN.md, Sprint B). Postgrest ordena nulls al
      // final por defecto, así que "Sin cohorte" queda agrupado al final.
      const { data } = await supabase
        .from('v_students')
        .select('id, full_name, cedula, cohort_id, status, age_years, is_minor, validated_at, cohorts(name)')
        .order('cohort_id', { nullsFirst: false })
        .order('full_name')

      if (!vigente) return

      const filas = data as unknown as {
        id: string; full_name: string; cedula: string; cohort_id: string | null
        status: string; age_years: number; is_minor: boolean; validated_at: string | null
        cohorts: { name: string } | null
      }[] | null

      setEstudiantes(
        (filas ?? []).map((e) => ({
          id: e.id,
          nombre: e.full_name,
          cedula: e.cedula,
          edad: e.age_years,
          cohorte: e.cohorts?.name ?? null,
          cohorteId: e.cohort_id,
          estado: e.status,
          esMenor: e.is_minor,
          validado: Boolean(e.validated_at),
        })),
      )
      setCargando(false)
    }

    cargar()
    return () => { vigente = false }
  }, [router])

  async function suspender(id: string, estadoActual: string) {
    setOcupado(id)
    const nuevoEstado = estadoActual === 'suspendido' ? 'activo' : 'suspendido'
    const { error } = await createClient().from('profiles').update({ status: nuevoEstado }).eq('id', id)
    if (!error) {
      setEstudiantes((es) => es.map((e) => (e.id === id ? { ...e, estado: nuevoEstado } : e)))
    }
    setOcupado(null)
  }

  async function eliminar(id: string, nombre: string) {
    if (!confirm(`¿Borrar la cuenta de ${nombre}? Esto no se puede deshacer.`)) return
    setOcupado(id)
    setError(null)

    const { error: fallo } = await createClient().functions.invoke('delete-account', {
      body: { profileId: id },
    })

    if (fallo) {
      const contexto = (fallo as { context?: { json?: () => Promise<unknown> } }).context
      if (contexto?.json) {
        const cuerpo = (await contexto.json()) as { error?: { message: string } }
        setError(cuerpo.error?.message ?? 'No se pudo borrar la cuenta.')
      } else {
        setError('No se pudo borrar la cuenta. Revisa tu conexión.')
      }
      setOcupado(null)
      return
    }

    setEstudiantes((es) => es.filter((e) => e.id !== id))
    setOcupado(null)
  }

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando estudiantes…</p>
      </div>
    )
  }

  const texto = busqueda.trim().toLowerCase()
  const filtrados = estudiantes.filter((e) => {
    if (texto && !e.nombre.toLowerCase().includes(texto) && !e.cedula.toLowerCase().includes(texto)) {
      return false
    }
    if (filtro === 'pendientes') return !e.validado
    if (filtro === 'menores') return e.esMenor
    if (filtro === 'sin_cohorte') return !e.cohorteId
    if (filtro === 'suspendidos') return e.estado === 'suspendido'
    return true
  })

  const FILTROS: { valor: Filtro; texto: string }[] = [
    { valor: 'todos', texto: 'Todos' },
    { valor: 'pendientes', texto: 'Pendientes de validar' },
    { valor: 'menores', texto: 'Menores' },
    { valor: 'sin_cohorte', texto: 'Sin programa' },
    { valor: 'suspendidos', texto: 'Suspendidos' },
  ]

  return (
    <div className="space-y-11 px-5 pt-14">
      <Encabezado
        sobretitulo="Administración"
        titulo="Estudiantes"
        descripcion={`${estudiantes.length} registrados`}
        accion={
          miRol !== 'direccion_academica' ? (
            <button
              onClick={() => router.push('/estudiantes/nuevo')}
              className="rounded-lg bg-zr-blue px-5 py-3.5 text-sm font-bold text-white transition-colors active:bg-zr-blue-deep"
            >
              + Nuevo
            </button>
          ) : undefined
        }
      />

      <Regla delay={60} />

      {error && (
        <p className="rounded-lg border border-zr-error/30 bg-zr-error/12 px-4 py-3 text-sm font-medium text-zr-error">
          {error}
        </p>
      )}

      {/* Buscador */}
      <input
        type="text"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por nombre o cédula…"
        className="w-full rounded-lg border border-zr-border bg-zr-surface px-5 py-3.5 text-base text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
      />

      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto pb-1 zr-scroll-x">
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            onClick={() => setFiltro(f.valor)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
              filtro === f.valor
                ? 'border-zr-blue bg-zr-blue/15 text-zr-blue'
                : 'border-zr-border text-zr-text-muted'
            }`}
          >
            {f.texto}
          </button>
        ))}
      </div>

      {filtrados.length === 0 ? (
        <EstadoVacio
          titulo="Sin resultados"
          explicacion={
            estudiantes.length === 0
              ? 'No hay estudiantes registrados todavía.'
              : 'Ningún estudiante coincide con la búsqueda o el filtro.'
          }
        />
      ) : (
        <div className="space-y-3">
          {filtrados.map((e, i) => {
            const cambioDeCohorte = i === 0 || filtrados[i - 1].cohorteId !== e.cohorteId
            return (
              <div key={e.id}>
                {cambioDeCohorte && (
                  <p className="mb-3 mt-6 text-xs font-bold uppercase tracking-wider text-zr-blue-mid first:mt-0">
                    {e.cohorte ?? 'Sin programa'}
                  </p>
                )}
                <div className="zr-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-zr-text">{e.nombre}</p>
                      <p className="mt-1 text-sm tabular-nums text-zr-text-muted">{e.cedula}</p>
                      <p className="mt-0.5 text-sm text-zr-text-muted">
                        {e.edad} años · {e.cohorte ?? 'Sin programa'}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      {!e.validado && <Etiqueta tono="aviso">Pendiente de validar</Etiqueta>}
                      {e.estado === 'suspendido' && <Etiqueta tono="error">Suspendido</Etiqueta>}
                      {e.esMenor && <Etiqueta tono="info">Menor de edad</Etiqueta>}
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2 border-t border-zr-border/60 pt-4">
                    <button
                      onClick={() => router.push(`/estudiantes/${e.id}`)}
                      className="flex-1 rounded-lg border border-zr-border px-3 py-2.5 text-sm font-semibold text-zr-text"
                    >
                      Ver
                    </button>
                    <button
                      onClick={() => suspender(e.id, e.estado)}
                      disabled={ocupado === e.id}
                      className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-semibold disabled:opacity-50 ${
                        e.estado === 'suspendido'
                          ? 'border-zr-success/30 bg-zr-success/10 text-zr-success'
                          : 'border-zr-error/30 bg-zr-error/10 text-zr-error'
                      }`}
                    >
                      {ocupado === e.id ? '…' : e.estado === 'suspendido' ? 'Reactivar' : 'Suspender'}
                    </button>
                    {(miRol === 'super_admin' || miRol === 'admin' || miRol === 'direccion_academica') && (
                      <button
                        onClick={() => eliminar(e.id, e.nombre)}
                        disabled={ocupado === e.id}
                        className="rounded-lg border border-zr-error/40 px-3 py-2.5 text-sm font-semibold text-zr-error disabled:opacity-50"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Etiqueta } from '@/components/ui/Editorial'
import { EstadoVacio } from '@/components/ui/EstadoVacio'
import { descargarPlanillasDelPrograma } from '@/lib/planilla-pdf-bulk'
import { descargarTablaDelPrograma } from '@/lib/estudiantes-tabla'
import { CAMPOS_TODOS, esPlanillaCompleta, type CamposPlanilla } from '@/lib/planilla-campos'
import { SelectorCampos } from '@/components/planilla/SelectorCampos'
import { IconoCerrar } from '@/components/ui/Iconos'
import type { UserRole } from '@/lib/types'
import { PantallaEsqueleto } from '@/components/ui/Esqueleto'

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

interface GrupoCohorte {
  cohorteId: string | null
  cohorte: string | null
  estudiantes: Estudiante[]
}

// La lista ya llega ordenada por cohort_id desde la consulta — esto solo
// junta los estudiantes consecutivos de la misma cohorte en un grupo, para
// poder poner "Descargar todas las planillas" al final de cada uno.
function agruparPorCohorte(estudiantes: Estudiante[]): GrupoCohorte[] {
  const grupos: GrupoCohorte[] = []
  for (const e of estudiantes) {
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.cohorteId === e.cohorteId) {
      ultimo.estudiantes.push(e)
    } else {
      grupos.push({ cohorteId: e.cohorteId, cohorte: e.cohorte, estudiantes: [e] })
    }
  }
  return grupos
}

export default function Estudiantes() {
  const router = useRouter()
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [cargando, setCargando] = useState(true)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [miRol, setMiRol] = useState<UserRole | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Descarga masiva de planillas por programa (pedido explícito del
  // coordinador): guarda cuál cohorte está generando y cuántas lleva, para
  // mostrar el progreso — con 19 estudiantes puede tardar unos segundos.
  const [descargando, setDescargando] = useState<{ cohorteId: string; hecho: number; total: number } | null>(null)
  // Antes de bajar el .zip de planillas, Dirección elige qué campos salen
  // impresos (pedido nov. 2026). El modal guarda de cuál programa es la
  // descarga pendiente; `campos` arranca con todo marcado.
  const [modalDescarga, setModalDescarga] = useState<{ cohorteId: string; nombre: string; grupo: Estudiante[] } | null>(null)
  const [campos, setCampos] = useState<CamposPlanilla>(CAMPOS_TODOS)
  // Formato de descarga: planilla en PDF (una por estudiante, en .zip) o
  // tabla en Excel (un archivo, una fila por estudiante, columnas = campos
  // marcados). Pedido de Dirección Académica + Pedro (nov. 2026).
  const [formato, setFormato] = useState<'pdf' | 'excel'>('pdf')

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

  async function ejecutarDescarga(cohorteId: string, nombreCohorte: string, grupo: Estudiante[]) {
    setError(null)
    setModalDescarga(null)
    setDescargando({ cohorteId, hecho: 0, total: grupo.length })
    const progreso = (hecho: number, total: number) => setDescargando({ cohorteId, hecho, total })

    const { generadas, fallidas } = formato === 'excel'
      ? await descargarTablaDelPrograma(
          grupo.map((e) => ({ id: e.id, nombre: e.nombre })),
          nombreCohorte,
          campos,
          progreso,
        )
      : await descargarPlanillasDelPrograma(
          grupo.map((e) => ({ id: e.id, nombre: e.nombre, cedula: e.cedula })),
          nombreCohorte,
          progreso,
          campos,
        )

    setDescargando(null)
    if (fallidas.length > 0) {
      setError(
        `Se descargaron ${generadas} de ${grupo.length}. No se pudo con: ${fallidas.join(', ')}.`,
      )
    }
  }

  if (cargando) {
    return (
      <PantallaEsqueleto />
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
          <div className="flex gap-2">
            {/* Solo super_admin (pedido explícito del coordinador, sept.
                2026): quién ya aceptó términos y completó /completar-perfil,
                para diagnosticar cuántos quedaron atascados por el bug de
                scroll en Android. */}
            {miRol === 'super_admin' && (
              <button
                onClick={() => router.push('/estudiantes/estadisticas')}
                className="rounded-lg border border-zr-blue/40 px-5 py-3.5 text-sm font-bold text-zr-blue-mid transition-colors"
              >
                Ver estadísticas
              </button>
            )}
            {/* Reafirmado explícitamente por el coordinador: Dirección
                Académica también crea/modifica estudiantes, igual que admin y
                super_admin — antes se escondía el botón aquí sin que hubiera
                ninguna razón real (la pantalla de creación nunca la bloqueó). */}
            <button
              onClick={() => router.push('/estudiantes/nuevo')}
              className="rounded-lg bg-zr-blue px-5 py-3.5 text-sm font-bold text-white transition-colors active:bg-zr-blue-deep"
            >
              + Nuevo
            </button>
          </div>
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
        <div className="space-y-8">
          {agruparPorCohorte(filtrados).map((grupo) => (
            <div key={grupo.cohorteId ?? 'sin-programa'}>
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-zr-blue-mid">
                {grupo.cohorte ?? 'Sin programa'}
              </p>

              <div className="space-y-3">
                {grupo.estudiantes.map((e) => (
                  <div key={e.id} className="zr-card p-5">
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
                ))}
              </div>

              {/* Descarga masiva (pedido explícito del coordinador): antes
                  había que entrar estudiante por estudiante y descargar la
                  planilla una por una. */}
              {grupo.cohorteId && (
                <button
                  onClick={() => setModalDescarga({
                    cohorteId: grupo.cohorteId as string,
                    nombre: grupo.cohorte ?? 'programa',
                    grupo: grupo.estudiantes,
                  })}
                  disabled={descargando?.cohorteId === grupo.cohorteId}
                  className="mt-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-lg border border-zr-blue/30 bg-zr-blue/10 text-sm font-bold text-zr-blue disabled:opacity-60"
                >
                  {descargando?.cohorteId === grupo.cohorteId
                    ? `Generando… ${descargando.hecho} de ${descargando.total}`
                    : `📥 Descargar estudiantes (${grupo.estudiantes.length})`}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Checklist de campos antes de bajar el .zip (pedido de Dirección
          Académica): por defecto todo marcado; se quita lo que no se quiera
          imprimir. La misma selección se aplica a todas las planillas del lote. */}
      {modalDescarga && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6"
          onClick={() => setModalDescarga(null)}
        >
          <div
            className="flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-zr-surface sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-zr-border px-5 py-4">
              <div>
                <p className="text-base font-bold text-zr-text">Descargar estudiantes</p>
                <p className="mt-0.5 text-sm text-zr-text-muted">
                  {modalDescarga.nombre} · {modalDescarga.grupo.length} estudiantes
                </p>
              </div>
              <button
                onClick={() => setModalDescarga(null)}
                aria-label="Cerrar"
                className="shrink-0 rounded-lg p-1.5 text-zr-text-muted transition-colors hover:text-zr-text"
              >
                <IconoCerrar size={20} />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4 zr-scroll">
              {/* Formato: planilla (PDF) o tabla (Excel). */}
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-zr-blue-mid">Formato</p>
                <div className="grid grid-cols-2 gap-2">
                  {([['pdf', '📄 Planilla (PDF)'], ['excel', '📊 Tabla (Excel)']] as const).map(([valor, texto]) => (
                    <button
                      key={valor}
                      type="button"
                      onClick={() => setFormato(valor)}
                      aria-pressed={formato === valor}
                      className={`rounded-lg border px-3 py-3 text-sm font-bold transition-colors ${
                        formato === valor
                          ? 'border-zr-blue bg-zr-blue/15 text-zr-blue'
                          : 'border-zr-border text-zr-text-muted'
                      }`}
                    >
                      {texto}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-zr-text-muted">
                  {formato === 'excel'
                    ? 'Un archivo de Excel: una fila por estudiante, una columna por cada campo marcado.'
                    : esPlanillaCompleta(campos)
                      ? 'Planilla de inscripción completa (con políticas y firma), una por estudiante en un .zip.'
                      : 'Como quitaste campos, el PDF sale como resumen de datos — sin la página de políticas ni la firma.'}
                </p>
              </div>

              <SelectorCampos campos={campos} onCambiar={setCampos} />
            </div>

            <div className="border-t border-zr-border px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <button
                onClick={() => ejecutarDescarga(modalDescarga.cohorteId, modalDescarga.nombre, modalDescarga.grupo)}
                disabled={!Object.values(campos).some(Boolean)}
                className="min-h-14 w-full rounded-lg bg-zr-blue text-base font-bold text-white active:bg-zr-blue-deep disabled:opacity-50"
              >
                {!Object.values(campos).some(Boolean)
                  ? 'Marca al menos un campo'
                  : formato === 'excel'
                    ? `📊 Descargar tabla (${modalDescarga.grupo.length})`
                    : `📄 Descargar ${modalDescarga.grupo.length} ${esPlanillaCompleta(campos) ? 'planillas' : 'PDF'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

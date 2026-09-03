'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Seccion } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { EtiquetaSede } from '@/components/ui/EtiquetaSede'

/**
 * R-20 y R-21 · docs/19_PLAN_CAMBIOS_POST_DIRECTIVA.md
 *
 * Segunda corrección de terminología del 2 de septiembre de 2026, después de
 * que el cliente explicó el modelo completo:
 *
 * - "Programa" es el curso de 18 meses con los 14 módulos — lo que el código
 *   llama `cohorts` (ej. PTMA-2026-II). Es lo que se lista aquí abajo, igual
 *   que en el perfil de ventas.
 * - "PTMA" y "PFTA" no son un tercer concepto aparte ("plan de estudio"):
 *   son, literalmente, la sede. "PTMA es de La Morita, PFTA es de la UCV —
 *   son agrupaciones o nombres de los programas por sede." Cada sede tiene
 *   su propia sigla, y esa sigla ES el programa que se dicta ahí.
 *
 * Por eso crear una sede y crear su currículo (la tabla `programs`, con su
 * sigla y sus 14 módulos) pasan a ser LA MISMA acción — "+ Nueva sede" pide
 * también la sigla y el nombre del programa, y `crear_sede_con_programa()`
 * (migración 070) los crea juntos en una sola transacción, copiando el
 * currículo de 14 módulos de un programa existente (todos comparten el
 * mismo contenido hoy). Ya no existe un formulario "Plan de estudio nuevo"
 * aparte: no hay caso, en el modelo del cliente, de una sede sin programa ni
 * de un programa sin sede.
 */

interface ProgramaReal {
  id: string
  name: string
  sede: string | null
  turno: string | null
  estado: 'activa' | 'finalizada' | 'suspendida'
}

interface GrupoPorSede {
  id: string
  name: string
  siglas: string
  programas: ProgramaReal[]
}

interface Sede {
  id: string
  nombre: string
  activa: boolean
}

const SIGLAS_RX = /^[A-Z]{3,5}$/

export default function Catalogo() {
  const router = useRouter()
  const [esSuper, setEsSuper] = useState<boolean | null>(null)
  const [grupos, setGrupos] = useState<GrupoPorSede[]>([])
  const [sedes, setSedes] = useState<Sede[]>([])
  const [cargando, setCargando] = useState(true)
  const [version, setVersion] = useState(0)

  const [creandoSede, setCreandoSede] = useState(false)
  const [nombreSede, setNombreSede] = useState('')
  const [siglas, setSiglas] = useState('')
  const [nombrePrograma, setNombrePrograma] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

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

      const esSuperAdmin = perfil?.role === 'super_admin'
      setEsSuper(esSuperAdmin)
      if (!esSuperAdmin) {
        setCargando(false)
        return
      }

      const [{ data: progs }, { data: seds }] = await Promise.all([
        supabase
          .from('programs')
          .select('id, name, siglas, cohorts(id, name, sede, turno, status)')
          .order('name'),
        supabase.from('sedes').select('id, nombre, activa').order('nombre'),
      ])

      const filas = (progs ?? []) as unknown as {
        id: string; name: string; siglas: string
        cohorts: { id: string; name: string; sede: string | null; turno: string | null; status: 'activa' | 'finalizada' | 'suspendida' }[]
      }[]

      setGrupos(filas.map((p) => ({
        id: p.id,
        name: p.name,
        siglas: p.siglas,
        programas: [...p.cohorts]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((c) => ({ id: c.id, name: c.name, sede: c.sede, turno: c.turno, estado: c.status })),
      })))
      setSedes(seds ?? [])
      setCargando(false)
    }

    cargar()
    return () => { vigente = false }
  }, [router, version])

  function mensajeDeError(codigo?: string, texto?: string) {
    if (codigo === '23505') return 'Ya existe una sede o un programa con ese nombre o esas siglas.'
    return texto ?? 'No se pudo guardar. Revisa tu conexión.'
  }

  async function crearSede() {
    setGuardando(true); setError(null); setAviso(null)

    const { error: fallo } = await createClient().rpc('crear_sede_con_programa', {
      p_nombre_sede: nombreSede.trim(),
      p_siglas: siglas.trim().toUpperCase(),
      p_nombre_programa: nombrePrograma.trim(),
    })

    if (fallo) {
      setError(mensajeDeError(fallo.code, fallo.message))
      setGuardando(false)
      return
    }

    setAviso(
      `Sede "${nombreSede.trim()}" creada, con su programa ${siglas.trim().toUpperCase()} ` +
      `("${nombrePrograma.trim()}"). Ya puedes abrir programas de ahí desde el perfil de ventas.`,
    )
    setNombreSede(''); setSiglas(''); setNombrePrograma(''); setCreandoSede(false)
    setGuardando(false)
    setVersion((v) => v + 1)
  }

  async function alternarSede(s: Sede) {
    await createClient().from('sedes').update({ activa: !s.activa }).eq('id', s.id)
    setVersion((v) => v + 1)
  }

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando…</p>
      </div>
    )
  }

  if (esSuper === false) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-zr-bg px-5">
        <div className="zr-card max-w-sm p-8 text-center">
          <p className="text-base font-semibold text-zr-text">Solo super_admin</p>
          <p className="mt-2 text-sm text-zr-text-muted">
            Una sede nueva cambia el código de carnet de toda la academia. Solo super_admin
            puede crearlas.
          </p>
        </div>
        <BotonVolver href="/panel" />
      </div>
    )
  }

  const siglasValidas = SIGLAS_RX.test(siglas.trim().toUpperCase())
  const sedeCompleta = Boolean(nombreSede.trim() && siglasValidas && nombrePrograma.trim())

  return (
    <div className="space-y-11 px-5 pt-14 pb-10">
      <BotonVolver href="/panel" />
      <Encabezado sobretitulo="Super admin" titulo="Catálogo de programas" descripcion="Todos los programas de la academia, con sus sedes" />
      <Regla delay={60} />

      {aviso && (
        <p className="rounded-lg border border-zr-success/30 bg-zr-success/12 px-4 py-3 text-sm font-medium text-zr-success">
          {aviso}
        </p>
      )}

      {grupos.map((grupo, i) => (
        <Seccion key={grupo.id} numero={i + 1} titulo={grupo.name} delay={100 + i * 60}>
          <div className="space-y-3">
            {grupo.programas.length === 0 && (
              <p className="zr-card p-5 text-sm text-zr-text-muted">Todavía no hay ningún programa de {grupo.siglas}.</p>
            )}
            {grupo.programas.map((p) => (
              <div key={p.id} className="zr-card flex items-center justify-between gap-4 p-5">
                <div className="min-w-0 space-y-2">
                  <p className="truncate text-sm font-semibold text-zr-text">{p.name}</p>
                  <EtiquetaSede sede={p.sede} turno={p.turno} />
                </div>
                {p.estado !== 'activa' && (
                  <span className="shrink-0 rounded-full border border-zr-border bg-zr-bg px-2.5 py-1 text-[11px] font-bold text-zr-text-muted">
                    {p.estado === 'finalizada' ? 'Terminado' : 'Suspendido'}
                  </span>
                )}
              </div>
            ))}
          </div>
        </Seccion>
      ))}

      <Seccion numero={grupos.length + 1} titulo="Sedes" delay={100 + grupos.length * 60}>
        <div className="space-y-3">
          {sedes.map((s) => (
            <div key={s.id} className="zr-card flex items-center justify-between gap-4 p-5">
              <p className="text-sm font-semibold text-zr-text">{s.nombre}</p>
              <button
                onClick={() => alternarSede(s)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold ${
                  s.activa
                    ? 'border-zr-success/40 bg-zr-success/15 text-zr-success'
                    : 'border-zr-border text-zr-text-muted'
                }`}
              >
                {s.activa ? 'Activa' : 'Inactiva'}
              </button>
            </div>
          ))}

          {creandoSede ? (
            <div className="zr-card space-y-4 p-5">
              <p className="text-sm font-bold text-zr-text">+ Nueva sede</p>
              <p className="text-xs text-zr-text-muted">
                Cada sede dicta su propio programa (los 14 módulos), como PTMA en La Morita o
                PFTA en la UCV. Al crear la sede, se crea también su programa.
              </p>
              <div>
                <label className="mb-2 block text-sm font-semibold text-zr-text">Nombre de la sede</label>
                <input
                  value={nombreSede}
                  onChange={(e) => setNombreSede(e.target.value)}
                  placeholder="San Antonio de Los Altos"
                  className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-zr-text">Siglas de su programa</label>
                <input
                  value={siglas}
                  onChange={(e) => setSiglas(e.target.value.toUpperCase())}
                  placeholder="PTRE"
                  maxLength={5}
                  className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base uppercase text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
                />
                <p className="mt-1.5 text-xs text-zr-text-muted">
                  3 a 5 letras mayúsculas. Es el prefijo del carnet de los estudiantes de esta
                  sede — no se puede cambiar después de que alguien se inscriba.
                </p>
                {siglas.trim() && !siglasValidas && (
                  <p className="mt-1.5 text-xs text-zr-warning">Deben ser solo letras, 3 a 5.</p>
                )}
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-zr-text">Nombre del programa</label>
                <input
                  value={nombrePrograma}
                  onChange={(e) => setNombrePrograma(e.target.value)}
                  placeholder="Programa Técnico en Refrigeración"
                  className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
                />
              </div>
              {error && <p className="text-sm font-medium text-zr-error">{error}</p>}
              <div className="flex gap-3">
                <button
                  onClick={() => setCreandoSede(false)}
                  className="min-h-14 flex-1 rounded-lg border border-zr-border text-base font-semibold text-zr-text"
                >
                  Cancelar
                </button>
                <button
                  onClick={crearSede}
                  disabled={!sedeCompleta || guardando}
                  className="min-h-14 flex-1 rounded-lg bg-zr-blue text-base font-bold text-white disabled:opacity-40"
                >
                  {guardando ? 'Creando…' : 'Crear sede'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setCreandoSede(true)}
              className="zr-card zr-card-interactive flex min-h-14 w-full items-center justify-center px-6 text-sm font-bold text-zr-blue"
            >
              + Nueva sede
            </button>
          )}
        </div>
      </Seccion>
    </div>
  )
}

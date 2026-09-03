'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Seccion } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'

/**
 * R-20 y R-21 · docs/19_PLAN_CAMBIOS_POST_DIRECTIVA.md
 *
 * Catálogo de referencia de la academia: programas y sedes. Los dos son
 * datos de los que depende el código de carnet (el prefijo sale del programa,
 * la sede es la etiqueta que evita confundir dos cortes iguales) y por eso
 * son exclusivos de super_admin — ni siquiera Dirección Académica los toca
 * (migración 066, RLS "super: escribir programas" / "super: gestionar
 * sedes"). Esta pantalla es el único lugar de la app donde se crean.
 *
 * Las siglas alimentan directamente `set_student_code_calc()` (migración
 * 067): antes de esa migración, cualquier programa que no se llamara "PTMA…"
 * caía en silencio al prefijo "PFTA". La validación de aquí (3-5 letras
 * mayúsculas, únicas) es la misma que exige la base — se repite en el
 * cliente solo para avisar antes de enviar, nunca para decidir.
 */

interface Programa {
  id: string
  name: string
  siglas: string
  totalModules: number
  totalDurationMonths: number
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
  const [programas, setProgramas] = useState<Programa[]>([])
  const [sedes, setSedes] = useState<Sede[]>([])
  const [cargando, setCargando] = useState(true)
  const [version, setVersion] = useState(0)

  const [nombrePrograma, setNombrePrograma] = useState('')
  const [siglas, setSiglas] = useState('')
  const [totalModulos, setTotalModulos] = useState('14')
  const [totalMeses, setTotalMeses] = useState('13')
  const [guardandoPrograma, setGuardandoPrograma] = useState(false)
  const [errorPrograma, setErrorPrograma] = useState<string | null>(null)
  const [avisoPrograma, setAvisoPrograma] = useState<string | null>(null)

  const [nombreSede, setNombreSede] = useState('')
  const [guardandoSede, setGuardandoSede] = useState(false)
  const [errorSede, setErrorSede] = useState<string | null>(null)

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
        supabase.from('programs').select('id, name, siglas, total_modules, total_duration_months').order('name'),
        supabase.from('sedes').select('id, nombre, activa').order('nombre'),
      ])

      setProgramas((progs ?? []).map((p) => ({
        id: p.id, name: p.name, siglas: p.siglas,
        totalModules: p.total_modules, totalDurationMonths: p.total_duration_months,
      })))
      setSedes(seds ?? [])
      setCargando(false)
    }

    cargar()
    return () => { vigente = false }
  }, [router, version])

  function mensajeDeError(codigo?: string, texto?: string) {
    if (codigo === '23505') return 'Ya existe un programa o una sede con ese nombre o esas siglas.'
    return texto ?? 'No se pudo guardar. Revisa tu conexión.'
  }

  async function crearPrograma() {
    setGuardandoPrograma(true); setErrorPrograma(null); setAvisoPrograma(null)

    const { error: fallo } = await createClient().from('programs').insert({
      name: nombrePrograma.trim(),
      siglas: siglas.trim().toUpperCase(),
      total_modules: Number(totalModulos) || 14,
      total_duration_months: Number(totalMeses) || 13,
    })

    if (fallo) {
      setErrorPrograma(mensajeDeError(fallo.code, fallo.message))
      setGuardandoPrograma(false)
      return
    }

    setAvisoPrograma(`Programa "${nombrePrograma.trim()}" creado con siglas ${siglas.trim().toUpperCase()}.`)
    setNombrePrograma(''); setSiglas(''); setTotalModulos('14'); setTotalMeses('13')
    setGuardandoPrograma(false)
    setVersion((v) => v + 1)
  }

  async function crearSede() {
    setGuardandoSede(true); setErrorSede(null)

    const { error: fallo } = await createClient().from('sedes').insert({ nombre: nombreSede.trim() })

    if (fallo) {
      setErrorSede(mensajeDeError(fallo.code, fallo.message))
      setGuardandoSede(false)
      return
    }

    setNombreSede('')
    setGuardandoSede(false)
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
            Un programa nuevo o una sede nueva cambian el código de carnet de toda la academia.
            Solo super_admin puede crearlos.
          </p>
        </div>
        <BotonVolver href="/panel" />
      </div>
    )
  }

  const siglasValidas = SIGLAS_RX.test(siglas.trim().toUpperCase())
  const programaCompleto = Boolean(nombrePrograma.trim() && siglasValidas)

  return (
    <div className="space-y-11 px-5 pt-14 pb-10">
      <BotonVolver href="/panel" />
      <Encabezado sobretitulo="Super admin" titulo="Catálogo" descripcion="Programas y sedes de toda la academia" />
      <Regla delay={60} />

      <Seccion numero={1} titulo="Programas" delay={100}>
        <div className="space-y-3">
          {programas.map((p) => (
            <div key={p.id} className="zr-card flex items-center justify-between gap-4 p-5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-zr-text">{p.name}</p>
                <p className="mt-0.5 text-xs text-zr-text-muted">
                  {p.totalModules} módulos · {p.totalDurationMonths} meses
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-zr-blue-mid/40 bg-zr-blue/20 px-2.5 py-1 text-[11px] font-bold text-zr-blue-light">
                {p.siglas}
              </span>
            </div>
          ))}

          <div className="zr-card space-y-4 p-5">
            <p className="text-sm font-bold text-zr-text">+ Nuevo programa</p>
            {avisoPrograma && (
              <p className="rounded-lg border border-zr-success/30 bg-zr-success/12 px-4 py-3 text-sm font-medium text-zr-success">
                {avisoPrograma}
              </p>
            )}
            <div>
              <label className="mb-2 block text-sm font-semibold text-zr-text">Nombre</label>
              <input
                value={nombrePrograma}
                onChange={(e) => setNombrePrograma(e.target.value)}
                placeholder="Programa Técnico en Refrigeración"
                className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-zr-text">Siglas</label>
              <input
                value={siglas}
                onChange={(e) => setSiglas(e.target.value.toUpperCase())}
                placeholder="PTRE"
                maxLength={5}
                className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base uppercase text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
              />
              <p className="mt-1.5 text-xs text-zr-text-muted">
                3 a 5 letras mayúsculas. Es el prefijo del carnet de sus estudiantes — no se
                puede cambiar después de que alguien se inscriba.
              </p>
              {siglas.trim() && !siglasValidas && (
                <p className="mt-1.5 text-xs text-zr-warning">Deben ser solo letras, 3 a 5.</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-2 block text-sm font-semibold text-zr-text">Total de módulos</label>
                <input
                  type="number"
                  value={totalModulos}
                  onChange={(e) => setTotalModulos(e.target.value)}
                  className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-zr-text">Duración (meses)</label>
                <input
                  type="number"
                  value={totalMeses}
                  onChange={(e) => setTotalMeses(e.target.value)}
                  className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
                />
              </div>
            </div>
            {errorPrograma && <p className="text-sm font-medium text-zr-error">{errorPrograma}</p>}
            <button
              onClick={crearPrograma}
              disabled={!programaCompleto || guardandoPrograma}
              className="min-h-14 w-full rounded-lg bg-zr-blue text-base font-bold text-white disabled:opacity-40"
            >
              {guardandoPrograma ? 'Creando…' : 'Crear programa'}
            </button>
          </div>
        </div>
      </Seccion>

      <Seccion numero={2} titulo="Sedes" delay={160}>
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

          <div className="zr-card space-y-4 p-5">
            <p className="text-sm font-bold text-zr-text">+ Nueva sede</p>
            <input
              value={nombreSede}
              onChange={(e) => setNombreSede(e.target.value)}
              placeholder="Nombre de la sede"
              className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
            />
            {errorSede && <p className="text-sm font-medium text-zr-error">{errorSede}</p>}
            <button
              onClick={crearSede}
              disabled={!nombreSede.trim() || guardandoSede}
              className="min-h-14 w-full rounded-lg bg-zr-blue text-base font-bold text-white disabled:opacity-40"
            >
              {guardandoSede ? 'Creando…' : 'Crear sede'}
            </button>
          </div>
        </div>
      </Seccion>
    </div>
  )
}

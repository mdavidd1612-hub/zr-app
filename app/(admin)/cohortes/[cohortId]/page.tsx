'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Seccion, Etiqueta } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { PantallaEsqueleto } from '@/components/ui/Esqueleto'
import { CalendarioModulos } from '@/components/CalendarioModulos'
import { CoberturaCorte } from '@/components/CoberturaCorte'
import { SalonesCorte } from '@/components/SalonesCorte'
import { DatosCorte } from '@/components/DatosCorte'
import { IconoCalendario, IconoEstudiantes, IconoNotas } from '@/components/ui/Iconos'

/**
 * Ficha única de un corte (19-nov-2026, propuesta B del estudio de unificar
 * pantallas): antes, armar o ajustar un corte obligaba a pasar por Programas,
 * Cobertura, Salones y el calendario escondido en Configuración. Aquí está el
 * calendario de módulos (presencial y virtual en paralelo, migraciones 223/226)
 * y los accesos directos a lo demás de ESE corte.
 */
export default function FichaCorte() {
  const { cohortId } = useParams<{ cohortId: string }>()
  const router = useRouter()
  const [corte, setCorte] = useState<{ nombre: string; estado: string; modulo: string | null; estudiantes: number } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('cohorts').select('name, status, modules:current_module_id(name)').eq('id', cohortId).maybeSingle(),
      supabase.from('students').select('id', { count: 'exact', head: true }).eq('cohort_id', cohortId),
    ]).then(([{ data }, { count }]) => {
      if (!data) { router.replace('/cohortes'); return }
      const d = data as unknown as { name: string; status: string; modules: { name: string } | null }
      setCorte({ nombre: d.name, estado: d.status, modulo: d.modules?.name ?? null, estudiantes: count ?? 0 })
    })
  }, [cohortId, router])

  if (!corte) return <PantallaEsqueleto />

  const accesos = [
    { href: '/estudiantes', titulo: 'Estudiantes', sub: `${corte.estudiantes} en este corte`, Icono: IconoEstudiantes },
    { href: `/notas-academicas/${cohortId}`, titulo: 'Notas', sub: 'Calificaciones del corte', Icono: IconoNotas },
    { href: '/asistencias', titulo: 'Asistencia', sub: 'Sábado a sábado', Icono: IconoCalendario },
  ]

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-8 px-5 pb-28 pt-[calc(3.5rem+env(safe-area-inset-top))] lg:px-8">
      <BotonVolver href="/cohortes" />
      <Encabezado
        sobretitulo="Ficha del corte"
        titulo={corte.nombre}
        descripcion={corte.modulo ? `Ahora cursa: ${corte.modulo}` : 'Sin módulo actual'}
      />
      <div><Etiqueta tono={corte.estado === 'activa' ? 'exito' : 'neutro'}>{corte.estado}</Etiqueta></div>

      <Regla delay={40} />

      <DatosCorte cohorteId={cohortId} onGuardado={(nombre, estado) => setCorte((c) => (c ? { ...c, nombre, estado } : c))} />

      <Seccion numero={1} titulo="Ir a" delay={60}>
        <div className="grid gap-2 sm:grid-cols-3">
          {accesos.map(({ href, titulo, sub, Icono }) => (
            <button key={href} onClick={() => router.push(href)} className="zr-card flex items-center gap-3 p-4 text-left">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zr-blue/12 text-zr-blue-mid"><Icono size={20} /></span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-zr-text">{titulo}</span>
                <span className="block text-xs text-zr-text-muted">{sub}</span>
              </span>
            </button>
          ))}
        </div>
      </Seccion>


      <div className="grid items-start gap-8 xl:grid-cols-2">
        <div className="space-y-8">
          <Seccion numero={2} titulo="Salón de cada clase" delay={90}>
            <SalonesCorte cohorteId={cohortId} />
          </Seccion>
          <Seccion numero={3} titulo="Calendario de módulos" delay={110}>
            <CalendarioModulos cohorteFija={cohortId} />
          </Seccion>
        </div>

        <Seccion numero={4} titulo="Profesor de cada módulo" delay={130}>
          <CoberturaCorte cohorteId={cohortId} />
        </Seccion>
      </div>

    </div>
  )
}

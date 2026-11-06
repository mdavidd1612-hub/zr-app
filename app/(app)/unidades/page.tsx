'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Etiqueta } from '@/components/ui/Editorial'
import { Recorrido, Paso, type EstadoPaso } from '@/components/ui/Recorrido'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { PantallaEsqueleto } from '@/components/ui/Esqueleto'
import { IconoCalendario } from '@/components/ui/Iconos'

/**
 * Aula Virtual — las unidades del módulo como un recorrido, no una lista de
 * cuadros. RLS ya filtra: solo unidades 'abierta' o 'cerrada' de SU módulo
 * (migración 174); aquí solo se pide y se dibuja el camino.
 */

interface UnidadFila {
  id: string
  title: string
  effective_status: string
  prerequisite_met: boolean
}

export default function Unidades() {
  const router = useRouter()
  const [unidades, setUnidades] = useState<UnidadFila[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data } = await supabase
        .from('v_units_status')
        .select('id, title, effective_status, order_index, prerequisite_met')
        .order('order_index', { ascending: true })

      // Casteo: v_units_status gana la columna prerequisite_met en la
      // migración 185; los tipos generados se regeneran en el próximo barrido.
      setUnidades((data ?? []) as unknown as UnidadFila[])
      setCargando(false)
    }
    cargar()
  }, [router])

  if (cargando) return <PantallaEsqueleto variante="lista" />

  // "Dónde vas": la primera unidad abierta y no bloqueada se marca como activa
  // (nodo resaltado), para que el recorrido tenga un punto de atención claro.
  const indiceActiva = unidades.findIndex(
    (u) => u.effective_status === 'abierta' && u.prerequisite_met !== false,
  )

  return (
    <div className="min-h-dvh bg-zr-bg px-5 pb-28 pt-14">
      <div className="space-y-9">
        <BotonVolver href="/" />

        <Encabezado
          sobretitulo="Aula Virtual"
          titulo="Tu recorrido"
          descripcion="El material, los exámenes y las tareas de tu módulo, paso a paso."
          accion={
            <Link
              href="/calendario"
              className="inline-flex items-center gap-2 rounded-full border border-zr-border px-4 py-2.5 text-xs font-bold text-zr-text transition-colors hover:border-zr-blue/40"
            >
              <IconoCalendario size={16} />
              Calendario
            </Link>
          }
        />

        <Regla delay={60} />

        {unidades.length === 0 ? (
          <p className="text-sm text-zr-text-muted">
            Todavía no hay unidades abiertas para tu módulo. Cuando tu profesor publique una, aparece aquí sola.
          </p>
        ) : (
          <Recorrido>
            {unidades.map((u, i) => {
              const bloqueada = u.prerequisite_met === false
              const cerrada = u.effective_status === 'cerrada'
              const activa = i === indiceActiva

              const estado: EstadoPaso = bloqueada
                ? 'bloqueado'
                : activa
                  ? 'activo'
                  : 'disponible'

              const meta = bloqueada ? (
                <Etiqueta tono="neutro">Se abre al aprobar la unidad anterior</Etiqueta>
              ) : cerrada ? (
                <Etiqueta tono="neutro">Cerrada · repaso</Etiqueta>
              ) : activa ? (
                <Etiqueta tono="info">Vas aquí</Etiqueta>
              ) : (
                <Etiqueta tono="exito">Abierta</Etiqueta>
              )

              return (
                <Paso
                  key={u.id}
                  estado={estado}
                  indice={i + 1}
                  eyebrow={`Unidad ${i + 1}`}
                  titulo={u.title}
                  meta={meta}
                  href={bloqueada ? undefined : `/unidades/${u.id}`}
                  ultimo={i === unidades.length - 1}
                  delay={80 + i * 50}
                />
              )
            })}
          </Recorrido>
        )}
      </div>
    </div>
  )
}

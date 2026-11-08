'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Etiqueta } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { PantallaEsqueleto } from '@/components/ui/Esqueleto'
import { VisorMaterial } from '@/components/ui/VisorMaterial'
import { IconoExamen, IconoCheck } from '@/components/ui/Iconos'
import type { TipoMaterial } from '@/lib/material'

interface Material {
  title: string
  type: TipoMaterial
  storage_path: string
  description: string | null
  check_quiz_id: string | null
}

export default function MaterialDeUnidad() {
  const router = useRouter()
  const params = useParams()
  const itemId = params.itemId as string
  const unitId = params.unitId as string

  const [material, setMaterial] = useState<Material | null>(null)
  const [noDisponible, setNoDisponible] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [chequeoTitulo, setChequeoTitulo] = useState<string | null>(null)
  const [completado, setCompletado] = useState(false)
  const [validado, setValidado] = useState(false)
  const userIdRef = useRef<string | null>(null)

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }
      userIdRef.current = user.id

      const { data } = await supabase
        .from('content_items')
        .select('title, type, storage_path, description, check_quiz_id, check_quiz:exams!content_items_check_quiz_id_fkey(title)')
        .eq('id', itemId)
        .maybeSingle()

      if (!data?.storage_path) {
        // Bug real reportado en la reunión del 7-nov-2026: esto devolvía en
        // bucle a la unidad sin explicar nada (el material puede seguir
        // pendiente de aprobación, fuera de su ventana de fechas, o de otra
        // cohorte). Se avisa en vez de navegar a ciegas.
        setNoDisponible(true)
        setCargando(false)
        return
      }

      setMaterial(data as unknown as Material)
      setChequeoTitulo((data.check_quiz as unknown as { title: string } | null)?.title ?? null)

      if (data.check_quiz_id) {
        const { data: progreso } = await supabase
          .from('material_progress')
          .select('completed_at, validated')
          .eq('student_id', user.id)
          .eq('content_item_id', itemId)
          .maybeSingle()
        setCompletado(!!progreso?.completed_at)
        setValidado(!!progreso?.validated)
      }

      setCargando(false)
    }
    cargar()
  }, [itemId, router])

  // Mini-chequeo (migración 177, spec §6.3): VisorMaterial guarda el
  // progreso cada ~15s y al desmontar, pero no avisa a esta pantalla -- se
  // vota cada 5s si falta completar, solo cuando hay chequeo que mostrar.
  useEffect(() => {
    if (!material?.check_quiz_id || completado) return
    const id = setInterval(async () => {
      const userId = userIdRef.current
      if (!userId) return
      const supabase = createClient()
      const { data: progreso } = await supabase
        .from('material_progress')
        .select('completed_at, validated')
        .eq('student_id', userId)
        .eq('content_item_id', itemId)
        .maybeSingle()
      if (progreso?.completed_at) {
        setCompletado(true)
        setValidado(!!progreso.validated)
      }
    }, 5_000)
    return () => clearInterval(id)
  }, [material?.check_quiz_id, completado, itemId])

  if (cargando) return <PantallaEsqueleto />

  if (noDisponible || !material) {
    return (
      <div className="min-h-dvh bg-zr-bg px-5 pb-28 pt-14">
        <div className="space-y-8">
          <BotonVolver href={`/unidades/${unitId}`} />
          <div className="zr-card space-y-2 p-6 text-center">
            <p className="text-base font-bold text-zr-text">Este material todavía no está disponible</p>
            <p className="text-sm text-zr-text-muted">
              Puede estar pendiente de aprobación, fuera de fecha o de otra cohorte. Avisa a tu profesor si crees que debería verse.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-zr-bg px-5 pb-28 pt-14">
      <div className="space-y-8">
        <BotonVolver href={`/unidades/${unitId}`} />

        <Encabezado sobretitulo="Material" titulo={material.title} descripcion={material.description ?? undefined} />

        <VisorMaterial
          contentItemId={itemId}
          tipo={material.type}
          storagePath={material.storage_path}
        />

        {material.check_quiz_id && validado && (
          <div className="zr-card flex items-center gap-3 border-zr-success/40 bg-zr-success/10 p-4">
            <IconoCheck size={20} className="shrink-0 text-zr-success" />
            <p className="text-sm font-bold text-zr-text">Mini-chequeo aprobado</p>
          </div>
        )}

        {material.check_quiz_id && completado && !validado && (
          <Link
            href={`/examenes/${material.check_quiz_id}`}
            className="zr-card zr-card-interactive flex items-center gap-4 p-5"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zr-blue/12 text-zr-blue">
              <IconoExamen size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-zr-text">Haz el mini-chequeo</p>
              <div className="mt-1">
                <Etiqueta tono="info">{chequeoTitulo ?? 'Examen corto'}</Etiqueta>
              </div>
            </div>
          </Link>
        )}
      </div>
    </div>
  )
}

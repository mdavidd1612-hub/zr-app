'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { IconoDocumento, IconoVideo, IconoAviso } from '@/components/ui/Iconos'
import { BotonVolver } from '@/components/ui/BotonVolver'

interface Material {
  id: string
  titulo: string
  descripcion: string
  tipo: 'pdf' | 'video' | 'documento'
  semana: number
  tamaño?: string
}

export default function Contenido() {
  const router = useRouter()
  const supabase = createClient()
  const [materiales, setMateriales] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadMateriales() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Mock data
      setMateriales([
        {
          id: '1',
          titulo: 'Guía de Ley de Ohm Aplicada',
          descripcion: 'Conceptos fundamentales y aplicación práctica',
          tipo: 'pdf',
          semana: 1,
          tamaño: '2.4 MB',
        },
        {
          id: '2',
          titulo: 'Video: Diagnóstico de Batería',
          descripcion: 'Proceso paso a paso para diagnosticar una batería',
          tipo: 'video',
          semana: 2,
        },
        {
          id: '3',
          titulo: 'Manual de Multímetro Digital',
          descripcion: 'Instrucciones completas y casos de uso',
          tipo: 'documento',
          semana: 1,
          tamaño: '1.8 MB',
        },
        {
          id: '4',
          titulo: 'Circuitos Básicos en Vehículos',
          descripcion: 'Diagramas y explicaciones detalladas',
          tipo: 'pdf',
          semana: 2,
          tamaño: '3.1 MB',
        },
        {
          id: '5',
          titulo: 'Herramientas y Equipos Esenciales',
          descripcion: 'Catálogo de herramientas con especificaciones',
          tipo: 'documento',
          semana: 1,
          tamaño: '1.2 MB',
        },
      ])

      setLoading(false)
    }

    loadMateriales()
  }, [])

  const IconoMaterial = (tipo: string) => {
    switch (tipo) {
      case 'pdf':
        return IconoDocumento
      case 'video':
        return IconoVideo
      default:
        return IconoDocumento
    }
  }

  const getMaterialColor = (tipo: string) => {
    switch (tipo) {
      case 'pdf':
        return 'text-zr-error'
      case 'video':
        return 'text-zr-blue'
      case 'documento':
        return 'text-zr-blue-mid'
      default:
        return 'text-zr-text-muted'
    }
  }

  if (loading) {
    return (
      <div className="h-dvh bg-zr-background flex items-center justify-center">
        <div className="text-zr-text-muted">Cargando...</div>
      </div>
    )
  }

  // Group by week
  const grouped = materiales.reduce((acc, mat) => {
    if (!acc[mat.semana]) acc[mat.semana] = []
    acc[mat.semana].push(mat)
    return acc
  }, {} as Record<number, Material[]>)

  return (
    <div className="flex flex-col bg-zr-background min-h-dvh">
      <div className="flex-1 overflow-y-auto px-5 pb-24">
        <div className="space-y-8 pt-14 animate-fade-in">
          <BotonVolver href="/" />

          {/* Header */}
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-zr-text tracking-tight">Material de Estudio</h1>
            <p className="text-sm text-zr-text-muted font-medium">{materiales.length} recursos disponibles</p>
          </div>

          {/* Divider */}
          <div className="h-px bg-zr-border" />

          {/* Material by Week */}
          {Object.keys(grouped)
            .sort()
            .map((week, sectionIdx) => (
              <div
                key={week}
                className="space-y-4 animate-fade-in"
                style={{ animationDelay: `${sectionIdx * 100}ms` }}
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-xs text-zr-blue-mid font-bold tracking-widest">
                    0{sectionIdx + 1} — SEMANA {week}
                  </span>
                </div>

                <div className="space-y-2">
                  {grouped[parseInt(week)].map((material, idx) => (
                    <button
                      key={material.id}
                      onClick={() => alert(`Abriendo: ${material.titulo}`)}
                      className="w-full group text-left bg-zr-surface border border-zr-border rounded-lg p-4 hover:border-zr-blue/50 transition-all duration-300 cursor-pointer hover:shadow-md hover:translate-y-[-2px] animate-fade-in"
                      style={{ animationDelay: `${(sectionIdx * 5 + idx) * 50}ms` }}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex-shrink-0 mt-0.5 ${getMaterialColor(material.tipo)}`}>
                          {(() => { const Icono = IconoMaterial(material.tipo); return <Icono size={22} /> })()}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-zr-text group-hover:text-zr-blue transition-colors">
                            {material.titulo}
                          </h3>
                          <p className="text-xs text-zr-text-muted mt-1">{material.descripcion}</p>
                          {material.tamaño && (
                            <p className="text-xs text-zr-text-muted mt-2">{material.tamaño}</p>
                          )}
                        </div>

                        <div className={`text-xs font-bold flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity ${getMaterialColor(material.tipo)}`}>
                          {material.tipo.toUpperCase()}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}

          {/* Info Card */}
          <div className="bg-zr-blue/10 border border-zr-blue/30 rounded-lg p-5 space-y-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-zr-text">
              <IconoAviso size={18} className="text-zr-blue" />
              Consejo
            </p>
            <p className="text-sm text-zr-text-muted">
              Descarga los materiales antes de cada clase para consultarlos sin conexión. Todos los recursos están disponibles por semana.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Tarjeta } from '@/components/ui/Tarjeta'
import { Boton } from '@/components/ui/Boton'
import { EstadoVacio } from '@/components/ui/EstadoVacio'
import { Cargando } from '@/components/ui/Cargando'

interface SesionHoy {
  id: string
  cohortName: string
  weekNumber: number
  moduleName: string
  studentCount: number
  status: string
}

export default function Hoy() {
  const [cargando, setCargando] = useState(true)
  const [sesion, setSesion] = useState<SesionHoy | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function cargar() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const hoy = new Date().toISOString().split('T')[0]

        const { data } = await supabase
          .from('class_sessions')
          .select(`
            id, week_number, status,
            cohorts(name),
            modules(name)
          `)
          .eq('teacher_id', user.id)
          .eq('session_date', hoy)
          .order('session_date', { ascending: false })
          .limit(1)
          .single()

        if (data) {
          setSesion({
            id: data.id,
            cohortName: (data.cohorts as any)?.name || 'Cohorte',
            weekNumber: data.week_number,
            moduleName: (data.modules as any)?.name || 'Módulo',
            studentCount: 0,
            status: data.status,
          })
        }

        setCargando(false)
      } catch (error) {
        console.error('Error cargando sesión:', error)
        setCargando(false)
      }
    }

    cargar()
  }, [])

  if (cargando) return <Cargando texto="Preparando la clase..." />

  return (
    <div className="space-y-6 pb-24">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-zr-navy">👋 Bienvenido</h1>
        <p className="text-sm text-zr-text-muted">Gestión de asistencia y operación del sábado</p>
      </header>

      {!sesion ? (
        <EstadoVacio
          titulo="Sin clase hoy"
          explicacion="No tienes una sesión programada para hoy. Ve a Sesiones para gestionar tu horario."
          icono="📭"
        />
      ) : (
        <div className="space-y-4">
          {/* Tarjeta principal: sesión de hoy */}
          <div className="glass rounded-3xl overflow-hidden backdrop-blur-xl border border-white/20 shadow-2xl">
            <div className="bg-gradient-to-br from-zr-blue via-zr-blue-deep to-zr-navy p-8 text-center">
              <p className="text-white/70 text-sm mb-2">SESIÓN DE HOY</p>
              <h2 className="text-2xl font-bold text-white mb-1">{sesion.cohortName}</h2>
              <p className="text-white/80">Semana {sesion.weekNumber} · {sesion.moduleName}</p>
            </div>

            <div className="p-6 space-y-6">
              {/* Estado */}
              <div className="text-center">
                <span className={`text-sm font-bold px-4 py-2 rounded-full inline-block ${
                  sesion.status === 'abierta'
                    ? 'bg-zr-success/20 text-zr-success'
                    : sesion.status === 'programada'
                    ? 'bg-zr-warning/20 text-zr-warning'
                    : 'bg-zr-border text-zr-text-muted'
                }`}>
                  Estado: {sesion.status}
                </span>
              </div>

              {/* Botón principal: Abrir clase y escanear */}
              <div className="min-h-32">
                <Link href={`/escanear/${sesion.id}`}>
                  <Boton variante="principal" tamano="grande" anchoCompleto>
                    🔍 Abrir clase y pasar asistencia
                  </Boton>
                </Link>
              </div>

              {/* Acciones secundarias */}
              <div className="grid grid-cols-2 gap-3">
                <Link href="/sesiones">
                  <Boton variante="secundario" anchoCompleto>
                    📋 Mis sesiones
                  </Boton>
                </Link>
                <Boton variante="texto">
                  ⚙️ Configuración
                </Boton>
              </div>
            </div>
          </div>

          {/* Quick stats */}
          <Tarjeta>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-2xl font-bold text-zr-blue">0</p>
                <p className="text-xs text-zr-text-muted">Presentes</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-zr-warning">0</p>
                <p className="text-xs text-zr-text-muted">Pendientes</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-zr-success">0</p>
                <p className="text-xs text-zr-text-muted">Refrigerios</p>
              </div>
            </div>
          </Tarjeta>
        </div>
      )}
    </div>
  )
}

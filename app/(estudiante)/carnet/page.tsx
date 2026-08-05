'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/client'
import { getQRSecret } from '@/lib/qr-secret'
import { generateTOTP, secondsUntilNextTOTP } from '@/lib/totp'
import { Tarjeta } from '@/components/ui/Tarjeta'
import { EstadoVacio } from '@/components/ui/EstadoVacio'
import { Cargando } from '@/components/ui/Cargando'

interface ProximoSabado {
  sessionDate: string
  weekNumber: number
  moduleName: string
  prePracticeDescription: string | null
}

interface Progreso {
  totalCompetencias: number
  dominadas: number
}

interface Perfil {
  full_name: string
  cedula: string
  avatar_url: string | null
}

export default function Carnet() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [proximo, setProximo] = useState<ProximoSabado | null>(null)
  const [progreso, setProgreso] = useState<Progreso | null>(null)
  const [modulosAprobados, setModulosAprobados] = useState(0)
  const [qrUrl, setQrUrl] = useState('')
  const [totp, setTotp] = useState('')
  const [tiempoRestante, setTiempoRestante] = useState(30)

  const supabase = createClient()

  useEffect(() => {
    async function cargar() {
      try {
        // Perfil
        const { data: userData } = await supabase.auth.getUser()
        if (!userData.user) {
          router.push('/login')
          return
        }

        const { data: perfilData } = await supabase
          .from('profiles')
          .select('full_name, cedula, avatar_url')
          .eq('id', userData.user.id)
          .single()

        setPerfil(perfilData)

        // Próximo sábado
        const { data: proximoData } = await supabase
          .from('v_proximo_sabado')
          .select('session_date, week_number, module_name, pre_practice_description')
          .eq('student_id', userData.user.id)
          .single()

        if (proximoData) {
          setProximo({
            sessionDate: proximoData.session_date || '',
            weekNumber: proximoData.week_number || 0,
            moduleName: proximoData.module_name || '',
            prePracticeDescription: proximoData.pre_practice_description,
          })
        }

        // Progreso en módulo actual
        const { data: moduloData } = await supabase
          .from('mastery_map')
          .select('status')
          .eq('student_id', userData.user.id)

        const dominadas = moduloData?.filter((m) => m.status === 'dominado').length ?? 0
        setProgreso({ totalCompetencias: moduloData?.length ?? 0, dominadas })

        // Módulos aprobados
        const { count } = await supabase
          .from('module_enrollments')
          .select('id', { count: 'exact' })
          .eq('student_id', userData.user.id)
          .eq('status', 'aprobado')

        setModulosAprobados(count ?? 0)

        // QR: obtener secreto y generar código
        const secret = await getQRSecret(perfilData?.cedula || '')
        if (secret) {
          const codigo = generateTOTP(secret.secret, secret.label)
          setTotp(codigo)

          const qrString = `ZR1|${perfilData?.cedula}|${codigo}`
          const url = await QRCode.toDataURL(qrString, { width: 256 })
          setQrUrl(url)
        }

        setCargando(false)
      } catch (error) {
        console.error('Error cargando carnet:', error)
        setCargando(false)
      }
    }

    cargar()
  }, [supabase, router])

  // Actualizar TOTP cada segundo
  useEffect(() => {
    if (!perfil) return

    const interval = setInterval(async () => {
      const secret = await getQRSecret(perfil.cedula)
      if (secret) {
        const nuevoTotp = generateTOTP(secret.secret, secret.label)
        setTotp(nuevoTotp)

        // Regenerar QR
        const qrString = `ZR1|${perfil.cedula}|${nuevoTotp}`
        const url = await QRCode.toDataURL(qrString, { width: 256 })
        setQrUrl(url)
      }

      setTiempoRestante(secondsUntilNextTOTP())
    }, 1000)

    return () => clearInterval(interval)
  }, [perfil])

  if (cargando) return <Cargando texto="Cargando tu carnet..." />

  if (!perfil) return <EstadoVacio titulo="Error" explicacion="No se pudo cargar tu perfil" />

  return (
    <div className="space-y-4">
      {/* Próximo sábado */}
      {proximo ? (
        <Tarjeta tono="informativa">
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-bold">🗓️ PRÓXIMO SÁBADO</h2>
              <span className="text-sm text-zr-navy">{proximo.sessionDate}</span>
            </div>
            <p className="text-sm text-zr-navy">
              Semana {proximo.weekNumber} · {proximo.moduleName}
            </p>
            {proximo.prePracticeDescription && (
              <div className="mt-3 rounded bg-white bg-opacity-50 p-2 text-sm text-zr-navy">
                <p className="font-medium">Para llegar preparado:</p>
                <p>{proximo.prePracticeDescription}</p>
              </div>
            )}
          </div>
        </Tarjeta>
      ) : (
        <Tarjeta tono="informativa">
          <p className="text-sm text-zr-navy">No tienes clase programada por ahora.</p>
        </Tarjeta>
      )}

      {/* Mi progreso */}
      {progreso && (
        <Tarjeta>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-zr-text">📊 MI PROGRESO</h3>
              <p className="text-sm text-zr-text-muted">
                Dominas {progreso.dominadas} de {progreso.totalCompetencias}
              </p>
            </div>
            <a href="/progreso" className="text-sm text-zr-blue-deep underline">
              Ver todas →
            </a>
          </div>
        </Tarjeta>
      )}

      {/* El carnet */}
      {qrUrl && (
        <div className="rounded-zr border-4 border-zr-navy bg-white p-6 text-center">
          {/* Foto o iniciales */}
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zr-blue text-2xl font-bold text-white">
            {perfil.avatar_url ? (
              <img src={perfil.avatar_url} alt={perfil.full_name} className="h-full w-full rounded-full object-cover" />
            ) : (
              perfil.full_name
                .split(' ')
                .map((w) => w[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)
            )}
          </div>

          {/* Datos del estudiante */}
          <h2 className="text-lg font-bold text-zr-navy">{perfil.full_name}</h2>
          <p className="font-mono text-sm text-zr-text-muted">{perfil.cedula}</p>

          {/* QR */}
          <div className="my-4 flex justify-center">
            <img src={qrUrl} alt="QR Code" className="h-48 w-48 border-2 border-zr-navy" />
          </div>

          {/* Código actual y barra de progreso */}
          <div className="space-y-2 text-center">
            <p className="font-mono text-2xl font-bold text-zr-blue-deep">{totp}</p>
            <div className="h-1 overflow-hidden rounded-full bg-zr-border">
              <div
                className="h-full bg-zr-blue transition-all duration-1000"
                style={{ width: `${(tiempoRestante / 30) * 100}%` }}
              />
            </div>
            <p className="text-xs text-zr-text-muted">Se actualiza en {tiempoRestante}s</p>
          </div>

          {/* Contador de módulos */}
          <div className="border-t border-zr-border pt-3 mt-3">
            <p className="text-xs text-zr-text-muted">Módulos aprobados: {modulosAprobados} de 13</p>
          </div>
        </div>
      )}
    </div>
  )
}

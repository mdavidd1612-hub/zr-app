'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/client'
import { getQRSecret } from '@/lib/qr-secret'
import { generateTOTP, secondsUntilNextTOTP } from '@/lib/totp'
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

interface CarnetData {
  cohortName: string
  moduleName: string
}

export default function Carnet() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [carnetData, setCarnetData] = useState<CarnetData | null>(null)
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
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser) {
          router.push('/login')
          return
        }

        // Cargar perfil (crítico)
        const { data: perfilData } = await supabase
          .from('profiles')
          .select('full_name, cedula, avatar_url')
          .eq('id', authUser.id)
          .single()

        if (!perfilData) {
          setCargando(false)
          return
        }
        setPerfil(perfilData)

        // Cargar datos no-críticos en background (non-blocking)
        void supabase.from('students').select('cohorts(name, current_module_id)').eq('id', authUser.id).maybeSingle()
          .then(({ data }) => {
            if (data?.cohorts) {
              const c = data.cohorts as any
              setCarnetData({ cohortName: c.name || 'Cohorte', moduleName: 'Módulo' })
            }
          })

        void supabase.from('v_proximo_sabado').select('session_date, week_number, module_name, pre_practice_description')
          .eq('student_id', authUser.id).maybeSingle()
          .then(({ data }) => {
            if (data) setProximo({
              sessionDate: data.session_date || '',
              weekNumber: data.week_number || 0,
              moduleName: data.module_name || '',
              prePracticeDescription: data.pre_practice_description,
            })
          })

        void supabase.from('mastery_map').select('status').eq('student_id', authUser.id)
          .then(({ data }) => {
            const total = data?.length ?? 0
            const dominadas = data?.filter((m) => m.status === 'dominado').length ?? 0
            setProgreso({ totalCompetencias: total, dominadas })
          })

        void supabase.from('module_enrollments').select('id', { count: 'exact' })
          .eq('student_id', authUser.id).eq('status', 'aprobado')
          .then(({ count }) => setModulosAprobados(count ?? 0))

        // QR
        void getQRSecret(perfilData.cedula || '').then((secret) => {
          if (secret) {
            const codigo = generateTOTP(secret.secret, secret.label)
            setTotp(codigo)
            const qrString = `ZR1|${perfilData.cedula}|${codigo}`
            void QRCode.toDataURL(qrString, { width: 256 }).then(setQrUrl)
          }
        })

        setCargando(false)
      } catch (error) {
        console.error('Error cargando carnet:', error)
        setCargando(false)
      }
    }

    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Actualizar TOTP cada segundo
  useEffect(() => {
    if (!perfil) return

    let updating = false
    const interval = setInterval(async () => {
      if (updating) return
      updating = true

      try {
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
      } catch (err) {
        console.error('Error updating TOTP:', err)
      } finally {
        updating = false
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [perfil])

  if (cargando) return <Cargando texto="Cargando tu carnet..." />

  if (!perfil) return <EstadoVacio titulo="Error" explicacion="No se pudo cargar tu perfil" />

  if (cargando) return <Cargando texto="Cargando tu carnet..." />

  return (
    <div className="space-y-5 pb-24">
      {/* 🎫 CARNET DIGITAL · Sección principal */}
      {qrUrl && perfil && carnetData ? (
        <div className="glass rounded-3xl overflow-hidden backdrop-blur-xl border border-white/20 shadow-2xl">
          {/* Encabezado: gradiente + overlay */}
          <div className="relative bg-gradient-to-br from-zr-blue via-zr-blue-deep to-zr-navy p-8 text-center">
            <div className="absolute inset-0 bg-black/10 backdrop-blur-sm" />
            <div className="relative space-y-1">
              <h1 className="text-2xl font-bold text-white">🎫 MI CARNET DIGITAL</h1>
              <p className="text-sm text-white/70">{carnetData.cohortName}</p>
            </div>
          </div>

          {/* Contenido: glassmorphism extremo */}
          <div className="p-6 space-y-5 bg-gradient-to-b from-white/20 via-white/10 to-transparent">
            {/* Estudiante */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-zr-blue-mid to-zr-blue rounded-full blur-xl opacity-50 group-hover:opacity-75 transition" />
                <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-zr-blue-mid to-zr-blue text-4xl font-bold text-white shadow-2xl ring-4 ring-white/40 backdrop-blur-sm">
                  {perfil.avatar_url ? (
                    <Image src={perfil.avatar_url} alt={perfil.full_name} width={96} height={96} className="h-full w-full rounded-full object-cover" />
                  ) : (
                    perfil.full_name
                      .split(' ')
                      .map((w) => w[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)
                  )}
                </div>
              </div>
              <div className="text-center space-y-1">
                <h2 className="text-2xl font-bold text-zr-navy">{perfil.full_name}</h2>
                <p className="text-sm font-mono text-zr-text-muted bg-zr-blue/10 px-3 py-1 rounded-full inline-block">{perfil.cedula}</p>
              </div>
            </div>

            {/* Módulo actual */}
            <div className="glass rounded-2xl p-4 bg-gradient-to-r from-zr-blue-light/20 to-zr-blue/10 border border-zr-blue/20 text-center">
              <p className="text-xs text-zr-text-muted mb-1">MÓDULO ACTUAL</p>
              <p className="text-lg font-bold text-zr-navy">{carnetData.moduleName}</p>
            </div>

            {/* Divisor */}
            <div className="h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

            {/* QR · El corazón del carnet */}
            <div className="flex justify-center py-3">
              <div className="glass rounded-3xl p-6 bg-gradient-to-br from-white/60 to-white/30 border-4 border-zr-navy/40 shadow-2xl backdrop-blur-xl">
                <Image src={qrUrl} alt="QR Asistencia" width={180} height={180} className="h-44 w-44" priority />
              </div>
            </div>

            {/* TOTP · Código rotativo */}
            <div className="space-y-3 glass rounded-2xl p-6 bg-gradient-to-br from-zr-blue-light/20 via-white/20 to-zr-blue/10 border border-zr-blue-light/30 backdrop-blur-xl">
              <p className="text-xs text-zr-text-muted font-bold uppercase tracking-widest">Código verificación</p>
              <p className="font-mono text-5xl font-bold text-zr-blue-deep tracking-[0.2em] text-center">{totp}</p>
              <div className="space-y-2">
                <div className="h-2 overflow-hidden rounded-full bg-gradient-to-r from-white/20 to-zr-blue/20 backdrop-blur">
                  <div
                    className="h-full bg-gradient-to-r from-zr-blue via-zr-blue-deep to-zr-navy transition-all duration-1000 shadow-lg rounded-full"
                    style={{ width: `${(tiempoRestante / 30) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-center text-zr-text-muted">Actualiza en <span className="font-bold text-zr-blue">{tiempoRestante}s</span></p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="glass rounded-2xl p-4 text-center bg-gradient-to-br from-zr-success/20 to-zr-success/10 border border-zr-success/30 backdrop-blur-lg">
                <p className="text-3xl font-bold text-zr-success">{modulosAprobados}</p>
                <p className="text-xs text-zr-text-muted mt-1">Módulos aprobados</p>
              </div>
              <div className="glass rounded-2xl p-4 text-center bg-gradient-to-br from-zr-blue/20 to-zr-blue-light/10 border border-zr-blue/30 backdrop-blur-lg">
                <p className="text-3xl font-bold text-zr-blue">{progreso?.dominadas || 0}</p>
                <p className="text-xs text-zr-text-muted mt-1">Competencias dominadas</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass rounded-3xl p-12 text-center backdrop-blur-xl border border-white/20">
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="h-16 w-16 animate-pulse rounded-full bg-gradient-to-br from-zr-blue/40 to-zr-blue-deep/40 backdrop-blur" />
            </div>
            <p className="text-sm text-zr-text-muted">Preparando tu carnet...</p>
          </div>
        </div>
      )}

      {/* PRÓXIMO SÁBADO */}
      <div className="space-y-3">
        {proximo ? (
          <div className="glass rounded-2xl p-5 backdrop-blur-lg border border-white/20">
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-lg font-bold text-zr-navy">🗓️ PRÓXIMO SÁBADO</h3>
                <span className="text-sm font-mono text-zr-blue font-bold">{proximo.sessionDate}</span>
              </div>
              <p className="text-sm text-zr-text-muted">
                Semana {proximo.weekNumber} · <span className="font-medium text-zr-navy">{proximo.moduleName}</span>
              </p>
              {proximo.prePracticeDescription && (
                <div className="mt-3 glass rounded-xl p-3 bg-gradient-to-br from-zr-blue-light/20 to-zr-blue/10 border border-zr-blue/20">
                  <p className="font-bold text-sm text-zr-navy mb-1">📚 Para llegar preparado:</p>
                  <p className="text-sm text-zr-text-muted leading-relaxed">{proximo.prePracticeDescription}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="glass rounded-2xl p-5 backdrop-blur-lg border border-white/20 text-center">
            <p className="text-sm text-zr-text-muted">No tienes clase programada por ahora.</p>
          </div>
        )}
      </div>

      {/* MI PROGRESO */}
      {progreso && (
        <div className="glass rounded-2xl p-5 backdrop-blur-lg border border-white/20">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-zr-navy">📊 MI PROGRESO</h3>
              <p className="text-sm text-zr-text-muted">
                Dominas <span className="font-bold text-zr-blue">{progreso.dominadas}</span> de {progreso.totalCompetencias}
              </p>
            </div>
            <a href="/progreso" className="flex items-center gap-1 whitespace-nowrap px-3 py-2 rounded-lg bg-zr-blue/10 text-zr-blue font-medium text-sm hover:bg-zr-blue/20 transition-colors">
              Ver todas →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

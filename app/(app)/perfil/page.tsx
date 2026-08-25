'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import QRCode from 'qrcode'
import { generateTOTP } from '@/lib/totp'
import { getQRSecret } from '@/lib/qr-secret'
import { Seccion, Regla } from '@/components/ui/Editorial'
import { BloqueCuenta } from '@/components/ui/BloqueCuenta'
import { BotonActivarPush } from '@/components/ui/BotonActivarPush'

interface Perfil {
  fullName: string
  cedula: string
  contactEmail: string | null
  cohorte: string
  codigoCarnet: string | null
  modulo: string | null
}

// Fase 0 (docs/14_FASE0_PLAN_SPRINTS.md, Sprint 6): sede y turno son fijos
// por ahora — se conectan a datos reales de cohorte en una fase posterior.
const SEDE = 'Sede principal'
const TURNO = 'Sábado · 8:00 am'

export default function PerfilEstudiante() {
  const router = useRouter()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [qrUrl, setQrUrl] = useState('')
  const [totp, setTotp] = useState('')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const [{ data: prof }, { data: est }] = await Promise.all([
        supabase.from('profiles').select('full_name, cedula, contact_email').eq('id', user.id).single(),
        supabase
          .from('students')
          .select('student_code, cohorts(name, modules(name))')
          .eq('id', user.id)
          .single(),
      ])

      const estData = est as unknown as {
        student_code: string | null
        cohorts: { name: string; modules: { name: string } | null } | null
      } | null

      if (prof) {
        setPerfil({
          fullName: prof.full_name,
          cedula: prof.cedula,
          contactEmail: prof.contact_email,
          cohorte: estData?.cohorts?.name ?? 'Sin cohorte asignada',
          codigoCarnet: estData?.student_code ?? null,
          modulo: estData?.cohorts?.modules?.name ?? null,
        })

        // El QR se genera del secreto TOTP del propio estudiante. El código
        // rota solo cada 30s; el navegador nunca decide si es válido.
        const secret = await getQRSecret(prof.cedula ?? '')
        if (secret) {
          const codigo = generateTOTP(secret.secret, secret.label)
          setTotp(codigo)
          const url = await QRCode.toDataURL(`ZR1|${prof.cedula}|${codigo}`, {
            width: 200,
            margin: 1,
            color: { dark: '#0F1419', light: '#FFFFFF' },
          })
          setQrUrl(url)
        }
      }

      setCargando(false)
    }

    cargar()
  }, [router])

  if (cargando || !perfil) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando…</p>
      </div>
    )
  }

  return (
    <div className="space-y-11 px-5 pt-14">
      <header className="animate-rise">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">
          Mi carnet
        </p>
        <h1 className="zr-display mt-3 text-4xl text-zr-text">{perfil.fullName}</h1>
      </header>

      <Regla delay={60} />

      {/* 01 — CARNET */}
      <Seccion numero={1} titulo="Carnet digital" delay={120}>
        <div className="overflow-hidden rounded-xl bg-gradient-to-br from-zr-blue-deep via-zr-blue to-zr-blue-mid p-6 shadow-lg">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/60">
                ZR Mecademy
              </p>
              <p className="mt-3 truncate text-lg font-bold text-white">{perfil.fullName}</p>
              <p className="mt-0.5 text-sm tabular-nums text-white/80">{perfil.cedula}</p>
              <p className="mt-4 inline-flex items-center rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-xs font-bold text-white">
                Estudiante activo
              </p>
            </div>

            {qrUrl && (
              <div className="shrink-0 rounded-lg bg-white p-2">
                <img src={qrUrl} alt="Código QR de asistencia" className="h-28 w-28" />
              </div>
            )}
          </div>

          <div className="mt-6 space-y-0 border-t border-white/20 pt-1 text-sm">
            {[
              ['Código', perfil.codigoCarnet ?? '—'],
              ['Sede', SEDE],
              ['Turno', TURNO],
              ['Módulo', perfil.modulo ?? 'Sin asignar'],
            ].map(([etiqueta, valor]) => (
              <div key={etiqueta} className="flex justify-between border-t border-white/10 py-2 first:border-t-0">
                <span className="text-white/70">{etiqueta}</span>
                <span className="font-semibold text-white">{valor}</span>
              </div>
            ))}
          </div>

          {totp && (
            <div className="mt-1 border-t border-white/20 pt-4 text-xs font-medium text-white/70">
              Código de asistencia:{' '}
              <span className="ml-1 font-mono tabular-nums text-white/90">{totp}</span>
            </div>
          )}
        </div>

        <p className="text-sm text-zr-text-muted">
          Muéstrale este código a tu profesor al llegar. Cambia solo, no hace falta refrescar.
        </p>
      </Seccion>

      {/* 02 — CUENTA */}
      <Seccion numero={2} titulo="Cuenta" delay={200}>
        <BloqueCuenta
          nombre={perfil.fullName}
          cedula={perfil.cedula}
          rol="estudiante"
          correo={perfil.contactEmail}
        />
        <p className="text-xs text-zr-text-muted">{perfil.cohorte}</p>
        <BotonActivarPush />
      </Seccion>
    </div>
  )
}

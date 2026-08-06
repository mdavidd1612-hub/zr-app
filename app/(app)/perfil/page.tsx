'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import QRCode from 'qrcode'
import { generateTOTP } from '@/lib/totp'
import { getQRSecret } from '@/lib/qr-secret'
import { Seccion, Regla, Dato } from '@/components/ui/Editorial'
import { BloqueCuenta } from '@/components/ui/BloqueCuenta'

interface Perfil {
  fullName: string
  cedula: string
  contactEmail: string | null
  cohorte: string
}

export default function PerfilEstudiante() {
  const router = useRouter()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [qrUrl, setQrUrl] = useState('')
  const [totp, setTotp] = useState('')
  const [dominio, setDominio] = useState({ dominadas: 0, enProgreso: 0 })
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
        supabase.from('students').select('cohorts(name)').eq('id', user.id).single(),
      ])

      const cohorte = (est as unknown as { cohorts: { name: string } | null } | null)?.cohorts?.name

      if (prof) {
        setPerfil({
          fullName: prof.full_name,
          cedula: prof.cedula,
          contactEmail: prof.contact_email,
          cohorte: cohorte ?? 'Sin cohorte asignada',
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

      const { data: comps } = await supabase.from('v_mi_dominio').select('status').eq('student_id', user.id)
      if (comps) {
        setDominio({
          dominadas: comps.filter((c) => c.status === 'dominado').length,
          enProgreso: comps.filter((c) => c.status === 'en_progreso').length,
        })
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

          <div className="mt-6 border-t border-white/20 pt-4 text-xs font-medium text-white/70">
            Código: <span className="ml-1 font-mono tabular-nums text-white/90">{totp}</span>
          </div>
        </div>

        <p className="text-sm text-zr-text-muted">
          Muéstrale este código a tu profesor al llegar. Cambia solo, no hace falta refrescar.
        </p>
      </Seccion>

      {/* 02 — COMPETENCIAS */}
      <Seccion numero={2} titulo="Competencias" delay={200}>
        <div className="grid grid-cols-2 gap-3">
          <Dato valor={dominio.dominadas} etiqueta="Dominadas" tono="exito" />
          <Dato valor={dominio.enProgreso} etiqueta="En progreso" tono="azul" />
        </div>
      </Seccion>

      {/* 03 — CUENTA */}
      <Seccion numero={3} titulo="Cuenta" delay={280}>
        <BloqueCuenta
          nombre={perfil.fullName}
          cedula={perfil.cedula}
          rol="estudiante"
          correo={perfil.contactEmail}
        />
        <p className="text-xs text-zr-text-muted">{perfil.cohorte}</p>
      </Seccion>
    </div>
  )
}

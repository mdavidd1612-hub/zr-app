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
import { leerSimulacionSabado, guardarSimulacionSabado } from '@/lib/demo-sabado'

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
  const [simulado, setSimulado] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    async function cargar() {
      setSimulado(leerSimulacionSabado())

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
          cohorte: estData?.cohorts?.name ?? 'Sin programa asignado',
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
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-zr-navy via-zr-navy to-zr-blue-deep p-4 shadow-md">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">ZR Mecademy</p>
            <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-bold text-white/70">
              Activo
            </span>
          </div>

          <div className="mt-3 flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-white">{perfil.fullName}</p>
              <p className="mt-0.5 text-xs tabular-nums text-white/60">{perfil.cedula}</p>
            </div>
            {qrUrl && (
              <div className="shrink-0 rounded-md bg-white p-1">
                <img src={qrUrl} alt="Código QR de asistencia" className="h-16 w-16" />
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-white/10 pt-3">
            {[
              ['Código', perfil.codigoCarnet ?? '—'],
              ['Sede', SEDE],
              ['Turno', TURNO],
              ['Módulo', perfil.modulo ?? 'Sin asignar'],
            ].map(([etiqueta, valor]) => (
              <div key={etiqueta} className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">{etiqueta}</p>
                <p className="truncate text-xs font-semibold text-white/90">{valor}</p>
              </div>
            ))}
          </div>

          {totp && (
            <div className="mt-3 border-t border-white/10 pt-2.5 text-[11px] text-white/50">
              Código de asistencia:{' '}
              <span className="font-mono tabular-nums text-white/80">{totp}</span>
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

      {/* 03 — PRUEBA TEMPORAL: interruptor de simulación de sábado, para
          probar el flujo de asistencia sin esperar al sábado real. Solo de
          prueba — se quita del todo cuando la academia lo pida
          (docs/14_FASE0_PLAN_SPRINTS.md). */}
      <Seccion numero={3} titulo="Prueba" delay={260}>
        <button
          onClick={() => {
            const nuevo = !simulado
            setSimulado(nuevo)
            guardarSimulacionSabado(nuevo)
          }}
          className="zr-card flex w-full items-center justify-between gap-4 p-5 text-left"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zr-text">Simular que hoy es sábado</p>
            <p className="mt-0.5 text-xs text-zr-text-muted">
              Solo para probar Inicio y el lector de asistencia. Se quita antes de la entrega.
            </p>
          </div>
          <span
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
              simulado ? 'bg-zr-blue' : 'bg-zr-border'
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform ${
                simulado ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </span>
        </button>
      </Seccion>
    </div>
  )
}

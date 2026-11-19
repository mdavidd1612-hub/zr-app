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
import { BotonComoUsarApp } from '@/components/ui/BotonComoUsarApp'
import { FotoPerfil } from '@/components/ui/FotoPerfil'
import { PantallaEsqueleto } from '@/components/ui/Esqueleto'
import { useEsqueletoVisible } from '@/lib/useEsqueletoVisible'

interface Perfil {
  uid: string
  fullName: string
  cedula: string
  contactEmail: string | null
  cohorte: string
  codigoCarnet: string | null
  modulo: string | null
  avatarPath: string | null
  rol: string
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
  const [sinConexion, setSinConexion] = useState(false)
  // Secreto del QR en memoria: el código se recalcula cada segundo y el QR se
  // vuelve a dibujar cuando cambia (cada 30 s). Antes se generaba una sola vez y
  // dejaba de servir a los ~90 s.
  const [secretoQR, setSecretoQR] = useState<{ secret: string; label: string; cedula: string } | null>(null)

  useEffect(() => {
    if (!secretoQR) return
    let ultimo = ''
    let vigente = true
    async function tick() {
      const codigo = generateTOTP(secretoQR!.secret, secretoQR!.label)
      if (codigo === ultimo) return
      ultimo = codigo
      const url = await QRCode.toDataURL(`ZR1|${secretoQR!.cedula}|${codigo}`, {
        width: 200,
        margin: 1,
        color: { dark: '#0F1419', light: '#FFFFFF' },
      })
      if (!vigente) return
      setTotp(codigo)
      setQrUrl(url)
    }
    void tick()
    const id = setInterval(() => { void tick() }, 1000)
    return () => { vigente = false; clearInterval(id) }
  }, [secretoQR])

  useEffect(() => {
    const supabase = createClient()

    // Carnet sin internet: el secreto del QR vive en el teléfono (IndexedDB) y
    // los datos del carnet se guardan la última vez que hubo conexión.
    async function cargarSinConexion(): Promise<boolean> {
      try {
        const crudo = localStorage.getItem('zr-carnet-cache')
        if (!crudo) return false
        const cache = JSON.parse(crudo) as Perfil
        const secreto = await getQRSecret(cache.cedula ?? '')
        if (!secreto) return false
        setPerfil(cache)
        setSecretoQR({ secret: secreto.secret, label: secreto.label, cedula: cache.cedula })
        setSinConexion(true)
        setCargando(false)
        return true
      } catch {
        return false
      }
    }

    async function cargar() {
      if (typeof navigator !== 'undefined' && !navigator.onLine && await cargarSinConexion()) return
      let user: { id: string } | null = null
      try {
        const r = await supabase.auth.getUser()
        user = r.data.user
      } catch {
        if (await cargarSinConexion()) return
      }
      if (!user) {
        if (!navigator.onLine && await cargarSinConexion()) return
        router.replace('/login')
        return
      }

      const [{ data: prof }, { data: est }] = await Promise.all([
        supabase.from('profiles').select('full_name, cedula, contact_email, avatar_url, role').eq('id', user.id).single(),
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
          uid: user.id,
          fullName: prof.full_name,
          cedula: prof.cedula,
          contactEmail: prof.contact_email,
          cohorte: estData?.cohorts?.name ?? 'Sin programa asignado',
          codigoCarnet: estData?.student_code ?? null,
          modulo: estData?.cohorts?.modules?.name ?? null,
          avatarPath: prof.avatar_url,
          rol: prof.role,
        })

        // El QR se genera del secreto TOTP del propio estudiante. El código
        // rota solo cada 30s; el navegador nunca decide si es válido.
        const secret = await getQRSecret(prof.cedula ?? '')
        if (secret) setSecretoQR({ secret: secret.secret, label: secret.label, cedula: prof.cedula })
        try {
          localStorage.setItem('zr-carnet-cache', JSON.stringify({
            uid: user.id, fullName: prof.full_name, cedula: prof.cedula, contactEmail: prof.contact_email,
            cohorte: estData?.cohorts?.name ?? 'Sin programa asignado', codigoCarnet: estData?.student_code ?? null,
            modulo: estData?.cohorts?.modules?.name ?? null, avatarPath: prof.avatar_url, rol: prof.role,
          }))
        } catch { /* sin espacio o modo privado: el carnet sin conexión simplemente no se guarda */ }
      }

      setCargando(false)
    }

    cargar()
  }, [router])

  const mostrarEsqueleto = useEsqueletoVisible(cargando)
  if (mostrarEsqueleto || !perfil) {
    return (
      <PantallaEsqueleto />
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
        <div id="tour-carnet" className="zr-hero p-4">
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
          {sinConexion && ' Estás sin conexión: el código funciona igual y tu asistencia se registra cuando el profesor tenga internet.'}
        </p>
      </Seccion>

      {/* 02 — CUENTA */}
      <Seccion numero={2} titulo="Cuenta" delay={200}>
        <FotoPerfil uid={perfil.uid} rutaInicial={perfil.avatarPath} />
        <BloqueCuenta
          nombre={perfil.fullName}
          cedula={perfil.cedula}
          rol="estudiante"
          correo={perfil.contactEmail}
          onActualizado={(d) => setPerfil((p) => p && { ...p, fullName: d.nombre, contactEmail: d.correo })}
        />
        <p className="text-xs text-zr-text-muted">{perfil.cohorte}</p>
        <BotonActivarPush />
      </Seccion>

      {/* 03 — AYUDA (pedido explícito del coordinador, oct. 2026): vuelve a
          mostrar el recorrido guiado completo, por si alguien quiere
          repasarlo o se lo perdió. */}
      <Seccion numero={3} titulo="Ayuda" delay={240}>
        <BotonComoUsarApp inicioDelRol="/" />
      </Seccion>
    </div>
  )
}

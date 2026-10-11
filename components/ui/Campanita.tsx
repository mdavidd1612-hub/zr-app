'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { IconoCampana, IconoCerrar } from '@/components/ui/Iconos'

/**
 * T-409 · Campanita de notificaciones, compartida por los 3 roles.
 *
 * Solo lee `notifications` (canal in_app o ya enviado por push) — no
 * gestiona la suscripción push en sí, eso vive en cada pantalla de perfil
 * porque pedir permiso del navegador es una acción explícita del usuario.
 *
 * Oct. 2026 (pedido del coordinador): que se use como el teléfono — poder
 * marcar todas como leídas, descartar (borrar) una por una con la ✕, y un
 * botón chiquito "Ver" que lleva a lo que avisa.
 */

interface Notificacion {
  id: string
  tipo: string
  titulo: string
  cuerpo: string
  leida: boolean
  creada: string
  payload: Record<string, unknown> | null
}

function hace(iso: string): string {
  const horas = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000)
  if (horas < 1) return 'hace minutos'
  if (horas < 24) return `hace ${horas} h`
  return `hace ${Math.floor(horas / 24)} d`
}

export function Campanita() {
  const router = useRouter()
  const [abierta, setAbierta] = useState(false)
  const [notis, setNotis] = useState<Notificacion[]>([])
  const [rol, setRol] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vigente = true
    const supabase = createClient()

    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      if (rol === null) {
        const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
        if (vigente && perfil?.role) setRol(perfil.role)
      }

      const { data } = await supabase
        .from('notifications')
        .select('id, type, title, body, read_at, created_at, payload')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30)

      if (!vigente) return

      setNotis(
        (data ?? []).map((n) => ({
          id: n.id,
          tipo: n.type,
          titulo: n.title,
          cuerpo: n.body,
          leida: n.read_at !== null,
          creada: n.created_at,
          payload: n.payload as Record<string, unknown> | null,
        })),
      )
      setCargando(false)
    }

    cargar()
    // Refresco periódico simple: cada 60s basta para algo que no es un chat.
    const intervalo = setInterval(cargar, 60_000)
    return () => { vigente = false; clearInterval(intervalo) }
  }, [rol])

  const sinLeer = notis.filter((n) => !n.leida).length

  // A dónde lleva el botón "Ver", según el tipo y a quién le llegó.
  function destino(n: Notificacion): string | null {
    const p = n.payload ?? {}
    const examId = p.exam_id as string | undefined
    if (examId) return `/examenes/${examId}`
    switch (n.tipo) {
      case 'nota_publicada':
        return rol === 'estudiante' ? '/notas' : null
      case 'material_nuevo':
        return '/contenido'
      case 'examen_habilitado':
        return '/examenes'
      case 'modulo_cambiado':
        return '/clases'
      case 'hora_clase':
      case 'hora_refrigerio':
      case 'recordatorio_pago':
        return '/'
      case 'notas_registradas':
        if (rol === 'profesor') return '/notas-docente'
        if (rol === 'direccion_academica' || rol === 'super_admin' || rol === 'admin') {
          const cohort = p.cohort_id as string | undefined
          return cohort ? `/notas-academicas/${cohort}` : '/notas-academicas'
        }
        return null
      default:
        return null
    }
  }

  async function marcarLeida(id: string) {
    await createClient().from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
    setNotis((xs) => xs.map((x) => (x.id === id ? { ...x, leida: true } : x)))
  }

  async function marcarTodas() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('profile_id', user.id).is('read_at', null)
    setNotis((xs) => xs.map((x) => ({ ...x, leida: true })))
  }

  async function descartar(id: string) {
    setNotis((xs) => xs.filter((x) => x.id !== id)) // se quita de una, sin esperar
    await createClient().from('notifications').delete().eq('id', id)
  }

  function ver(n: Notificacion) {
    if (!n.leida) void marcarLeida(n.id)
    const d = destino(n)
    if (d) {
      setAbierta(false)
      router.push(d)
    }
  }

  return (
    <>
      <button
        onClick={() => setAbierta(true)}
        aria-label="Notificaciones"
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-zr-text-muted transition-colors active:bg-zr-border/40"
      >
        <IconoCampana size={22} />
        {sinLeer > 0 && (
          <span className="absolute right-0.5 top-0.5 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-zr-error px-1 text-[10px] font-bold text-white">
            {sinLeer > 9 ? '9+' : sinLeer}
          </span>
        )}
      </button>

      {abierta && createPortal(
        <div className="zr-backdrop-in fixed inset-0 z-50 flex items-end bg-black/60" onClick={() => setAbierta(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="zr-sheet-in max-h-[75vh] w-full overflow-y-auto rounded-t-2xl border-t border-white/15 bg-zr-surface pb-10 pt-2 shadow-[0_-8px_32px_rgba(0,0,0,0.5)]"
          >
            <div className="mx-auto h-1 w-10 rounded-full bg-zr-border" />

            <div className="flex items-center justify-between px-5 pt-4">
              <p className="text-base font-bold text-zr-text">Notificaciones</p>
              <div className="flex items-center gap-1">
                {sinLeer > 0 && (
                  <button
                    onClick={marcarTodas}
                    className="rounded-full px-3 py-1.5 text-xs font-bold text-zr-blue-mid active:bg-zr-blue/10"
                  >
                    Marcar todas
                  </button>
                )}
                <button
                  onClick={() => setAbierta(false)}
                  aria-label="Cerrar"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-zr-text-muted active:bg-zr-border/50"
                >
                  <IconoCerrar size={18} />
                </button>
              </div>
            </div>

            <div className="mt-3 space-y-1 px-3">
              {cargando && (
                <p className="px-2 py-6 text-center text-sm text-zr-text-muted">Cargando…</p>
              )}

              {!cargando && notis.length === 0 && (
                <p className="px-2 py-6 text-center text-sm text-zr-text-muted">
                  No tienes notificaciones todavía.
                </p>
              )}

              {notis.map((n) => {
                const tieneDestino = destino(n) !== null
                return (
                  <div
                    key={n.id}
                    className={`flex items-start gap-2 rounded-lg px-3 py-3 ${
                      n.leida ? '' : 'bg-zr-blue/10'
                    }`}
                  >
                    <button
                      onClick={() => (n.leida ? undefined : marcarLeida(n.id))}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-start gap-2">
                        {!n.leida && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-zr-blue" />}
                        <div className="min-w-0">
                          <p className={`text-sm font-semibold ${n.leida ? 'text-zr-text-muted' : 'text-zr-text'}`}>{n.titulo}</p>
                          <p className="mt-0.5 text-sm text-zr-text-muted">{n.cuerpo}</p>
                          <p className="mt-1.5 text-xs text-zr-text-muted">{hace(n.creada)}</p>
                        </div>
                      </div>
                    </button>

                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <button
                        onClick={() => descartar(n.id)}
                        aria-label="Descartar"
                        className="flex h-7 w-7 items-center justify-center rounded-full text-zr-text-muted active:bg-zr-border/50"
                      >
                        <IconoCerrar size={14} />
                      </button>
                      {tieneDestino && (
                        <button
                          onClick={() => ver(n)}
                          className="rounded-full border border-zr-blue/40 px-3 py-1 text-xs font-bold text-zr-blue-mid active:bg-zr-blue/10"
                        >
                          Ver
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

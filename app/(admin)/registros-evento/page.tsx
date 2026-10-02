'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { EstadoVacio } from '@/components/ui/EstadoVacio'

/**
 * Quién confirmó asistencia al evento (pedido del coordinador, oct. 2026).
 * Lee la tabla que llena la página pública /evento (migración 118). Solo
 * admin y super_admin -- la política RLS es la garantía real, esto solo
 * evita mostrar una pantalla vacía a quien no puede verla.
 */

interface Registro {
  id: string
  nombre: string
  telefono: string
  correo: string
  fuente: string
  fuenteDetalle: string | null
  creado: string
}

const ETIQUETA_FUENTE: Record<string, string> = {
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
  tiktok: 'TikTok',
  amigo_familiar: 'Amigo o familiar',
  estudiante_zr: 'Estudiante de ZR',
  otro: 'Otro',
}

function aCSV(registros: Registro[]): string {
  const celda = (v: string) => `"${v.replace(/"/g, '""')}"`
  const filas = [
    ['Nombre', 'Teléfono', 'Correo', 'Se enteró por', 'Registrado'],
    ...registros.map((r) => [
      r.nombre,
      r.telefono,
      r.correo,
      r.fuenteDetalle ? `${ETIQUETA_FUENTE[r.fuente] ?? r.fuente}: ${r.fuenteDetalle}` : (ETIQUETA_FUENTE[r.fuente] ?? r.fuente),
      new Date(r.creado).toLocaleString('es-VE'),
    ]),
  ]
  return '﻿' + filas.map((f) => f.map(celda).join(',')).join('\n')
}

export default function RegistrosEvento() {
  const router = useRouter()
  const [autorizado, setAutorizado] = useState<boolean | null>(null)
  const [registros, setRegistros] = useState<Registro[]>([])
  const [filtro, setFiltro] = useState('')

  useEffect(() => {
    let vigente = true
    const supabase = createClient()

    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (!vigente) return
      if (perfil?.role !== 'admin' && perfil?.role !== 'super_admin') {
        setAutorizado(false)
        return
      }
      setAutorizado(true)

      const { data } = await supabase
        .from('event_registrations')
        .select('id, full_name, phone, email, source, source_detail, created_at')
        .order('created_at', { ascending: false })
      if (!vigente) return

      setRegistros(
        (data ?? []).map((r) => ({
          id: r.id,
          nombre: r.full_name,
          telefono: r.phone,
          correo: r.email,
          fuente: r.source,
          fuenteDetalle: r.source_detail,
          creado: r.created_at,
        })),
      )
    }

    cargar()
    return () => { vigente = false }
  }, [router])

  function descargarCSV() {
    const blob = new Blob([aCSV(registros)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'registros-evento.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (autorizado === false) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg px-5 text-center">
        <p className="text-sm text-zr-text-muted">Esta pantalla es solo para Administración.</p>
      </div>
    )
  }

  if (autorizado === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando…</p>
      </div>
    )
  }

  const q = filtro.trim().toLowerCase()
  const visibles = q
    ? registros.filter((r) => `${r.nombre} ${r.telefono} ${r.correo}`.toLowerCase().includes(q))
    : registros

  return (
    <div className="space-y-8 px-5 pt-14 pb-10">
      <BotonVolver href="/panel" />

      <Encabezado
        sobretitulo="Administración"
        titulo="Registros del evento"
        descripcion={`${registros.length} persona${registros.length === 1 ? '' : 's'} confirmaron asistencia desde la página pública.`}
      />
      <Regla delay={60} />

      {registros.length === 0 ? (
        <EstadoVacio titulo="Todavía no hay registros" explicacion="Cuando alguien confirme desde el enlace /evento, aparecerá aquí." />
      ) : (
        <>
          <div className="flex gap-2">
            <input
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Buscar por nombre, teléfono o correo"
              className="min-w-0 flex-1 rounded-lg border border-zr-border bg-zr-surface px-4 py-3 text-sm text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
            />
            <button
              onClick={descargarCSV}
              className="shrink-0 rounded-lg border border-zr-blue/40 px-4 py-3 text-sm font-bold text-zr-blue-mid"
            >
              Descargar CSV
            </button>
          </div>

          <div className="space-y-2">
            {visibles.map((r) => (
              <div key={r.id} className="zr-card p-4">
                <p className="text-sm font-semibold text-zr-text">{r.nombre}</p>
                <p className="mt-1 text-xs tabular-nums text-zr-text-muted">
                  {r.telefono} · {r.correo}
                </p>
                <p className="mt-1 text-xs text-zr-text-muted">
                  {ETIQUETA_FUENTE[r.fuente] ?? r.fuente}
                  {r.fuenteDetalle ? `: ${r.fuenteDetalle}` : ''} ·{' '}
                  {new Date(r.creado).toLocaleString('es-VE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ))}
            {visibles.length === 0 && <p className="text-sm text-zr-text-muted">Nadie coincide con esa búsqueda.</p>}
          </div>
        </>
      )}
    </div>
  )
}

'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { APP_VERSION } from '@/lib/version'

/**
 * Registro liviano de errores (18-nov-2026): los errores inesperados del navegador
 * se guardan en `app_errors` (migración 219) para que el resumen semanal y el
 * super admin sepan cuántos hubo y cuál se repite. No guarda datos personales,
 * solo la ruta, el mensaje y la versión. Máximo 5 por sesión y sin repetir el mismo.
 */
export function ReportarErrores() {
  useEffect(() => {
    const enviados = new Set<string>()

    async function reportar(mensaje: string) {
      const texto = mensaje.slice(0, 300)
      if (!texto || enviados.has(texto) || enviados.size >= 5) return
      enviados.add(texto)
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        await supabase.from('app_errors' as never).insert({
          user_id: user.id,
          ruta: window.location.pathname,
          mensaje: texto,
          version: APP_VERSION,
        } as never)
      } catch { /* un fallo al reportar nunca debe causar otro error */ }
    }

    const alError = (e: ErrorEvent) => { void reportar(e.message || 'Error desconocido') }
    const alRechazo = (e: PromiseRejectionEvent) => {
      const r = e.reason
      void reportar(r instanceof Error ? r.message : typeof r === 'string' ? r : 'Promesa rechazada')
    }
    window.addEventListener('error', alError)
    window.addEventListener('unhandledrejection', alRechazo)
    return () => {
      window.removeEventListener('error', alError)
      window.removeEventListener('unhandledrejection', alRechazo)
    }
  }, [])

  return null
}

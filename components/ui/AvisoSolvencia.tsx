'use client'

import { IconoAviso } from '@/components/ui/Iconos'

/**
 * Avisos para el estudiante bloqueado por solvencia (pedido del coordinador,
 * oct. 2026). El número de administración viene de system_config
 * (finanzas.whatsapp_administracion), nunca escrito aquí.
 */

export const MENSAJE_NO_SOLVENTE =
  'No estás solvente con los pagos de tu mensualidad, por favor conversar con la administradora.'

function enlaceWhatsApp(numero: string): string {
  const texto = 'Hola, soy estudiante de ZR Mecademy y tengo un pago pendiente. Quisiera ponerme al día.'
  return `https://wa.me/${numero.replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`
}

/** Mensaje flotante, con el fondo desenfocado. */
export function ModalNoSolvente({ whatsapp, onEntendido }: { whatsapp: string | null; onEntendido: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-5 backdrop-blur-md"
      role="alertdialog"
      aria-modal="true"
      aria-label="Acceso bloqueado"
    >
      <div className="w-full max-w-sm space-y-5 rounded-2xl border border-zr-error/40 bg-zr-surface/85 p-6 text-center shadow-[0_16px_48px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-zr-error/15 text-zr-error">
          <IconoAviso size={30} />
        </div>
        <div className="space-y-2">
          <p className="zr-display text-2xl text-zr-text">Bloqueado</p>
          <p className="text-sm leading-relaxed text-zr-text-muted">{MENSAJE_NO_SOLVENTE}</p>
        </div>
        <div className="space-y-2.5">
          {whatsapp && (
            <a
              href={enlaceWhatsApp(whatsapp)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-12 w-full items-center justify-center rounded-lg bg-zr-success text-sm font-bold text-white"
            >
              Hablar con administración por WhatsApp
            </a>
          )}
          <button
            onClick={onEntendido}
            className="min-h-12 w-full rounded-lg border border-zr-border text-sm font-bold text-zr-text"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}

/** Advertencia fija arriba: se queda mientras siga no solvente, también en Perfil. */
export function BannerNoSolvente({ whatsapp }: { whatsapp: string | null }) {
  return (
    <div
      className="fixed left-3 right-16 z-[60] flex items-start gap-2 rounded-xl border border-zr-error/50 bg-zr-error/85 px-3 py-2 text-white shadow-lg backdrop-blur-md lg:absolute lg:left-8 lg:right-24 lg:top-8"
      style={{ top: 'calc(0.5rem + env(safe-area-inset-top))' }}
      role="status"
    >
      <IconoAviso size={18} className="mt-0.5 shrink-0" />
      <p className="text-xs leading-snug">
        <span className="font-bold">Pago pendiente.</span> Por favor comunícate con administración
        {whatsapp ? (
          <>
            {' '}a este contacto:{' '}
            <a href={enlaceWhatsApp(whatsapp)} target="_blank" rel="noopener noreferrer" className="font-bold underline">
              escribir por WhatsApp
            </a>
          </>
        ) : '.'}
      </p>
    </div>
  )
}

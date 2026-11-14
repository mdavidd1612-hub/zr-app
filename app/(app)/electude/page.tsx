'use client'

import { Encabezado } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'

const URL_SIMULADOR = 'https://simulator.electude.com/'

const PASOS = [
  { t: 'Entra sin cuenta', d: 'Abre el simulador y toca "Prueba el simulador de Electude". Entras directo al modo libre.' },
  { t: 'Mira los videos de adentro', d: 'En el menú (ícono de la llave) abre "Demo": introducción, navegación, osciloscopio y más.' },
  { t: 'Lee la orden de trabajo', d: 'Ahí está la queja del cliente. Es tu punto de partida, igual que en el taller.' },
  { t: 'Mide y diagnostica', d: 'Usa multímetro, osciloscopio y sistema de diagnóstico. Compara con el esquema eléctrico.' },
  { t: 'Repara y cierra', d: 'Reemplaza la pieza dañada, vuelve a probar y marca la avería como resuelta.' },
  { t: 'Trae tu resultado', d: 'Lleva tu diagnóstico y tus dudas a la clase del sábado para defenderlo.' },
]

export default function ElectudeSimulador() {
  return (
    <div className="min-h-dvh bg-zr-bg px-5 pb-28 pt-[calc(3.5rem+env(safe-area-inset-top))]">
      <div className="mx-auto max-w-2xl space-y-8">
        <BotonVolver href="/" />

        <Encabezado
          sobretitulo="Práctica de diagnóstico"
          titulo="Simulador Electude"
          descripcion="Un taller virtual gratis, en español y desde el teléfono, para diagnosticar antes de tocar el carro."
        />

        <a
          href={URL_SIMULADOR}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-14 w-full items-center justify-center rounded-full bg-zr-blue text-base font-bold text-white"
        >
          Abrir el simulador
        </a>

        <section className="space-y-4">
          <p className="zr-eyebrow">Cómo se usa</p>
          <ol className="space-y-3">
            {PASOS.map((p, i) => (
              <li key={p.t} className="zr-card flex gap-4 p-4">
                <span className="text-xl font-bold text-zr-blue">{i + 1}</span>
                <div>
                  <p className="text-sm font-bold text-zr-text">{p.t}</p>
                  <p className="mt-0.5 text-sm text-zr-text-muted">{p.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <p className="text-xs text-zr-text-muted">
          Es gratis. Asignar averías por estudiante y calificar automáticamente es de pago en Electude;
          el seguimiento lo lleva el profesor en la ZR App.
        </p>
      </div>
    </div>
  )
}

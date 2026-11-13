'use client'

import { Aviso } from '@/components/ui/Aviso'

export default function ElectudeSimulador() {

  return (
    <div className="wrap">
      <h1 className="mb-8 text-3xl font-bold">
        Simulador Electude ZR
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">

        {/* Opción 1: Entrar al simulador */}
        <Aviso tipo="exito">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-lg bg-zr-blue flex items-center justify-center shrink-0">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
                <path d="M3 3v18h18"/>
                <path d="M3 9h18"/>
              </svg>
            </div>
            <div>
              <h3 className="font-semibold">Entrar al Simulador</h3>
              <p className="text-sm text-muted-foreground">
                Practica diagnóstico virtual desde tu teléfono, en español y gratis.
              </p>
            </div>
          </div>
        </Aviso>

        {/* Opción 2: Guía rápida */}
        <Aviso tipo="advertencia">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-lg bg-zr-orange flex items-center justify-center shrink-0">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
                <line x1="9" y1="9" x2="9.01" y2="9"/>
                <line x1="15" y1="9" x2="15.01" y2="9"/>
              </svg>
            </div>
            <div>
              <h3 className="font-semibold">Guía Rápida</h3>
              <p className="text-sm text-muted-foreground">
                6 pasos para diagnosticar: entra, mira videos, lee la orden, mide y repara.
              </p>
            </div>
          </div>
        </Aviso>

      </div>

      <div className="mt-8 pt-8 border-t border-line">
        <Aviso tipo="error">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-lg bg-zr-error flex items-center justify-center shrink-0">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="15" x2="15" y2="9"/>
              </svg>
            </div>
            <div>
              <h3 className="font-semibold">Conexión con ZR Iagnosis</h3>
              <p className="text-sm text-muted-foreground">
                Después de practicar en el simulador, el diagnóstico se sincroniza con tu ficha en ZR App. El profesor marca la competencia al cerrar el ciclo.
              </p>
            </div>
          </div>
        </Aviso>
      </div>
    </div>
  )
}
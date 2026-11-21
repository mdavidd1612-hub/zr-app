'use client'

import { useRef, useState } from 'react'
import { leerPreguntasDeArchivo, type PreguntaImportada, type TipoPregunta } from '@/lib/importar-preguntas'
import { Etiqueta } from '@/components/ui/Editorial'

/**
 * Importar preguntas desde Word/Excel/CSV (pedido explícito del coordinador,
 * 8-nov-2026). El lector es una heurística, sobre todo para Word (texto
 * libre) -- por eso SIEMPRE se muestra esta pantalla de revisión antes de
 * agregar nada de verdad al examen. Nunca se importa en silencio.
 */

const ETIQUETA_TIPO: Record<TipoPregunta, string> = {
  opcion_multiple: 'Opción múltiple',
  verdadero_falso: 'Verdadero/falso',
  redaccion_abierta: 'Redacción',
}

interface Props {
  onImportar: (preguntas: PreguntaImportada[]) => void
  onCerrar: () => void
}

export function ImportarPreguntas({ onImportar, onCerrar }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preguntas, setPreguntas] = useState<PreguntaImportada[] | null>(null)

  async function elegirArchivo(archivo: File) {
    setError(null)
    setCargando(true)
    try {
      const leidas = await leerPreguntasDeArchivo(archivo)
      if (leidas.length === 0) {
        setError('No se encontró ninguna pregunta en el archivo. Revisa el formato.')
      } else {
        setPreguntas(leidas)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el archivo.')
    }
    setCargando(false)
  }

  function actualizar(i: number, cambios: Partial<PreguntaImportada>) {
    setPreguntas((qs) => qs!.map((q, idx) => (idx === i ? { ...q, ...cambios } : q)))
  }

  function quitar(i: number) {
    setPreguntas((qs) => qs!.filter((_, idx) => idx !== i))
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-5">
      <div className="zr-card max-h-[92dvh] w-full max-w-2xl space-y-5 overflow-y-auto rounded-t-2xl p-6 sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="zr-eyebrow">Importar preguntas</p>
            <p className="mt-1 text-sm text-zr-text-muted">Desde un Word (desarrollo) o Excel/CSV (opción múltiple).</p>
          </div>
          <button onClick={onCerrar} className="shrink-0 text-sm font-bold text-zr-text-muted">Cerrar</button>
        </div>

        {!preguntas && (
          <div className="space-y-4">
            <div className="rounded-lg border border-zr-border bg-zr-bg p-4 text-xs leading-relaxed text-zr-text-muted">
              <p className="mb-1 font-bold text-zr-text">Word (.docx):</p>
              <p className="mb-3">Una pregunta por línea, numerada: &quot;1. Explica cómo...&quot;. Si lleva opciones, debajo con &quot;a) ...&quot;, &quot;b) ...&quot; -- marca la correcta con un asterisco al final o una línea &quot;Respuesta: b&quot;. Sin opciones, se importa como pregunta de desarrollo.</p>
              <p className="mb-1 font-bold text-zr-text">Excel/CSV:</p>
              <p>Columnas: <code>tipo</code>, <code>enunciado</code>, <code>opcion_a</code>...<code>opcion_d</code>, <code>correcta</code>, <code>puntos</code>.</p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".docx,.xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) elegirArchivo(f) }}
            />
            <button
              onClick={() => inputRef.current?.click()}
              disabled={cargando}
              className="flex min-h-14 w-full items-center justify-center rounded-lg bg-zr-blue text-base font-bold text-white disabled:opacity-50"
            >
              {cargando ? 'Leyendo…' : 'Elegir archivo'}
            </button>
            {error && <p className="text-sm text-zr-error">{error}</p>}
          </div>
        )}

        {preguntas && (
          <div className="space-y-5">
            <p className="text-sm font-semibold text-zr-text">
              Se leyeron {preguntas.length} pregunta{preguntas.length === 1 ? '' : 's'}. Revisa cada una antes de agregarlas -- el lector puede equivocarse, sobre todo con la respuesta correcta.
            </p>

            <div className="space-y-4">
              {preguntas.map((p, i) => (
                <div key={i} className="space-y-3 rounded-lg border border-zr-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <select
                      value={p.type}
                      onChange={(e) => actualizar(i, { type: e.target.value as TipoPregunta, options: e.target.value === 'opcion_multiple' ? (p.options ?? [{ key: 'a', text: '' }, { key: 'b', text: '' }]) : undefined })}
                      className="min-h-9 rounded-lg border border-zr-border bg-zr-bg px-2 text-xs font-bold text-zr-text"
                    >
                      {Object.entries(ETIQUETA_TIPO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                    </select>
                    <button onClick={() => quitar(i)} className="text-xs font-bold text-zr-error">Quitar</button>
                  </div>

                  {p.advertencia && <Etiqueta tono="aviso">{p.advertencia}</Etiqueta>}

                  <textarea
                    value={p.statement}
                    onChange={(e) => actualizar(i, { statement: e.target.value })}
                    rows={2}
                    className="w-full rounded-lg border border-zr-border bg-zr-bg px-3 py-2 text-sm text-zr-text"
                  />

                  {p.type === 'opcion_multiple' && (
                    <div className="space-y-2">
                      {(p.options ?? []).map((o, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`correcta-${i}`}
                            checked={(p.correct_answer as { key?: string } | null)?.key === o.key}
                            onChange={() => actualizar(i, { correct_answer: { key: o.key }, advertencia: null })}
                          />
                          <input
                            value={o.text}
                            onChange={(e) => {
                              const nuevas = (p.options ?? []).map((x, xi) => xi === oi ? { ...x, text: e.target.value } : x)
                              actualizar(i, { options: nuevas })
                            }}
                            placeholder={`Opción ${o.key}`}
                            className="min-h-9 flex-1 rounded-lg border border-zr-border bg-zr-bg px-3 text-sm text-zr-text"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {p.type === 'verdadero_falso' && (
                    <div className="flex gap-4 text-sm">
                      <label className="flex items-center gap-1.5">
                        <input
                          type="radio"
                          name={`vf-${i}`}
                          checked={(p.correct_answer as { value?: boolean } | null)?.value === true}
                          onChange={() => actualizar(i, { correct_answer: { value: true }, advertencia: null })}
                        />
                        Verdadero
                      </label>
                      <label className="flex items-center gap-1.5">
                        <input
                          type="radio"
                          name={`vf-${i}`}
                          checked={(p.correct_answer as { value?: boolean } | null)?.value === false}
                          onChange={() => actualizar(i, { correct_answer: { value: false }, advertencia: null })}
                        />
                        Falso
                      </label>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-zr-text-muted">Puntos</label>
                    <input
                      type="number"
                      min={0}
                      value={p.points}
                      onChange={(e) => actualizar(i, { points: Number(e.target.value) || 0 })}
                      className="min-h-9 w-20 rounded-lg border border-zr-border bg-zr-bg px-2 text-sm tabular-nums text-zr-text"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setPreguntas(null)}
                className="flex-1 rounded-lg border border-zr-border px-4 py-3 text-sm font-semibold text-zr-text"
              >
                Elegir otro archivo
              </button>
              <button
                onClick={() => onImportar(preguntas)}
                disabled={preguntas.length === 0}
                className="flex-1 rounded-lg bg-zr-blue px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
              >
                Agregar {preguntas.length} pregunta{preguntas.length === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

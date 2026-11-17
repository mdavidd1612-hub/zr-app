'use client'

import { useState } from 'react'
import { InputNota } from '@/components/ui/InputNota'
import { llamarAsistente } from '@/lib/asistente-examenes'

interface Option {
  key: string
  text: string
}

/** Lo que devuelve el editor. Los formatos de `options` y `correct_answer`
 *  son los de spec/02_CONTRATOS.md §1 y no se inventan aquí. */
export interface PreguntaNueva {
  type: 'opcion_multiple' | 'verdadero_falso' | 'redaccion_abierta'
  statement: string
  points: number
  options?: Option[]
  correct_answer: { key: string } | { value: boolean } | { text: string } | null
  rubric?: string | null
}

interface QuestionEditorProps {
  type: PreguntaNueva['type']
  onSave: (data: PreguntaNueva) => void
  onCancel: () => void
  initialData?: Partial<PreguntaNueva>
  modoEdicion?: boolean
}

export function QuestionEditor({ type, onSave, onCancel, initialData, modoEdicion }: QuestionEditorProps) {
  const [statement, setStatement] = useState(initialData?.statement ?? '')
  const [points, setPoints] = useState(initialData?.points ?? 1)
  const [rubric, setRubric] = useState(
    typeof initialData?.rubric === 'string' ? initialData.rubric : ''
  )

  // Redacción: respuesta modelo del profesor (la usa la IA para sugerir la nota).
  const [modelo, setModelo] = useState(() => {
    const ca = initialData?.correct_answer as unknown
    return ca && typeof ca === 'object' && 'text' in ca ? String((ca as { text: string }).text) : ''
  })
  const [pensando, setPensando] = useState(false)
  const [avisoIA, setAvisoIA] = useState<string | null>(null)

  // Multiple choice — normaliza correct_answer que puede venir como { key }
  // (desde QuestionEditor) o como string "A" (desde importarPdf)
  const resolverOpcionInicial = (): string => {
    const ca = initialData?.correct_answer as unknown
    if (!ca) return 'a'
    if (typeof ca === 'string') return ca.toLowerCase()
    if (typeof ca === 'object' && ca !== null && 'key' in ca) return (ca as { key: string }).key.toLowerCase()
    return 'a'
  }

  const [options, setOptions] = useState<Option[]>(
    initialData?.options && initialData.options.length > 0
      ? initialData.options
      : [{ key: 'a', text: '' }, { key: 'b', text: '' }]
  )
  const [correctOption, setCorrectOption] = useState(resolverOpcionInicial)

  // True/False — normaliza correct_answer que puede ser { value: bool } o bool
  const resolverVFInicial = (): boolean => {
    const ca = initialData?.correct_answer
    if (ca === null || ca === undefined) return true
    if (typeof ca === 'boolean') return ca
    if (typeof ca === 'object' && 'value' in ca) return !!(ca as { value: boolean }).value
    return true
  }

  const [correctValue, setCorrectValue] = useState(resolverVFInicial)

  // IA (solo sugiere; el profesor revisa y edita todo antes de guardar).
  async function sugerirOpciones() {
    const correcta = options.find((o) => o.key === correctOption)?.text.trim() ?? ''
    if (!statement.trim() || !correcta) {
      setAvisoIA('Escribe la pregunta y la opción correcta (marcada con el círculo) y luego pide las sugerencias.')
      return
    }
    setPensando(true); setAvisoIA(null)
    const cantidad = Math.max(3, options.length - 1)
    const { datos, mensaje } = await llamarAsistente<{ opciones: string[] }>({ modo: 'opciones', enunciado: statement, correcta, cantidad })
    setPensando(false)
    if (!datos) { setAvisoIA(mensaje); return }
    const incorrectas = datos.opciones.filter(Boolean)
    // La correcta se queda en su letra; las demás se rellenan con las sugerencias.
    const total = Math.min(6, Math.max(options.length, incorrectas.length + 1))
    let k = 0
    setOptions(Array.from({ length: total }, (_, i) => {
      const key = String.fromCharCode(97 + i)
      if (key === correctOption) return { key, text: correcta }
      return { key, text: incorrectas[k++] ?? options[i]?.text ?? '' }
    }))
    setAvisoIA('Sugerencias de la IA: léelas y cámbialas si hace falta.')
  }

  async function sugerirRubrica() {
    if (!statement.trim()) { setAvisoIA('Escribe la pregunta primero.'); return }
    setPensando(true); setAvisoIA(null)
    const { datos, mensaje } = await llamarAsistente<{ rubrica: string }>({ modo: 'rubrica', enunciado: statement, respuestaModelo: modelo, puntos: points })
    setPensando(false)
    if (!datos) { setAvisoIA(mensaje); return }
    setRubric(datos.rubrica)
    setAvisoIA('Rúbrica sugerida por la IA: revísala y ajústala.')
  }

  function handleAddOption() {
    if (options.length < 6) {
      const nextKey = String.fromCharCode(97 + options.length) // a, b, c, d, e, f
      setOptions([...options, { key: nextKey, text: '' }])
    }
  }

  function handleRemoveOption(idx: number) {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== idx))
    }
  }

  function handleUpdateOption(idx: number, text: string) {
    const updated = [...options]
    updated[idx].text = text
    setOptions(updated)
  }

  function handleSave() {
    if (!statement.trim()) {
      alert('Escribe el enunciado de la pregunta')
      return
    }

    if (type === 'opcion_multiple') {
      if (options.some((opt) => !opt.text.trim())) {
        alert('Todas las opciones deben tener texto')
        return
      }

      onSave({
        type,
        statement,
        points,
        options,
        correct_answer: { key: correctOption },
      })
    } else if (type === 'verdadero_falso') {
      onSave({
        type,
        statement,
        points,
        correct_answer: { value: correctValue },
      })
    } else if (type === 'redaccion_abierta') {
      onSave({
        type,
        statement,
        points,
        rubric: rubric.trim() || null,
        // Respuesta modelo: solo la ve el personal (la vista del estudiante no
        // trae correct_answer) y ayuda a la IA a sugerir la nota.
        correct_answer: modelo.trim() ? { text: modelo.trim() } : null,
      })
    }
  }

  return (
    <div className="space-y-6 bg-zr-surface border border-zr-border rounded-lg p-5">
      {/* Enunciado */}
      <div>
        <label className="block text-sm font-semibold text-zr-text mb-2">Enunciado de la pregunta</label>
        <textarea
          value={statement}
          onChange={(e) => setStatement(e.target.value)}
          placeholder="Escribe la pregunta..."
          className="w-full min-h-20 px-4 py-3 bg-zr-background border border-zr-border rounded-lg text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none resize-none"
        />
      </div>

      {/* Puntos */}
      <div>
        <label className="block text-sm font-semibold text-zr-text mb-2">Puntos</label>
        <InputNota value={points} onChange={(v) => setPoints(v === '' ? 1 : Math.max(0.01, v))} min={0.01} className="w-full px-4 py-3 bg-zr-background border border-zr-border rounded-lg text-zr-text focus:border-zr-blue focus:outline-none" />
      </div>

      {/* Opción Múltiple */}
      {type === 'opcion_multiple' && (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-zr-text">Opciones (2-6)</p>
          <div className="space-y-3">
            {options.map((option, idx) => (
              <div key={option.key} className="flex gap-3 items-start">
                <div className="flex items-center gap-2 mt-3">
                  <input
                    type="radio"
                    name="correct"
                    value={option.key}
                    checked={correctOption === option.key}
                    onChange={(e) => setCorrectOption(e.target.value)}
                    className="w-4 h-4 cursor-pointer"
                  />
                  <span className="text-sm font-bold text-zr-text-muted">{option.key.toUpperCase()}</span>
                </div>
                <input
                  type="text"
                  value={option.text}
                  onChange={(e) => handleUpdateOption(idx, e.target.value)}
                  placeholder={`Opción ${option.key.toUpperCase()}`}
                  className="flex-1 px-4 py-3 bg-zr-background border border-zr-border rounded-lg text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
                />
                {options.length > 2 && (
                  <button
                    onClick={() => handleRemoveOption(idx)}
                    className="text-zr-error hover:text-zr-error/80 font-semibold text-sm mt-3"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={sugerirOpciones}
            disabled={pensando}
            className="text-sm px-4 py-2 bg-zr-blue/10 border border-zr-blue/30 text-zr-blue-mid rounded-lg font-semibold disabled:opacity-50"
          >
            {pensando ? 'Pensando…' : '✨ Sugerir opciones incorrectas con IA'}
          </button>
          {avisoIA && <p className="text-xs text-zr-text-muted">{avisoIA}</p>}
          {options.length < 6 && (
            <button
              onClick={handleAddOption}
              className="text-sm px-4 py-2 bg-zr-background border border-zr-border text-zr-blue rounded-lg hover:bg-zr-blue/5 transition-all"
            >
              + Agregar opción
            </button>
          )}
        </div>
      )}

      {/* Verdadero/Falso */}
      {type === 'verdadero_falso' && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-zr-text">Respuesta correcta</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setCorrectValue(true)}
              className={`p-4 rounded-lg border-2 font-semibold transition-all ${
                correctValue
                  ? 'border-zr-success bg-zr-success/10 text-zr-success'
                  : 'border-zr-border bg-zr-background text-zr-text hover:border-zr-success/50'
              }`}
            >
              Verdadero
            </button>
            <button
              onClick={() => setCorrectValue(false)}
              className={`p-4 rounded-lg border-2 font-semibold transition-all ${
                !correctValue
                  ? 'border-zr-error bg-zr-error/10 text-zr-error'
                  : 'border-zr-border bg-zr-background text-zr-text hover:border-zr-error/50'
              }`}
            >
              Falso
            </button>
          </div>
        </div>
      )}

      {/* Redacción Abierta */}
      {type === 'redaccion_abierta' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-zr-text mb-2">
              Respuesta modelo (opcional, solo la ve el profesor)
            </label>
            <textarea
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
              placeholder="Cómo debería responder un estudiante que domina el tema..."
              className="w-full min-h-24 px-4 py-3 bg-zr-background border border-zr-border rounded-lg text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none resize-none"
            />
          </div>
          <label className="block text-sm font-semibold text-zr-text">
            Rúbrica (guía de corrección)
          </label>
          <textarea
            value={rubric}
            onChange={(e) => setRubric(e.target.value)}
            placeholder="Describe los criterios para calificar esta respuesta..."
            className="w-full min-h-24 px-4 py-3 bg-zr-background border border-zr-border rounded-lg text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none resize-none"
          />
          <button
            type="button"
            onClick={sugerirRubrica}
            disabled={pensando}
            className="text-sm px-4 py-2 bg-zr-blue/10 border border-zr-blue/30 text-zr-blue-mid rounded-lg font-semibold disabled:opacity-50"
          >
            {pensando ? 'Pensando…' : '✨ Sugerir rúbrica con IA'}
          </button>
          {avisoIA && <p className="text-xs text-zr-text-muted">{avisoIA}</p>}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-zr-border">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-3 bg-zr-border text-zr-text rounded-lg font-semibold hover:bg-zr-border/80 transition-all"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          className="flex-1 px-4 py-3 bg-zr-success text-white rounded-lg font-semibold hover:bg-zr-success/90 transition-all"
        >
          {modoEdicion ? 'Guardar cambios' : 'Guardar pregunta'}
        </button>
      </div>
    </div>
  )
}

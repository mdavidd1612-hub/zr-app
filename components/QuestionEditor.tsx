'use client'

import { useState } from 'react'

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
  correct_answer: { key: string } | { value: boolean } | null
  rubric?: string | null
}

interface QuestionEditorProps {
  type: PreguntaNueva['type']
  onSave: (data: PreguntaNueva) => void
  onCancel: () => void
}

export function QuestionEditor({ type, onSave, onCancel }: QuestionEditorProps) {
  const [statement, setStatement] = useState('')
  const [points, setPoints] = useState(1)
  const [rubric, setRubric] = useState('')

  // Multiple choice
  const [options, setOptions] = useState<Option[]>([
    { key: 'a', text: '' },
    { key: 'b', text: '' },
  ])
  const [correctOption, setCorrectOption] = useState('a')

  // True/False
  const [correctValue, setCorrectValue] = useState(true)

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
        correct_answer: null,
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
        <input
          type="number"
          value={points}
          onChange={(e) => setPoints(Math.max(1, parseInt(e.target.value) || 1))}
          min="1"
          className="w-full px-4 py-3 bg-zr-background border border-zr-border rounded-lg text-zr-text focus:border-zr-blue focus:outline-none"
        />
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
        <div>
          <label className="block text-sm font-semibold text-zr-text mb-2">
            Rúbrica (guía de corrección)
          </label>
          <textarea
            value={rubric}
            onChange={(e) => setRubric(e.target.value)}
            placeholder="Describe los criterios para calificar esta respuesta..."
            className="w-full min-h-24 px-4 py-3 bg-zr-background border border-zr-border rounded-lg text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none resize-none"
          />
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
          Guardar Pregunta
        </button>
      </div>
    </div>
  )
}

// API route — transcribe un PDF de examen usando NVIDIA NIM.
// La key nunca sale del servidor. El cliente solo sube el archivo y recibe
// preguntas estructuradas listas para poblar el editor de examen.

import { NextRequest, NextResponse } from 'next/server'
// pdf-parse no tiene export default en sus tipos; se importa así:
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse')

const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions'
const MODEL = 'meta/llama-3.3-70b-instruct'

const SYSTEM_PROMPT = `Eres un asistente que convierte exámenes escritos en formato JSON estructurado.
El usuario te enviará el texto de un examen. Tu tarea es identificar cada pregunta y devolver un JSON válido con esta estructura exacta:

{
  "preguntas": [
    {
      "type": "opcion_multiple" | "verdadero_falso" | "redaccion_abierta",
      "statement": "Texto completo de la pregunta",
      "points": número (reparte los puntos equitativamente; si hay 5 preguntas y el máximo es 20 → 4 pts cada una),
      "options": [
        { "key": "A", "text": "..." },
        { "key": "B", "text": "..." }
      ],
      "correct_answer": "A" | true | false | null,
      "rubric": "Criterios de evaluación para respuesta abierta" | null
    }
  ],
  "titulo_sugerido": "Nombre detectado del examen o null",
  "instrucciones_sugeridas": "Instrucciones detectadas o null"
}

Reglas:
- "opcion_multiple": tiene 2-6 opciones (key: A, B, C…), correct_answer es la key de la correcta (ej: "B").
- "verdadero_falso": options = [{key:"V",text:"Verdadero"},{key:"F",text:"Falso"}], correct_answer es true o false.
- "redaccion_abierta": options = null, correct_answer = null, rubric explica cómo evaluarla.
- Si no puedes determinar la respuesta correcta, pon correct_answer: null.
- Devuelve SOLO el JSON, sin texto adicional, sin markdown, sin explicaciones.`

export async function POST(req: NextRequest) {
  const key = process.env.NVIDIA_API_KEY
  if (!key) {
    return NextResponse.json({ error: 'Servicio de IA no configurado' }, { status: 503 })
  }

  let text: string
  try {
    const form = await req.formData()
    const file = form.get('pdf') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 })
    }
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'El archivo debe ser un PDF' }, { status: 400 })
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'El PDF no puede superar 10 MB' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const parsed = await pdfParse(buffer)
    text = (parsed.text as string).trim()

    if (!text || text.length < 30) {
      return NextResponse.json({ error: 'No se pudo extraer texto del PDF. ¿Es un PDF escaneado?' }, { status: 422 })
    }
    // Limitar a 12 000 caracteres para no exceder el contexto del modelo
    if (text.length > 12000) text = text.slice(0, 12000)
  } catch {
    return NextResponse.json({ error: 'Error al leer el PDF' }, { status: 400 })
  }

  let nimResponse: Response
  try {
    nimResponse = await fetch(NVIDIA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Aquí está el texto del examen:\n\n${text}` },
        ],
        temperature: 0.1,
        max_tokens: 4096,
      }),
    })
  } catch {
    return NextResponse.json({ error: 'No se pudo conectar con el servicio de IA' }, { status: 502 })
  }

  if (!nimResponse.ok) {
    const errBody = await nimResponse.text().catch(() => '')
    console.error('NVIDIA NIM error:', nimResponse.status, errBody)
    return NextResponse.json({ error: 'Error del servicio de IA. Intenta de nuevo.' }, { status: 502 })
  }

  const nimData = await nimResponse.json()
  const contenido: string = nimData?.choices?.[0]?.message?.content ?? ''

  // El modelo a veces envuelve el JSON en ```json … ``` — limpiarlo
  const limpio = contenido.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

  let resultado: unknown
  try {
    resultado = JSON.parse(limpio)
  } catch {
    console.error('JSON inválido del modelo:', limpio.slice(0, 500))
    return NextResponse.json({ error: 'La IA no devolvió un formato válido. Intenta con otro PDF.' }, { status: 422 })
  }

  return NextResponse.json(resultado)
}

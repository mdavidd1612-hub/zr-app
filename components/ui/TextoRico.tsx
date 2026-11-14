'use client'

import { Fragment, useRef, type ReactNode } from 'react'

// Texto con formato sencillo para los bloques de texto de una unidad.
// Se guarda como texto plano (content_items.description) con marcas simples y
// se dibuja con elementos de React -- nunca como HTML, así que no hay riesgo de
// inyección. Marcas: **negrita**, *cursiva*, [texto](https://enlace),
// {rojo|texto} (también amarillo, verde, azul, grande, peq), y al inicio de
// línea: "# " título, "## " subtítulo, "- " viñeta, "1. " lista numerada.

const COLORES: Record<string, string> = {
  rojo: '#f87171',
  amarillo: '#fbbf24',
  verde: '#34d399',
  azul: '#60a5fa',
}

const TOKEN = /\*\*([\s\S]+?)\*\*|\*([\s\S]+?)\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\{(rojo|amarillo|verde|azul|grande|peq)\|([\s\S]+?)\}/

function inline(texto: string, k = 'i'): ReactNode[] {
  const out: ReactNode[] = []
  let resto = texto
  let n = 0
  while (resto) {
    const m = TOKEN.exec(resto)
    if (!m) { out.push(resto); break }
    if (m.index > 0) out.push(resto.slice(0, m.index))
    const key = `${k}${n++}`
    if (m[1] !== undefined) out.push(<strong key={key} className="font-bold text-zr-text">{inline(m[1], key)}</strong>)
    else if (m[2] !== undefined) out.push(<em key={key}>{inline(m[2], key)}</em>)
    else if (m[3] !== undefined) {
      out.push(
        <a key={key} href={m[4]} target="_blank" rel="noopener noreferrer" className="font-semibold text-zr-blue underline">
          {m[3]}
        </a>,
      )
    } else {
      const clave = m[5]
      const cuerpo = inline(m[6], key)
      if (COLORES[clave]) out.push(<span key={key} style={{ color: COLORES[clave] }} className="font-semibold">{cuerpo}</span>)
      else if (clave === 'grande') out.push(<span key={key} className="text-lg font-bold text-zr-text">{cuerpo}</span>)
      else out.push(<span key={key} className="text-xs">{cuerpo}</span>)
    }
    resto = resto.slice(m.index + m[0].length)
  }
  return out
}

export function TextoRico({ texto }: { texto: string }) {
  const lineas = texto.split('\n')
  const bloques: ReactNode[] = []
  let lista: { tipo: 'ul' | 'ol'; items: string[] } | null = null
  const cerrarLista = () => {
    if (!lista) return
    const L = lista
    const Tag = L.tipo
    bloques.push(
      <Tag key={`l${bloques.length}`} className={`ml-5 space-y-1 ${L.tipo === 'ul' ? 'list-disc' : 'list-decimal'}`}>
        {L.items.map((t, i) => <li key={i}>{inline(t, `li${i}`)}</li>)}
      </Tag>,
    )
    lista = null
  }
  lineas.forEach((l, idx) => {
    const ul = /^[-•]\s+(.*)$/.exec(l)
    const ol = /^\d+[.)]\s+(.*)$/.exec(l)
    if (ul || ol) {
      const tipo = ul ? 'ul' : 'ol'
      if (lista && lista.tipo !== tipo) cerrarLista()
      if (!lista) lista = { tipo, items: [] }
      lista.items.push((ul ?? ol)![1])
      return
    }
    cerrarLista()
    if (l.trim() === '') { bloques.push(<div key={`b${idx}`} className="h-2" />); return }
    const h1 = /^#\s+(.*)$/.exec(l)
    const h2 = /^##\s+(.*)$/.exec(l)
    if (h2) bloques.push(<p key={`b${idx}`} className="pt-1 text-base font-bold text-zr-text">{inline(h2[1], `h${idx}`)}</p>)
    else if (h1) bloques.push(<p key={`b${idx}`} className="pt-1 text-xl font-bold text-zr-text">{inline(h1[1], `h${idx}`)}</p>)
    else bloques.push(<p key={`b${idx}`}>{inline(l, `p${idx}`)}</p>)
  })
  cerrarLista()
  return (
    <div className="space-y-1 break-words text-sm leading-relaxed text-zr-text-muted">
      {bloques.map((b, i) => <Fragment key={i}>{b}</Fragment>)}
    </div>
  )
}

// Editor: cuadro de texto con barra de formato y vista previa en vivo.
export function EditorTextoRico({
  value, onChange, placeholder, acento, rows = 6,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  acento: string
  rows?: number
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  function envolver(antes: string, despues: string, ejemplo: string) {
    const ta = ref.current
    if (!ta) return
    const { selectionStart: a, selectionEnd: b } = ta
    const sel = value.slice(a, b) || ejemplo
    const nuevo = value.slice(0, a) + antes + sel + despues + value.slice(b)
    onChange(nuevo)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(a + antes.length, a + antes.length + sel.length)
    })
  }

  function prefijo(p: string) {
    const ta = ref.current
    if (!ta) return
    const a = value.lastIndexOf('\n', ta.selectionStart - 1) + 1
    onChange(value.slice(0, a) + p + value.slice(a))
    requestAnimationFrame(() => ta.focus())
  }

  function enlace() {
    const url = window.prompt('Pega el enlace (debe empezar con https://)')
    if (url && /^https?:\/\//.test(url)) envolver('[', `](${url})`, 'texto del enlace')
  }

  const Btn = ({ children, onClick, titulo }: { children: ReactNode; onClick: () => void; titulo: string }) => (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      onClick={onClick}
      className="flex h-9 min-w-9 items-center justify-center rounded-lg border border-zr-border bg-zr-surface px-2 text-sm font-bold text-zr-text"
    >
      {children}
    </button>
  )

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <Btn titulo="Negrita" onClick={() => envolver('**', '**', 'texto')}>B</Btn>
        <Btn titulo="Cursiva" onClick={() => envolver('*', '*', 'texto')}><span className="italic">I</span></Btn>
        <Btn titulo="Título grande" onClick={() => prefijo('# ')}>T1</Btn>
        <Btn titulo="Subtítulo" onClick={() => prefijo('## ')}>T2</Btn>
        <Btn titulo="Viñetas" onClick={() => prefijo('- ')}>•</Btn>
        <Btn titulo="Lista numerada" onClick={() => prefijo('1. ')}>1.</Btn>
        <Btn titulo="Enlace" onClick={enlace}>🔗</Btn>
        <Btn titulo="Letra grande" onClick={() => envolver('{grande|', '}', 'texto')}>A+</Btn>
        <Btn titulo="Letra pequeña" onClick={() => envolver('{peq|', '}', 'texto')}><span className="text-xs">A-</span></Btn>
        {(['rojo', 'amarillo', 'verde', 'azul'] as const).map((c) => (
          <button
            key={c}
            type="button"
            title={`Color ${c}`}
            aria-label={`Color ${c}`}
            onClick={() => envolver(`{${c}|`, '}', 'texto')}
            className="h-9 w-9 rounded-lg border border-zr-border"
            style={{ backgroundColor: COLORES[c] }}
          />
        ))}
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-lg border border-zr-border bg-zr-surface px-4 py-3 text-sm text-zr-text outline-none focus:border-zr-blue"
      />
      {value.trim() && (
        <div style={{ borderColor: acento }} className="rounded-lg border border-dashed p-3">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-zr-text-muted">Así lo verá el estudiante</p>
          <TextoRico texto={value} />
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import DOMPurify from 'dompurify'

// Texto con formato para los bloques de texto de una unidad.
//
// El profesor lo escribe en un editor visual (como Word): lo que ve mientras
// escribe es lo que verá el estudiante, sin marcas ni código. Se guarda como
// HTML sencillo en content_items.description, siempre limpiado con DOMPurify
// (solo etiquetas de formato, sin scripts ni estilos arbitrarios).
//
// Los bloques escritos antes de este editor están en texto plano con marcas
// (**negrita**, {rojo|texto}, "# título"...). Se siguen mostrando bien: si el
// texto no parece HTML, se convierte con `marcasAHtml`.

const COLORES: Record<string, string> = {
  rojo: '#f87171',
  amarillo: '#fbbf24',
  verde: '#34d399',
  azul: '#60a5fa',
}

let ganchoListo = false
function limpiar(html: string): string {
  if (typeof window === 'undefined' || !DOMPurify.isSupported) return ''
  if (!ganchoListo) {
    DOMPurify.addHook('afterSanitizeAttributes', (nodo) => {
      if (nodo.tagName === 'A') {
        nodo.setAttribute('target', '_blank')
        nodo.setAttribute('rel', 'noopener noreferrer')
      }
    })
    ganchoListo = true
  }
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 'h1', 'h2', 'h3', 'p', 'div', 'br', 'ul', 'ol', 'li', 'a', 'font', 'span'],
    ALLOWED_ATTR: ['href', 'color', 'size', 'target', 'rel'],
  })
}

function esc(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const pareceHtml = (t: string) => /^\s*<(p|div|h[1-3]|ul|ol|b|i|u|strong|em|font|span|br|a)[\s>/]/i.test(t)

// Convierte las marcas antiguas a HTML para mostrarlas y editarlas.
export function marcasAHtml(texto: string): string {
  const inline = (t: string) =>
    esc(t)
      .replace(/\*\*([\s\S]+?)\*\*/g, '<b>$1</b>')
      .replace(/\*([\s\S]+?)\*/g, '<i>$1</i>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>')
      .replace(/\{(rojo|amarillo|verde|azul)\|([\s\S]+?)\}/g, (_m, c: string, x: string) => `<font color="${COLORES[c]}">${x}</font>`)
      .replace(/\{grande\|([\s\S]+?)\}/g, '<font size="5">$1</font>')
      .replace(/\{peq\|([\s\S]+?)\}/g, '<font size="2">$1</font>')
  const out: string[] = []
  let lista: 'ul' | 'ol' | null = null
  const cerrar = () => { if (lista) { out.push(`</${lista}>`); lista = null } }
  for (const l of texto.split('\n')) {
    const ul = /^[-•]\s+(.*)$/.exec(l)
    const ol = /^\d+[.)]\s+(.*)$/.exec(l)
    if (ul || ol) {
      const t = ul ? 'ul' : 'ol'
      if (lista !== t) { cerrar(); out.push(`<${t}>`); lista = t }
      out.push(`<li>${inline((ul ?? ol)![1])}</li>`)
      continue
    }
    cerrar()
    const h2 = /^##\s+(.*)$/.exec(l)
    const h1 = /^#\s+(.*)$/.exec(l)
    if (h2) out.push(`<h2>${inline(h2[1])}</h2>`)
    else if (h1) out.push(`<h1>${inline(h1[1])}</h1>`)
    else if (l.trim() === '') out.push('<br>')
    else out.push(`<div>${inline(l)}</div>`)
  }
  cerrar()
  return out.join('')
}

const aHtml = (t: string) => (pareceHtml(t) ? t : marcasAHtml(t))

const ESTILO_CONTENIDO =
  'break-words [&_a]:font-semibold [&_a]:text-zr-blue [&_a]:underline [&_b]:font-bold [&_strong]:font-bold [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-zr-text [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-zr-text [&_ul]:ml-5 [&_ul]:list-disc [&_ol]:ml-5 [&_ol]:list-decimal [&_li]:my-0.5'

export function TextoRico({ texto }: { texto: string }) {
  return (
    <div
      className={`text-sm leading-relaxed text-zr-text-muted ${ESTILO_CONTENIDO}`}
      dangerouslySetInnerHTML={{ __html: limpiar(aHtml(texto)) }}
    />
  )
}

// Editor visual: se escribe y se da formato como en Word, sin ver código.
export function EditorTextoRico({
  value, onChange, placeholder, acento, rows = 6,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  acento: string
  rows?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const ultimo = useRef<string | null>(null)

  // Solo se vuelca el valor al editor cuando cambió desde afuera (abrir un
  // bloque para editarlo, o vaciarlo al guardar); si no, se pisaría el cursor.
  useEffect(() => {
    const el = ref.current
    if (!el || value === ultimo.current) return
    el.innerHTML = limpiar(aHtml(value))
    ultimo.current = value
  }, [value])

  function emitir() {
    const el = ref.current
    if (!el) return
    const vacio = (el.textContent ?? '').trim() === ''
    const html = vacio ? '' : limpiar(el.innerHTML)
    ultimo.current = html
    onChange(html)
  }

  function ejecutar(cmd: string, arg?: string) {
    ref.current?.focus()
    document.execCommand('styleWithCSS', false, 'false')
    document.execCommand(cmd, false, arg)
    emitir()
  }

  function enlace() {
    const url = window.prompt('Pega el enlace (debe empezar con https://)')
    if (url && /^https?:\/\//.test(url)) ejecutar('createLink', url)
  }

  const Btn = ({ children, onClick, titulo, ancho }: { children: ReactNode; onClick: () => void; titulo: string; ancho?: string }) => (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      // mouseDown (no click): así el texto seleccionado no pierde la selección.
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      className={`flex h-10 min-w-10 items-center justify-center rounded-lg border border-zr-border bg-zr-surface px-2 text-sm font-bold text-zr-text ${ancho ?? ''}`}
    >
      {children}
    </button>
  )

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <Btn titulo="Negrita" onClick={() => ejecutar('bold')}>B</Btn>
        <Btn titulo="Cursiva" onClick={() => ejecutar('italic')}><span className="italic">I</span></Btn>
        <Btn titulo="Subrayado" onClick={() => ejecutar('underline')}><span className="underline">U</span></Btn>
        <Btn titulo="Título" onClick={() => ejecutar('formatBlock', 'H1')}>Título</Btn>
        <Btn titulo="Subtítulo" onClick={() => ejecutar('formatBlock', 'H2')}>Subtítulo</Btn>
        <Btn titulo="Texto normal" onClick={() => ejecutar('formatBlock', 'DIV')}>Normal</Btn>
        <Btn titulo="Viñetas" onClick={() => ejecutar('insertUnorderedList')}>• Lista</Btn>
        <Btn titulo="Lista numerada" onClick={() => ejecutar('insertOrderedList')}>1. Lista</Btn>
        <Btn titulo="Enlace" onClick={enlace}>Enlace</Btn>
        <Btn titulo="Letra grande" onClick={() => ejecutar('fontSize', '5')}>A+</Btn>
        <Btn titulo="Letra pequeña" onClick={() => ejecutar('fontSize', '2')}><span className="text-xs">A-</span></Btn>
        {(['rojo', 'amarillo', 'verde', 'azul'] as const).map((c) => (
          <button
            key={c}
            type="button"
            title={`Color ${c}`}
            aria-label={`Color ${c}`}
            onMouseDown={(e) => { e.preventDefault(); ejecutar('foreColor', COLORES[c]) }}
            className="h-10 w-10 rounded-lg border border-zr-border"
            style={{ backgroundColor: COLORES[c] }}
          />
        ))}
        <Btn titulo="Quitar formato" onClick={() => ejecutar('removeFormat')}>Sin formato</Btn>
      </div>

      <div className="relative">
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          onInput={emitir}
          style={{ minHeight: `${rows * 1.6}rem` }}
          className={`w-full rounded-lg border border-zr-border bg-zr-surface px-4 py-3 text-sm leading-relaxed text-zr-text outline-none focus:border-zr-blue ${ESTILO_CONTENIDO}`}
        />
        {!value && placeholder && (
          <p className="pointer-events-none absolute left-4 top-3 text-sm text-zr-text-muted/60">{placeholder}</p>
        )}
      </div>
      <p style={{ color: acento }} className="text-xs font-semibold">
        Lo que ves aquí es exactamente lo que verá el estudiante.
      </p>
    </div>
  )
}

import { etiquetaDeArchivo, extensionDe } from '@/lib/material'

/**
 * Etiqueta del tipo de documento (PDF, PPTX, DOCX, XLSX, MP4…) para TODO
 * material, tanto para el estudiante como para quien lo monta (pedido del
 * coordinador, oct. 2026). Se saca de la extensión real del archivo guardado.
 */
export function EtiquetaTipoArchivo({ tipo, nombre }: { tipo: string; nombre: string | null | undefined }) {
  const texto = etiquetaDeArchivo(tipo, nombre)
  const ext = nombre ? extensionDe(nombre) : ''
  const color =
    ext === 'pdf' || tipo === 'pdf' ? 'border-zr-error/40 text-zr-error'
    : ['ppt', 'pptx'].includes(ext) || tipo === 'presentacion' ? 'border-zr-warning/40 text-zr-warning'
    : ['doc', 'docx', 'txt'].includes(ext) ? 'border-zr-blue/40 text-zr-blue-mid'
    : ['xls', 'xlsx'].includes(ext) ? 'border-zr-success/40 text-zr-success'
    : 'border-zr-border text-zr-text-muted'
  return (
    <span className={`inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${color}`}>
      {texto}
    </span>
  )
}

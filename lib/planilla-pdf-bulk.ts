import { createRoot } from 'react-dom/client'
import { createElement } from 'react'
import { jsPDF } from 'jspdf'
import { PlanillaPagina1, PlanillaPagina2, type DatosPlanilla } from '@/components/planilla/PlanillaDocumento'
import { cargarDatosPlanilla } from '@/lib/planilla-datos'

/**
 * Descarga todas las planillas de un programa de un solo golpe (pedido
 * explícito del coordinador — antes tocaba entrar estudiante por
 * estudiante y descargar/imprimir una por una).
 *
 * No hay generador de PDF en el servidor (regla del proyecto: nada de
 * librerías nuevas de infraestructura sin necesidad real) — se arma en el
 * navegador igual que el resto de las exportaciones (lib/exportar.ts,
 * lib/consent-pdf.ts): cada planilla se renderiza fuera de pantalla con el
 * mismo componente que ya usa la vista individual
 * (components/planilla/PlanillaDocumento.tsx), se captura con html2canvas
 * página por página (para que quede visualmente idéntica, con el logo y los
 * colores de marca) y se mete en un PDF de dos páginas por jsPDF. Todas las
 * planillas del programa terminan en un solo .zip (jszip).
 */

function crearHost(): HTMLDivElement {
  const host = document.createElement('div')
  host.style.position = 'fixed'
  host.style.top = '0'
  host.style.left = '-99999px'
  host.style.width = '820px'
  host.style.background = '#ffffff'
  document.body.appendChild(host)
  return host
}

async function esperarImagenes(host: HTMLElement) {
  const imgs = Array.from(host.querySelectorAll('img'))
  await Promise.all(
    imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.addEventListener('load', () => resolve(), { once: true })
            img.addEventListener('error', () => resolve(), { once: true })
          }),
    ),
  )
  // Dos frames para que el layout de Tailwind ya esté asentado antes de
  // capturar — un solo frame a veces captura el estado a medio pintar.
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
}

async function generarPdfEstudiante(datos: DatosPlanilla): Promise<ArrayBuffer> {
  const html2canvas = (await import('html2canvas')).default

  const host1 = crearHost()
  const host2 = crearHost()
  const root1 = createRoot(host1)
  const root2 = createRoot(host2)

  try {
    root1.render(createElement(PlanillaPagina1, { datos }))
    root2.render(createElement(PlanillaPagina2, { datos }))
    await esperarImagenes(host1)
    await esperarImagenes(host2)

    const canvas1 = await html2canvas(host1, { scale: 2, backgroundColor: '#ffffff', useCORS: true })
    const canvas2 = await html2canvas(host2, { scale: 2, backgroundColor: '#ffffff', useCORS: true })

    const pdf = new jsPDF({
      unit: 'px',
      format: [canvas1.width, canvas1.height],
      hotfixes: ['px_scaling'],
    })
    pdf.addImage(canvas1.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, canvas1.width, canvas1.height)
    pdf.addPage([canvas2.width, canvas2.height])
    pdf.addImage(canvas2.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, canvas2.width, canvas2.height)

    return pdf.output('arraybuffer')
  } finally {
    root1.unmount()
    root2.unmount()
    host1.remove()
    host2.remove()
  }
}

function descargarBlob(blob: Blob, nombreArchivo: string) {
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombreArchivo
  document.body.appendChild(enlace)
  enlace.click()
  document.body.removeChild(enlace)
  URL.revokeObjectURL(url)
}

function nombreArchivoSeguro(texto: string): string {
  return texto
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .trim()
}

export async function descargarPlanillasDelPrograma(
  estudiantes: { id: string; nombre: string; cedula: string }[],
  nombrePrograma: string,
  onProgreso?: (hecho: number, total: number) => void,
): Promise<{ generadas: number; fallidas: string[] }> {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  const fallidas: string[] = []
  let generadas = 0

  for (let i = 0; i < estudiantes.length; i++) {
    const e = estudiantes[i]
    onProgreso?.(i, estudiantes.length)
    try {
      const datos = await cargarDatosPlanilla(e.id)
      if (!datos) {
        fallidas.push(e.nombre)
        continue
      }
      const buffer = await generarPdfEstudiante(datos)
      zip.file(`${nombreArchivoSeguro(e.nombre)} - ${e.cedula}.pdf`, buffer)
      generadas++
    } catch {
      fallidas.push(e.nombre)
    }
  }
  onProgreso?.(estudiantes.length, estudiantes.length)

  const zipBlob = await zip.generateAsync({ type: 'blob' })
  descargarBlob(zipBlob, `Planillas ${nombreArchivoSeguro(nombrePrograma)}.zip`)

  return { generadas, fallidas }
}

/**
 * Exportación a Excel y PDF.
 *
 * Se descartó la librería `xlsx` (SheetJS) del registro de npm: tiene dos
 * vulnerabilidades de severidad alta sin parche (prototype pollution y ReDoS,
 * GHSA-4r6h-8v6p-xvw6 y GHSA-5pgg-2g8v-p4x9). En una app que maneja datos de
 * menores de edad no se introduce una dependencia sin parche disponible.
 *
 * En su lugar, el Excel se genera con una tabla HTML servida con el tipo MIME
 * de Excel — es el mismo truco que usan miles de exportadores en producción,
 * Excel la abre nativamente, y no depende de ninguna librería externa.
 */

interface Columna {
  encabezado: string
  ancho?: number   // en caracteres, aproximado — Excel lo reinterpreta como px
}

function descargar(blob: Blob, nombreArchivo: string) {
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombreArchivo
  document.body.appendChild(enlace)
  enlace.click()
  document.body.removeChild(enlace)
  URL.revokeObjectURL(url)
}

function celda(v: string | number): string {
  const esNumero = typeof v === 'number'
  const texto = String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  // mso-number-format fuerza que Excel trate la celda como texto, no como
  // fecha o número mal interpretado — una cédula "V-30000001" sin esto Excel
  // la intenta convertir a notación científica.
  return esNumero
    ? `<td>${texto}</td>`
    : `<td style="mso-number-format:'\\@'">${texto}</td>`
}

export function exportarExcel(nombreArchivo: string, columnas: Columna[], filas: (string | number)[][]) {
  const cols = columnas.map((c) => `<col style="width:${(c.ancho ?? 18) * 7}px">`).join('')
  const encabezado = columnas.map((c) => `<th>${c.encabezado}</th>`).join('')
  const cuerpo = filas.map((f) => `<tr>${f.map(celda).join('')}</tr>`).join('')

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8">
<!--[if gte mso 9]><xml>
<x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>Hoja1</x:Name>
<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook>
</xml><![endif]-->
<style>
  table { border-collapse: collapse; font-family: Calibri, Arial, sans-serif; font-size: 12px; }
  th { background: #1E4D96; color: #FFFFFF; font-weight: bold; padding: 6px 10px; border: 1px solid #C9C9C9; text-align: left; }
  td { padding: 6px 10px; border: 1px solid #C9C9C9; }
</style>
</head>
<body>
<table><colgroup>${cols}</colgroup><thead><tr>${encabezado}</tr></thead><tbody>${cuerpo}</tbody></table>
</body>
</html>`

  descargar(new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' }), `${nombreArchivo}.xls`)
}

export async function exportarPDF(
  titulo: string,
  nombreArchivo: string,
  columnas: string[],
  filas: (string | number)[][],
  subtitulo?: string,
) {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default

  const doc = new jsPDF()

  doc.setFontSize(16)
  doc.setTextColor(30, 77, 150) // zr-blue-deep
  doc.text(titulo, 14, 18)

  if (subtitulo) {
    doc.setFontSize(10)
    doc.setTextColor(100, 100, 100)
    doc.text(subtitulo, 14, 25)
  }

  autoTable(doc, {
    head: [columnas],
    body: filas.map((f) => f.map(String)),
    startY: subtitulo ? 30 : 24,
    headStyles: { fillColor: [30, 77, 150], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [245, 247, 251] },
  })

  const paginas = doc.getNumberOfPages()
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(
      `ZR Mecademy · ${new Date().toLocaleDateString('es-VE')} · página ${i} de ${paginas}`,
      14,
      doc.internal.pageSize.getHeight() - 8,
    )
  }

  doc.save(`${nombreArchivo}.pdf`)
}

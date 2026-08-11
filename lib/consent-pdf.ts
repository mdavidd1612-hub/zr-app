import { jsPDF } from 'jspdf'

interface DatosConsentimientoPDF {
  studentName: string
  studentCedula: string
  representativeName: string
  representativeCedula: string
  representativeEmail: string
  representativePhone: string | null
  method: 'fisico' | 'digital'
  signedAt: string
  verifiedAt: string
  verifiedByName: string
}

// Genera el PDF del consentimiento parental ya aprobado. Se arma en el
// navegador (jsPDF, sin backend) a partir de los mismos datos que ya carga
// la pantalla de administración — no hay nada que consultar de más.
export function generarConsentimientoPDF(datos: DatosConsentimientoPDF) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' })
  const margen = 20
  let y = 25

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('ZR Mecademy · Consentimiento de Representante Legal', margen, y)

  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(90, 90, 90)
  doc.text('Autorización de creación de cuenta para estudiante menor de edad (LOPNNA)', margen, y)
  doc.setTextColor(0, 0, 0)

  y += 12
  doc.setDrawColor(200, 200, 200)
  doc.line(margen, y, 210 - margen, y)

  function fila(etiqueta: string, valor: string) {
    y += 9
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(etiqueta, margen, y)
    doc.setFont('helvetica', 'normal')
    doc.text(valor || '—', margen + 60, y)
  }

  y += 4
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Estudiante', margen, y)
  fila('Nombre completo', datos.studentName)
  fila('Cédula', datos.studentCedula)

  y += 10
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Representante legal', margen, y)
  fila('Nombre completo', datos.representativeName)
  fila('Cédula', datos.representativeCedula)
  fila('Correo', datos.representativeEmail)
  fila('Teléfono', datos.representativePhone ?? '—')
  fila('Método', datos.method === 'fisico' ? 'Firmó en papel en la sede' : 'Documento digital')
  fila('Firmado el', new Date(datos.signedAt).toLocaleDateString('es-VE'))

  y += 10
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Verificación de la academia', margen, y)
  fila('Verificado por', datos.verifiedByName)
  fila('Verificado el', new Date(datos.verifiedAt).toLocaleDateString('es-VE'))

  y += 16
  doc.setDrawColor(200, 200, 200)
  doc.line(margen, y, 210 - margen, y)
  y += 8
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(120, 120, 120)
  doc.text(
    'Este documento certifica que ZR Mecademy verificó el consentimiento del representante',
    margen,
    y
  )
  y += 4
  doc.text(
    'legal para la creación de la cuenta del estudiante, según lo exigido por la LOPNNA.',
    margen,
    y
  )

  doc.save(`consentimiento-${datos.studentCedula}.pdf`)
}

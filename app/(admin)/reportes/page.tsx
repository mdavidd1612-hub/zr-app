'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Seccion } from '@/components/ui/Editorial'
import { exportarExcel, exportarPDF } from '@/lib/exportar'
import { BotonVolver } from '@/components/ui/BotonVolver'

/**
 * T-410 · Cuatro reportes de administración, cada uno exportable a Excel y
 * a PDF (no CSV — Excel/PDF es lo que administración puede abrir y archivar
 * directamente sin pasos intermedios).
 *
 * Se calculan en el cliente a partir de lo que ya trae RLS (nada de esto es
 * sensible fuera de personal/admin), y el archivo nunca lleva más que lo que
 * ya está en pantalla — no se agregan columnas "por si acaso" al exportar.
 */

interface FilaAsistencia {
  cohorte: string
  fecha: string
  presentes: number
  inscritos: number
}

interface FilaAvance {
  modulo: string
  aprobados: number
  reprobados: number
  enCurso: number
}

interface FilaUso {
  material: string
  modulo: string
  vistas: number
}

interface FilaPendiente {
  estudiante: string
  examen: string
  antiguedadHoras: number
}

export default function Reportes() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [asistencia, setAsistencia] = useState<FilaAsistencia[]>([])
  const [avance, setAvance] = useState<FilaAvance[]>([])
  const [uso, setUso] = useState<FilaUso[]>([])
  const [pendientes, setPendientes] = useState<FilaPendiente[]>([])

  useEffect(() => {
    const supabase = createClient()

    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      // 1 — Asistencia por cohorte y sesión
      const { data: sesiones } = await supabase
        .from('class_sessions')
        .select('session_date, cohorts(name), attendance_events(id), cohort_id')
        .order('session_date', { ascending: false })
        .limit(60)

      const inscritosPorCohorte = new Map<string, number>()
      const { data: estudiantesPorCohorte } = await supabase.from('students').select('cohort_id')
      for (const s of estudiantesPorCohorte ?? []) {
        if (!s.cohort_id) continue
        inscritosPorCohorte.set(s.cohort_id, (inscritosPorCohorte.get(s.cohort_id) ?? 0) + 1)
      }

      const filasSesiones = sesiones as unknown as {
        session_date: string; cohort_id: string
        cohorts: { name: string } | null
        attendance_events: { id: string }[] | null
      }[] | null

      setAsistencia(
        (filasSesiones ?? []).map((s) => ({
          cohorte: s.cohorts?.name ?? 'Cohorte',
          fecha: s.session_date,
          presentes: s.attendance_events?.length ?? 0,
          inscritos: inscritosPorCohorte.get(s.cohort_id) ?? 0,
        })),
      )

      // 2 — Avance académico por módulo
      const { data: matriculas } = await supabase
        .from('module_enrollments')
        .select('status, modules(name, order_index)')

      const filasMatriculas = matriculas as unknown as {
        status: string
        modules: { name: string; order_index: number } | null
      }[] | null

      const porModulo = new Map<string, FilaAvance & { orden: number }>()
      for (const m of filasMatriculas ?? []) {
        const nombre = m.modules?.name ?? 'Módulo'
        if (!porModulo.has(nombre)) {
          porModulo.set(nombre, { modulo: nombre, aprobados: 0, reprobados: 0, enCurso: 0, orden: m.modules?.order_index ?? 0 })
        }
        const fila = porModulo.get(nombre)!
        if (m.status === 'aprobado') fila.aprobados++
        else if (m.status === 'reprobado') fila.reprobados++
        else if (m.status === 'en_curso') fila.enCurso++
      }
      setAvance([...porModulo.values()].sort((a, b) => a.orden - b.orden))

      // 3 — Uso del repositorio
      const { data: materiales } = await supabase
        .from('content_items')
        .select('title, modules(name), content_views(id)')
        .eq('is_published', true)

      const filasMateriales = materiales as unknown as {
        title: string
        modules: { name: string } | null
        content_views: { id: string }[] | null
      }[] | null

      setUso(
        (filasMateriales ?? [])
          .map((m) => ({ material: m.title, modulo: m.modules?.name ?? 'Módulo', vistas: m.content_views?.length ?? 0 }))
          .sort((a, b) => b.vistas - a.vistas),
      )

      // 4 — Exámenes pendientes de calificar, con antigüedad en horas
      const { data: respuestas } = await supabase
        .from('exam_answers')
        .select('created_at, exam_attempts(submitted_at, students(profiles(full_name)), exams(title))')
        .is('awarded_points', null)

      const filasRespuestas = respuestas as unknown as {
        created_at: string
        exam_attempts: {
          submitted_at: string | null
          students: { profiles: { full_name: string } | null } | null
          exams: { title: string } | null
        } | null
      }[] | null

      const ahora = Date.now()
      setPendientes(
        (filasRespuestas ?? [])
          .filter((r) => r.exam_attempts?.submitted_at)
          .map((r) => ({
            estudiante: r.exam_attempts?.students?.profiles?.full_name ?? 'Estudiante',
            examen: r.exam_attempts?.exams?.title ?? 'Examen',
            antiguedadHoras: Math.round((ahora - new Date(r.exam_attempts!.submitted_at!).getTime()) / 3_600_000),
          }))
          .sort((a, b) => b.antiguedadHoras - a.antiguedadHoras),
      )

      setCargando(false)
    }

    cargar()
  }, [router])

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Calculando reportes…</p>
      </div>
    )
  }

  return (
    <div className="space-y-11 px-5 pt-14">
      <BotonVolver />

      <Encabezado sobretitulo="Administración" titulo="Reportes" descripcion="Cada tarjeta se exporta a Excel o PDF." />

      <Regla delay={60} />

      <Seccion numero={1} titulo="Asistencia por sesión" delay={120}>
        <div className="zr-card overflow-hidden">
          {asistencia.length === 0 ? (
            <p className="p-5 text-sm text-zr-text-muted">Sin sesiones registradas todavía.</p>
          ) : (
            <div className="divide-y divide-zr-border">
              {asistencia.slice(0, 6).map((f, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zr-text">{f.cohorte}</p>
                    <p className="text-xs text-zr-text-muted">
                      {new Date(f.fecha + 'T12:00:00').toLocaleDateString('es-VE')}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm tabular-nums text-zr-text-muted">
                    {f.presentes}/{f.inscritos}
                  </p>
                </div>
              ))}
              {asistencia.length > 6 && (
                <p className="px-5 py-3 text-xs text-zr-text-muted">+ {asistencia.length - 6} más en el archivo</p>
              )}
            </div>
          )}
          <BotonesExportar
            disabled={asistencia.length === 0}
            alExcel={() =>
              exportarExcel(
                'asistencia_por_sesion',
                [{ encabezado: 'Cohorte', ancho: 28 }, { encabezado: 'Fecha' }, { encabezado: 'Presentes' }, { encabezado: 'Inscritos' }],
                asistencia.map((f) => [f.cohorte, f.fecha, f.presentes, f.inscritos]),
              )
            }
            alPDF={() =>
              exportarPDF(
                'Asistencia por sesión',
                'asistencia_por_sesion',
                ['Cohorte', 'Fecha', 'Presentes', 'Inscritos'],
                asistencia.map((f) => [f.cohorte, f.fecha, f.presentes, f.inscritos]),
                `Generado el ${new Date().toLocaleDateString('es-VE')}`,
              )
            }
          />
        </div>
      </Seccion>

      <Seccion numero={2} titulo="Avance académico" delay={200}>
        <div className="zr-card overflow-hidden">
          {avance.length === 0 ? (
            <p className="p-5 text-sm text-zr-text-muted">Sin inscripciones todavía.</p>
          ) : (
            <div className="divide-y divide-zr-border">
              {avance.map((f, i) => (
                <div key={i} className="px-5 py-3">
                  <p className="text-sm font-medium text-zr-text">{f.modulo}</p>
                  <p className="mt-1 text-xs tabular-nums text-zr-text-muted">
                    {f.aprobados} aprobados · {f.reprobados} reprobados · {f.enCurso} en curso
                  </p>
                </div>
              ))}
            </div>
          )}
          <BotonesExportar
            disabled={avance.length === 0}
            alExcel={() =>
              exportarExcel(
                'avance_academico',
                [{ encabezado: 'Módulo', ancho: 28 }, { encabezado: 'Aprobados' }, { encabezado: 'Reprobados' }, { encabezado: 'En curso' }],
                avance.map((f) => [f.modulo, f.aprobados, f.reprobados, f.enCurso]),
              )
            }
            alPDF={() =>
              exportarPDF(
                'Avance académico',
                'avance_academico',
                ['Módulo', 'Aprobados', 'Reprobados', 'En curso'],
                avance.map((f) => [f.modulo, f.aprobados, f.reprobados, f.enCurso]),
                `Generado el ${new Date().toLocaleDateString('es-VE')}`,
              )
            }
          />
        </div>
      </Seccion>

      <Seccion numero={3} titulo="Uso del repositorio" delay={280}>
        <div className="zr-card overflow-hidden">
          {uso.length === 0 ? (
            <p className="p-5 text-sm text-zr-text-muted">Sin material publicado todavía.</p>
          ) : (
            <div className="divide-y divide-zr-border">
              {uso.slice(0, 6).map((f, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3">
                  <p className="min-w-0 truncate text-sm font-medium text-zr-text">{f.material}</p>
                  <p className="shrink-0 text-sm tabular-nums text-zr-text-muted">{f.vistas} vistas</p>
                </div>
              ))}
              {uso.length > 6 && <p className="px-5 py-3 text-xs text-zr-text-muted">+ {uso.length - 6} más en el archivo</p>}
            </div>
          )}
          <BotonesExportar
            disabled={uso.length === 0}
            alExcel={() =>
              exportarExcel(
                'uso_del_repositorio',
                [{ encabezado: 'Material', ancho: 32 }, { encabezado: 'Módulo', ancho: 24 }, { encabezado: 'Vistas' }],
                uso.map((f) => [f.material, f.modulo, f.vistas]),
              )
            }
            alPDF={() =>
              exportarPDF(
                'Uso del repositorio',
                'uso_del_repositorio',
                ['Material', 'Módulo', 'Vistas'],
                uso.map((f) => [f.material, f.modulo, f.vistas]),
                `Generado el ${new Date().toLocaleDateString('es-VE')}`,
              )
            }
          />
        </div>
      </Seccion>

      <Seccion numero={4} titulo="Exámenes pendientes de calificar" delay={360}>
        <div className="zr-card overflow-hidden">
          {pendientes.length === 0 ? (
            <p className="p-5 text-sm text-zr-text-muted">Nada pendiente. Todo al día.</p>
          ) : (
            <div className="divide-y divide-zr-border">
              {pendientes.slice(0, 6).map((f, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zr-text">{f.estudiante}</p>
                    <p className="truncate text-xs text-zr-text-muted">{f.examen}</p>
                  </div>
                  <p className={`shrink-0 text-sm font-bold tabular-nums ${f.antiguedadHoras > 48 ? 'text-zr-error' : 'text-zr-text-muted'}`}>
                    {f.antiguedadHoras}h
                  </p>
                </div>
              ))}
              {pendientes.length > 6 && <p className="px-5 py-3 text-xs text-zr-text-muted">+ {pendientes.length - 6} más en el archivo</p>}
            </div>
          )}
          <BotonesExportar
            disabled={pendientes.length === 0}
            alExcel={() =>
              exportarExcel(
                'examenes_pendientes',
                [{ encabezado: 'Estudiante', ancho: 28 }, { encabezado: 'Examen', ancho: 28 }, { encabezado: 'Antigüedad (horas)', ancho: 16 }],
                pendientes.map((f) => [f.estudiante, f.examen, f.antiguedadHoras]),
              )
            }
            alPDF={() =>
              exportarPDF(
                'Exámenes pendientes de calificar',
                'examenes_pendientes',
                ['Estudiante', 'Examen', 'Antigüedad (horas)'],
                pendientes.map((f) => [f.estudiante, f.examen, f.antiguedadHoras]),
                `Generado el ${new Date().toLocaleDateString('es-VE')}`,
              )
            }
          />
        </div>
      </Seccion>
    </div>
  )
}

function BotonesExportar({
  alExcel, alPDF, disabled,
}: { alExcel: () => void; alPDF: () => void; disabled: boolean }) {
  return (
    <div className="flex border-t border-zr-border">
      <button
        onClick={alExcel}
        disabled={disabled}
        className="min-h-12 flex-1 border-r border-zr-border text-sm font-bold text-zr-blue disabled:cursor-not-allowed disabled:text-zr-text-muted"
      >
        Exportar a Excel
      </button>
      <button
        onClick={alPDF}
        disabled={disabled}
        className="min-h-12 flex-1 text-sm font-bold text-zr-blue disabled:cursor-not-allowed disabled:text-zr-text-muted"
      >
        Exportar a PDF
      </button>
    </div>
  )
}

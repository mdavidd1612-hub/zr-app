'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Seccion } from '@/components/ui/Editorial'

const CONDICIONES = ['Frenillos', 'Autismo', 'Asperger', 'TDAH', 'TDA', 'Epilepsia', 'Otro']

export default function CompletarPerfil() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)

  const [nationality, setNationality] = useState('')
  const [gender, setGender] = useState('')
  const [maritalStatus, setMaritalStatus] = useState('')
  const [ethnicity, setEthnicity] = useState('')
  const [employmentStatus, setEmploymentStatus] = useState('')
  const [currentlyStudying, setCurrentlyStudying] = useState<boolean | null>(null)
  const [hasTeaching, setHasTeaching] = useState<boolean | null>(null)
  const [teachingArea, setTeachingArea] = useState('')
  const [yearsExperience, setYearsExperience] = useState('')
  const [educationLevel, setEducationLevel] = useState('')
  const [educationStatus, setEducationStatus] = useState('')
  const [currentSchoolGrade, setCurrentSchoolGrade] = useState('')
  const [condiciones, setCondiciones] = useState<string[]>([])

  useEffect(() => {
    const supabase = createClient()
    async function verificar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }
      const { data: yaLleno } = await supabase
        .from('student_profile_details').select('id').eq('student_id', user.id).maybeSingle()
      if (yaLleno) {
        router.replace('/')
        return
      }
      setCargando(false)
    }
    verificar()
  }, [router])

  function alternarCondicion(c: string) {
    setCondiciones((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
  }

  const completo =
    nationality && gender && maritalStatus && ethnicity && employmentStatus &&
    currentlyStudying !== null && hasTeaching !== null &&
    (hasTeaching === false || (teachingArea.trim() && yearsExperience.trim())) &&
    educationLevel && educationStatus

  async function enviar() {
    setEnviando(true)
    setErrorEnvio(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('student_profile_details').insert({
      student_id: user.id,
      nationality,
      gender,
      marital_status: maritalStatus,
      ethnicity,
      employment_status: employmentStatus,
      currently_studying: currentlyStudying as boolean,
      has_teaching_experience: hasTeaching as boolean,
      teaching_area: hasTeaching ? teachingArea.trim() : null,
      years_of_experience: hasTeaching ? Number(yearsExperience) : null,
      education_level: educationLevel,
      education_status: educationStatus,
      current_school_grade: currentSchoolGrade.trim() || null,
      health_conditions: condiciones,
    })

    if (error) {
      // El caso más común aquí: eres menor de edad y falta el consentimiento
      // parental (regla de negocio, no un bug — el trigger de la migración
      // 010 la aplica también sobre esta tabla porque activa onboarding_status).
      setErrorEnvio(
        error.message.includes('LOPNNA')
          ? 'Como eres menor de edad, hace falta el consentimiento de tu representante antes de continuar. Contacta a administración.'
          : 'No se pudo guardar. Intenta de nuevo.'
      )
      setEnviando(false)
      return
    }

    router.replace('/')
    router.refresh()
  }

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando…</p>
      </div>
    )
  }

  return (
    <div className="space-y-11 px-5 pb-32 pt-14">
      <Encabezado
        sobretitulo="Antes de empezar"
        titulo="Completa tu perfil"
        descripcion="Son unas preguntas rápidas, solo se piden una vez."
      />
      <Regla delay={60} />

      <Seccion numero={1} titulo="Sobre ti" delay={100}>
        <Opciones etiqueta="Nacionalidad" valor={nationality} onChange={setNationality}
          opciones={[['venezolana', 'Venezolana'], ['extranjera', 'Extranjera'], ['otra', 'Otra']]} />
        <Opciones etiqueta="Género" valor={gender} onChange={setGender}
          opciones={[['femenino', 'Femenino'], ['masculino', 'Masculino'], ['otro', 'Otro']]} />
        <Opciones etiqueta="Estado civil" valor={maritalStatus} onChange={setMaritalStatus}
          opciones={[['soltero', 'Soltero(a)'], ['casado', 'Casado(a)'], ['divorciado', 'Divorciado(a)'], ['viudo', 'Viudo(a)'], ['union_estable', 'Unión estable'], ['otro', 'Otro']]} />
        <Opciones etiqueta="¿Se identifica con alguna etnia?" valor={ethnicity} onChange={setEthnicity}
          opciones={[['si', 'Sí'], ['no', 'No'], ['otra', 'Otra']]} />
      </Seccion>

      <Seccion numero={2} titulo="Ocupación" delay={160}>
        <Opciones etiqueta="Condición laboral actual" valor={employmentStatus} onChange={setEmploymentStatus}
          opciones={[['ocupado_dependiente', 'Ocupado(a) dependiente'], ['ocupado_independiente', 'Ocupado(a) independiente'], ['desempleado', 'Desempleado(a)'], ['otra', 'Otra']]} />
        <SiNo etiqueta="¿Estudia actualmente?" valor={currentlyStudying} onChange={setCurrentlyStudying} />
        <SiNo etiqueta="¿Posee experiencia como docente?" valor={hasTeaching} onChange={setHasTeaching} />
        {hasTeaching && (
          <>
            <Texto etiqueta="Área de experiencia docente/profesional" valor={teachingArea} onChange={setTeachingArea} />
            <Texto etiqueta="Años de experiencia" valor={yearsExperience} onChange={setYearsExperience} type="number" />
          </>
        )}
      </Seccion>

      <Seccion numero={3} titulo="Educación" delay={220}>
        <Opciones etiqueta="Nivel de escolaridad" valor={educationLevel} onChange={setEducationLevel}
          opciones={[['bachillerato', 'Bachillerato'], ['tecnico', 'Técnico'], ['universitario', 'Universitario'], ['postgrado', 'Postgrado']]} />
        <Opciones etiqueta="Estado de ese nivel" valor={educationStatus} onChange={setEducationStatus}
          opciones={[['en_curso', 'En curso'], ['incompleto', 'Incompleto'], ['completo', 'Completo']]} />
        <Texto etiqueta="Colegio o liceo actual (si aplica)" valor={currentSchoolGrade} onChange={setCurrentSchoolGrade} />
      </Seccion>

      <Seccion numero={4} titulo="Salud (opcional)" delay={280}>
        <p className="text-xs text-zr-text-muted">
          Solo la ve administración y tu(s) profesor(es). Márcala solo si aplica.
        </p>
        <div className="flex flex-wrap gap-2">
          {CONDICIONES.map((c) => (
            <button
              key={c}
              onClick={() => alternarCondicion(c)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                condiciones.includes(c)
                  ? 'border-zr-blue bg-zr-blue/15 text-zr-blue'
                  : 'border-zr-border text-zr-text-muted'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </Seccion>

      {errorEnvio && (
        <p className="rounded-lg border border-zr-error/30 bg-zr-error/12 px-4 py-3 text-sm text-zr-error">
          {errorEnvio}
        </p>
      )}

      <button
        onClick={enviar}
        disabled={!completo || enviando}
        className="min-h-14 w-full rounded-lg bg-zr-blue text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {enviando ? 'Guardando…' : 'Terminar'}
      </button>
    </div>
  )
}

function Opciones({
  etiqueta, valor, onChange, opciones,
}: { etiqueta: string; valor: string; onChange: (v: string) => void; opciones: [string, string][] }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-zr-text">{etiqueta}</label>
      <div className="flex flex-wrap gap-2">
        {opciones.map(([v, l]) => (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
              valor === v ? 'border-zr-blue bg-zr-blue/15 text-zr-blue' : 'border-zr-border text-zr-text-muted'
            }`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  )
}

function SiNo({
  etiqueta, valor, onChange,
}: { etiqueta: string; valor: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-zr-text">{etiqueta}</label>
      <div className="flex gap-2">
        {[[true, 'Sí'], [false, 'No']].map(([v, l]) => (
          <button
            key={String(v)}
            onClick={() => onChange(v as boolean)}
            className={`min-w-20 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
              valor === v ? 'border-zr-blue bg-zr-blue/15 text-zr-blue' : 'border-zr-border text-zr-text-muted'
            }`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  )
}

function Texto({
  etiqueta, valor, onChange, type = 'text',
}: { etiqueta: string; valor: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-zr-text">{etiqueta}</label>
      <input
        type={type}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
      />
    </div>
  )
}

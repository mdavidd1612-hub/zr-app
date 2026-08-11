# SPRINT MDV-0 · FUNDACIONES + ESQUEMA MDV
**Día 1-2 (de 14)** · Objetivo: base de datos completa con MDV, seguridad verificada, entorno listo.

> Ejecuta las tareas en orden. No empieces una sin haber cumplido la verificación de la anterior.

---

## T-M001 · Preparar el entorno
**Antes:** nada.
**Haz:** sigue `spec/01_SETUP.md` completo, del paso 1 al 4.
**Verifica:**
```bash
supabase status
```
Servicios corriendo, y `npm run dev` abre `localhost:3000`.

---

## T-M002 · Copiar y aplicar las migraciones
**Antes:** T-M001.
**Haz:** copia los 15 archivos `.sql` de `supabase/migrations/` al proyecto.
Incluye la migración `015_mdv_integration.sql` que agrega todas las tablas MDV.
**No edites ni una línea.**
```bash
supabase db reset
```
**Verifica:**
```bash
psql "$DB" -c "select tablename from pg_tables where schemaname='public' order by tablename;"
```
Deben aparecer **todas** las tablas nuevas: `weekly_activities`, `activity_completions`,
`weekly_progress`, `rubric_templates`, `rubric_criteria`, `performance_evaluations`,
`eval_criteria_results`, `defense_questions`, `technical_defenses`, `reflection_tickets`,
`workshop_role_assignments`, `ia_declarations`.

---

## T-M003 · Verificar RLS en todas las tablas
**Antes:** T-M002.
**Haz:**
```bash
psql "$DB" -c "select tablename from pg_tables where schemaname='public' and rowsecurity = false;"
```
**Verifica:** **cero filas**. Todas las tablas MDV tienen RLS habilitada.

---

## T-M004 · Cargar datos de prueba MDV
**Antes:** T-M002.
**Haz:** ejecuta `supabase/seed/seed_dev_mdv.sql` que carga:
- 1 rúbrica con 12 criterios (4 críticos + 8 normales) para la competencia de semana 1
- 10 preguntas de defensa para la competencia de semana 1
- 5 actividades semanales (lunes a viernes) para semana 1
- 1 evaluación de desempeño de ejemplo
- Configuración MDV en system_config

**Verifica:**
```sql
select count(*) from rubric_criteria where is_critical = true;  -- 4
select count(*) from defense_questions;  -- 10
select count(*) from weekly_activities;  -- al menos 5
select value from system_config where key = 'mdv.self_check_threshold';  -- 5
```

---

## T-M005 · Generar tipos de TypeScript
**Antes:** T-M002.
**Haz:**
```bash
npm run db:types
```
**Verifica:** `lib/database.types.ts` contiene los tipos de todas las tablas nuevas:
`weekly_activities`, `rubric_templates`, `performance_evaluations`, `technical_defenses`, etc.

---

## T-M006 · Crear tipos y validadores MDV
**Archivo:** `lib/types-mdv.ts` y `lib/validators-mdv.ts`.
**Haz:** según `spec/02_CONTRATOS.md` y `spec/07_MDV_INTEGRACION.md`.
Tipos principales:
```ts
// Estados MDV
type EvalOutcome = 'dominada' | 'en_desarrollo' | 'requiere_refuerzo'
type DefenseLevel = 'nivel_1' | 'nivel_2' | 'nivel_3' | 'nivel_4'
type IALevel = 'N0' | 'N1' | 'N2' | 'N3' | 'N4'
type WeeklyStatus = 'en_progreso' | 'completado' | 'incompleto' | 'refuerzo'
type WorkshopRole = 'operador' | 'inspector_calidad' | 'documentador' | 'responsable_seguridad'

// Formas de datos
interface RubricCriterion { id: string; description: string; isCritical: boolean; maxPoints: number }
interface CriterionResult { criterionId: string; meetsCriterion: boolean; observation?: string }
interface ReflectionTicket { beforeThought: string; nowUnderstand: string; biggestMistake: string; nextTime: string }
```

**Verifica:** `npm run typecheck` pasa.

---

## T-M007 · Verificar triggers MDV
**Antes:** T-M004.
**Haz:** ejecuta estas pruebas directamente en SQL:

1. **Trigger de compuerta A:**
```sql
-- Insertar weekly_progress con todo completo
insert into weekly_progress (student_id, session_id, activities_completed, activities_required, self_check_score, doubt_submitted)
values ('<student_id>', '<session_id>', 5, 5, 6, true);
-- Verificar que saturday_enabled = true
```

2. **Trigger de ítems críticos:**
```sql
-- Crear evaluación, insertar criterios con un crítico en false
-- Verificar que outcome = 'requiere_refuerzo'
```

3. **Trigger de defensa nivel 1:**
```sql
-- Insertar defensa con level_achieved = 'nivel_1'
-- Verificar que la evaluación cambia a 'requiere_refuerzo'
```

4. **Trigger de sincronización con mastery_map:**
```sql
-- Verificar que al establecer outcome = 'dominada', mastery_map se actualiza
```

**Verifica:** los 4 triggers funcionan correctamente.

---

## T-M008 · CI con verificación MDV
**Archivo:** `.github/workflows/ci.yml`.
**Haz:** agregar al CI existente:
- Verificación de que todas las tablas MDV tienen RLS.
- Verificación de que los triggers MDV funcionan.
- `npm run typecheck` pasa con los tipos nuevos.

**Verifica:** el CI pasa en verde.

---

## T-M009 · Storage buckets para evidencia MDV
**Antes:** T-M001.
**Haz:** crear buckets en Supabase Storage:
- `evidencias-video` — videos de ejecución del sábado (privado, max 100MB)
- Políticas: el estudiante solo sube a su carpeta, el personal lee todo.

**Verifica:** subir un archivo de prueba como estudiante y leerlo como profesor.

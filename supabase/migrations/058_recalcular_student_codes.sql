-- =============================================================================
-- ZR APP · MIGRACIÓN 058 · Recalcular los códigos de carnet tras la renumeración
-- =============================================================================
-- Cierra R-02 de docs/19_PLAN_CAMBIOS_POST_DIRECTIVA.md. Va inmediatamente
-- después de la 057: renumerar las cohortes cambia el tercer segmento del código
-- de carnet de sus estudiantes (PTMA-2026-04-762 → PTMA-2026-02-762).
--
-- ⚠️ LO QUE ESTA MIGRACIÓN NO HACE, Y HAY QUE HACER APARTE
-- El código de carnet es también la contraseña de primer ingreso del estudiante
-- (supabase/functions/create-student/index.ts). Esta migración cambia el código,
-- NO la contraseña: las contraseñas viven en auth.users y se tocan con la API de
-- administración, no con SQL suelto.
--
-- Después de aplicar esto hay que correr:
--     node scripts/resincronizar-passwords.mjs
-- que compara ambas cosas, avisa a quién le cambió el código y deja constancia
-- en un CSV para administración. Ese script NO le cambia la contraseña a quien ya
-- la cambió por su cuenta: prefiere listarlo aparte a dejarlo afuera de la app.
--
-- Se corre ahora, con un solo estudiante real inscrito. Dentro de un mes serán
-- decenas y cada uno es una llamada telefónica.
-- =============================================================================

-- set_student_code_calc() (migración 044) arma el código leyendo el programa y
-- el code_number de la cohorte. Recalcularlo para todos es idempotente: a quien
-- no le cambió nada, le devuelve exactamente el mismo texto.
--
-- Incluye de paso a cualquiera que hubiera quedado con código provisional
-- 'ZR-PENDIENTE-xxxxxxxx' por haber sido inscrito en una cohorte sin numerar
-- (el bug que la 057 acaba de cerrar).
update public.students s
   set student_code = public.set_student_code_calc(s.id, s.cohort_id, s.enrollment_date)
 where s.cohort_id is not null
   and s.student_code is distinct from
       public.set_student_code_calc(s.id, s.cohort_id, s.enrollment_date);

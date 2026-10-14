-- 166: pedido del coordinador tras reunión con Dirección Académica (13 oct. 2026):
-- con varios "programas activos" sin un solo estudiante, las listas confundían (a
-- veces el más nuevo salía primero, a veces último, y el usuario no se aprendía el
-- orden). Se suspenden los programas sin estudiantes hasta que de verdad arranque
-- uno nuevo — queda reversible con un cambio de estado, no se borra nada.
update public.cohorts c
   set status = 'suspendida'
 where c.status = 'activa'
   and not exists (select 1 from public.students s where s.cohort_id = c.id);

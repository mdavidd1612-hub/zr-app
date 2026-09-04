-- A pedido explícito del coordinador (transcripción de audio, docs/19...):
-- "Añadir la función para que tanto administradores como vendedores puedan
-- editar y corregir los datos de cualquier registro existente" — nombre,
-- teléfono, correo, y el programa/curso asignado. Tarifas y estado de pago
-- quedan fuera (Fase 2, sección 7 de AGENTS.md — temas de dinero prohibidos
-- en esta fase).
--
-- admin ya podía editar cualquier estudiante (is_admin_up()). A vendedor
-- nunca se le dio ninguna política de UPDATE, ni en `students` ni en
-- `profiles` — solo podía leer lo que él mismo inscribió. Se le da ahora
-- permiso de EDITAR, acotado del mismo modo que ya lee: solo los
-- estudiantes que él mismo inscribió (`enrolled_by = auth.uid()`), no
-- cualquier estudiante de la academia — un vendedor corrige sus propios
-- datos de carga, no los de otro vendedor.
--
-- `fn_profiles_guard()` (migración 004) ya sigue aplicando por encima de
-- esto sin cambios: bloquea a cualquiera que no sea is_admin_up() de tocar
-- role/cedula/status, así que un vendedor no puede colarse un cambio de rol
-- por aquí — solo nombre, correo, teléfono y (en `students`) el programa.
--
-- La auditoría que pidió el coordinador ya existe: trg_profiles_audit y
-- trg_students_audit (migración 002) registran cada INSERT/UPDATE/DELETE
-- en audit_log con quién lo hizo y el estado antes/después — no hace falta
-- nada nuevo para eso.

create policy "vendedor: editar estudiantes que inscribio" on public.students for update
  using (
    (select public.is_vendedor())
    and enrolled_by = auth.uid()
  )
  with check (
    (select public.is_vendedor())
    and enrolled_by = auth.uid()
  );

create policy "vendedor: editar perfiles que inscribio" on public.profiles for update
  using (
    (select public.is_vendedor())
    and exists (select 1 from public.students s where s.id = profiles.id and s.enrolled_by = auth.uid())
  )
  with check (
    (select public.is_vendedor())
    and exists (select 1 from public.students s where s.id = profiles.id and s.enrolled_by = auth.uid())
  );

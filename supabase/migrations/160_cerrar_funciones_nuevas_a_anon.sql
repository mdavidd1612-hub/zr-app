-- Las funciones nuevas de la metodología de profesores quedaban ejecutables por
-- anon (permiso por defecto). Usan auth.uid(), así que anon no obtenía nada, pero
-- se cierran igual (mismo criterio que la migración 133).
revoke execute on function public.mis_asignaciones_docente() from public, anon;
revoke execute on function public.profesor_ve_material(uuid, uuid, uuid) from public, anon;
revoke execute on function public.profesor_dicta(uuid, uuid) from public, anon;
revoke execute on function public.mi_cohorte_estudiante() from public, anon;
grant execute on function public.mis_asignaciones_docente() to authenticated;
grant execute on function public.profesor_ve_material(uuid, uuid, uuid) to authenticated;
grant execute on function public.profesor_dicta(uuid, uuid) to authenticated;
grant execute on function public.mi_cohorte_estudiante() to authenticated;

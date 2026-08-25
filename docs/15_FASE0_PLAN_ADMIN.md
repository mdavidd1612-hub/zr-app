# 15 — Plan de sprints · Fase 0 (perfil administración)

> Continuación de `docs/14_FASE0_PLAN_SPRINTS.md`, mismo espíritu: pulir lo
> básico para la demo del 5 de septiembre de 2026, sin tocar paleta, tema
> oscuro ni liquid glass. Cambios solo en el perfil `admin` (y lo que hereda
> `direccion_academica`/`super_admin` de esas mismas pantallas).

## Sprint A — Recortes de menú (rápido, bajo riesgo)
- Quitar la sección "02 — Académico" del inicio (`/panel`).
- Quitar Cohortes y Reportes de los accesos y del menú ☰ (código no se
  borra, igual que en Fase 0 estudiante).
- Consentimientos sale de la barra flotante inferior (los 4 botones fijos);
  queda accesible solo desde el menú ☰ y desde una tarjeta de acceso directo.

## Sprint B — Estudiantes agrupados por cohorte
- Misma pantalla, pero ordenada y agrupada por cohorte (encabezado por
  cohorte, luego los estudiantes de esa cohorte por nombre).

## Sprint C — Material por cohorte
- Nueva sección para admin: subir material (PDF) eligiendo a qué cohorte
  pertenece. Reutiliza el patrón ya usado en el material del profesor.

## Sprint D — Inicio: calendario de sábados por cohorte y hora
- Entre semana: el inicio muestra solo los accesos directos.
- Sábado: tarjetas por cada sesión de cohorte programada ese día (hora +
  nombre de cohorte), cada una con "Registrados / Faltan" — el conteo de
  "registrados" sale de `attendance_events` de esa sesión.

## Sprint E — Asistencia filtrada por cohorte
- Pantalla dedicada de asistencia (lista, no solo el resumen del inicio),
  filtrable por cohorte, guiada por el HTML de referencia.

## Sprint F — QR rotatorio de administración (el más grande)
- Nueva pantalla: administración muestra un QR que rota (no el del
  estudiante — uno nuevo, ligado a la sesión de clase abierta).
- El estudiante lo escanea desde `/asistencia` (ya construido en Fase 0
  estudiante, hoy es una maqueta). Se conecta con una Edge Function nueva
  que valida el código contra la sesión abierta y registra la asistencia del
  estudiante autenticado — nunca confiando en lo que mande el cliente.
- Se decide explícitamente: NO reemplaza `validate-scan` (profesor→estudiante)
  todavía, se agrega como el método vigente para esta fase; el código viejo
  queda intacto para no arriesgar lo que ya funciona.

---

**Orden de ejecución:** A → B → C → D → E → F (de menor a mayor riesgo).
Cada sprint se despliega a producción y se reporta igual que en Fase 0.

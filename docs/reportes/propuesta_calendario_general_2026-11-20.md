# Propuesta: calendario general de clases para Dirección (20-nov-2026)

Pedido del coordinador: un espacio donde Dirección Académica (y Administración) vea todas las clases de sus sedes, de qué hora a qué hora, con su módulo, y pueda moverlas desde ahí. **Aprobada el 20-nov-2026. Parte 1 construida en v1.84 (migración 233); partes 2 y 3 pendientes.**

## Lo que respondiste

- **Vista:** semana por horas, como Google Calendar.
- **Qué ve cada uno:** solo las sedes que el super admin le asignó (como ya pasa con Administración); el super admin ve todas.
- **Mover:**
  - Si una clase se corre a otra semana (feriado), **todas las siguientes del corte se corren una semana**, y con ellas el fin del módulo y los módulos que vienen después.
  - Si se mueve dentro de la **misma semana** (sábado → domingo, reposición), se mueve **solo esa**.
- **Choques** de salón o profesor: se marcan en rojo y Dirección decide si mueve igual.
- **Avisos:** a los estudiantes y al profesor del corte, con la fecha nueva.
- **Horario:** casi siempre igual por corte; los cambios son la excepción.

## Cómo está hoy (y por qué importa)

- Las clases futuras **no existen como filas**. Salen del calendario de módulos (cada módulo va de tal fecha a tal fecha) más el día de clase del corte. La sesión de cada sábado se crea esa misma semana.
- El horario es **texto libre**: "9:00 a.m. – 12:00 p.m.", "2:00 a 6:00 p.m". No se puede dibujar en una cuadrícula por horas ni detectar choques con eso.
- Las vacaciones ya se manejan partiendo un módulo en dos tramos (PTMA-II: Motor de combustión 5–19 dic y 9 ene–6 feb).

## Cómo lo construiría

1. **Horario de verdad por corte:** día(s) de clase, hora de inicio y hora de fin. Convierto los textos actuales una vez (los dos de staging se leen bien) y desde ahí se editan en "Datos del corte". El texto de la planilla se sigue generando igual.
2. **Excepciones por fecha** (tabla nueva): "este sábado no hay clase" o "esta clase pasa a tal día y hora", con el motivo. Una reposición en la misma semana vive solo aquí.
3. **Correr una semana = mover el calendario de módulos:** al soltar una clase en la semana siguiente, todos los tramos desde esa fecha se corren 7 días. Antes de guardar se muestra un resumen como este: *"Se corren 12 clases. Fluidos termina el 5-dic en vez del 28-nov. El corte termina el 2-oct-2027."* El módulo virtual en paralelo (Inglés) **no** se corre, porque no tiene sábado.
4. **Pantalla `/calendario-general`** (Dirección y super admin; Administración solo para ver):
   - Semana con columnas por día y filas por hora. Cada clase es un bloque con el corte, el módulo, el profesor y el salón, con un color por corte.
   - Filtro por sede y por corte, y flechas para cambiar de semana.
   - **En computadora:** se arrastra el bloque. **En el teléfono:** se toca el bloque y aparece "Mover a…", porque arrastrar en una pantalla chica es impreciso.
   - Choques en rojo, por salón o profesor a la misma hora.
5. **Avisos:** notificación a los estudiantes y al profesor del corte, del tipo "Tu clase del sábado 22 pasa al 29".
6. **Sedes para Dirección:** se extiende la asignación de sedes que ya existe para Administración. Si no tiene ninguna asignada, ve todas (para que nadie quede con la pantalla vacía).

## Lo que no hace (a propósito)

- No mueve el módulo virtual en paralelo ni sus fechas de exámenes.
- No cambia exámenes ni tareas con fecha: si una clase se corre y un examen estaba atado a esa semana, el resumen lo advierte para que el profesor lo ajuste.
- No crea varios horarios distintos por semana. Si un corte cambia de horario para siempre, se cambia en "Datos del corte".

## Por partes

- **Parte 1:** horario estructurado, excepciones y la vista semanal solo para ver (con choques).
- **Parte 2:** mover (una clase o correr la cadena) con el resumen previo y los avisos.
- **Parte 3:** arrastrar en computadora y pulir.

## Preguntas que quedan

1. Para **reponer una clase** (por ejemplo, un domingo), ¿se usa el mismo salón y la misma hora, o se eligen al moverla?
2. ¿Administración también puede **mover** clases, o solo verlas?

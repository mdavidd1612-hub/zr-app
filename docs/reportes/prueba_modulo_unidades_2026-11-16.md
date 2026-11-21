# Prueba del módulo Unidades en staging — 16-nov-2026

Cuentas usadas: profesor (V-10000001), estudiante (V-30000002), dirección académica (V-10000004). Solo staging.
Método: sesión real de cada rol contra la base y las funciones de staging (RLS incluido). La interfaz visual no se recorrió con clics porque el panel del navegador estaba oculto.

## Flujo probado (todo OK)
1. Profesor crea unidad, tarea con 10 %, examen de certificación con 20 %, pregunta de opción múltiple y de redacción; publica el examen.
2. Notas: las dos evaluaciones aparecen solas como columnas, con su peso.
3. Una unidad nueva queda sin abrir hasta ponerle fecha o abrirla a mano (regla de diseño); abierta, el estudiante ve el examen y la tarea.
4. Estudiante: ve las preguntas sin la respuesta correcta; no puede editar el examen ni ponerse nota; presenta el examen (10 pts automáticos, 1 pregunta abierta pendiente) y sube la tarea.
5. Profesor recibe la notificación "Examen por corregir".
6. Dirección corrige la redacción (7.5) y califica la tarea (15.5): las notas llegan solas a Notas (17.50 y 15.50).
7. Pantallas de dirección/profesor cargan (panel, unidades, exámenes, notas académicas, configuración, cohortes, módulos, material, personal, calificar).

## Fallo encontrado y corregido
- La nota de una tarea aceptaba valores fuera de escala (67 sobre 20) si se enviaba directo al servidor; solo la pantalla lo limitaba. Migración `211_tope_nota_tarea.sql` (aplicada solo en staging): ahora la base rechaza notas fuera de 0–20.

## Observaciones (no son fallos)
- El profesor no puede corregir un módulo cuando ya pasó la semana de gracia desde que la cohorte avanzó de módulo; se le indica que lo corrija Dirección. Es la regla vigente.
- Un examen en borrador crea su columna en Notas con el peso que se le puso; la pantalla de crear lo guarda con 0 % mientras es borrador para no ocupar el 100 %.

## Limpieza
Se borró todo lo creado en la prueba (unidad, examen, tarea, notas).

## No cubierto
Clics reales en la interfaz (editor visual de texto, arrastrar ítems, visor con "material visto"), pruebas en teléfono, y el segundo intento (remedial) de punta a punta en esta pasada.

## Segunda pasada: remedial
- Certificación con 2 intentos, tope 80 %, política "la más alta": intento 1 = 0, intento 2 con todo bien = 16/20 (tope aplicado), nota oficial 16; el 3.er intento se bloquea con "Ya usaste tu intento y tu remedial en esta certificación."
- Fallo corregido: la pantalla de resultado mostraba 20 (puntos brutos) cuando la nota oficial era 16. Ahora lee la nota oficial del servidor (`examenes/[examId]/page.tsx`).
- Sin verificar en pantalla; el `tsc` local reporta errores de tipos de `pdfjs-dist` ajenos a este cambio.

# SPRINT 5 · ENDURECIMIENTO, CAPACITACIÓN Y ENTREGA
**31 de agosto → sábado 5 de septiembre**
Objetivo: que el 5 de septiembre no haya ninguna sorpresa.

> **Congelamiento de funciones: lunes 31 de agosto.** A partir de ese momento solo se corrigen
> errores. No se agrega nada, por pequeño que parezca. Lo que no esté hecho, no entra.

---

## T-501 · Aplicar la línea de corte · **lunes 31**
**Haz:** revisa qué quedó incompleto y recorta en **este orden exacto**, de arriba hacia abajo:

| Orden | Qué se recorta | A qué se degrada |
|---|---|---|
| 1.º | Reportes avanzados | Exportación a CSV y consultas manuales |
| 2.º | Notificaciones Web Push | Aviso por correo, o el profesor avisa en clase |
| 3.º | Visor de PDF integrado | Descarga directa del archivo |
| 4.º | Preguntas de redacción abierta | Solo opción múltiple y verdadero/falso |
| 5.º | Repositorio de e-learning | Enlaces externos mientras dura la transición |

**Nunca se recorta, bajo ninguna circunstancia:**
consentimiento parental LOPNNA · Row Level Security · asistencia por escaneo · respaldo con
restauración probada.

---

## T-502 · Auditoría de seguridad · **lunes 31**
**Haz:** recorre la matriz de `docs/10_ESQUEMA_BASE_DATOS_V2.md` §7, fila por fila, y verifica
contra las políticas reales de la base:
```bash
psql "$DB_URL" -c "select tablename, policyname, cmd, roles from pg_policies where schemaname='public' order by tablename;"
```
**Verifica:** cada fila de la matriz tiene su política, y ninguna política concede más de lo
que dice la matriz.

---

## T-503 · Intento real de acceso no autorizado · **lunes 31**
**Haz:** con un token real de un estudiante de **producción**, intenta:
1. Leer el perfil de otro estudiante.
2. Leer las notas de otro estudiante.
3. Leer `student_qr_secrets`.
4. Leer `exam_questions` (respuestas correctas).
5. Cambiarse el rol a `super_admin`.
6. Escribir su propia nota.
7. Leer `audit_log`.

**Verifica:** los siete fallan. **Si alguno funciona, la entrega se detiene** hasta arreglarlo.
Este es uno de los tres criterios eliminatorios.

---

## T-504 · Prueba de carga · **martes 1**
**Haz:** 100 usuarios concurrentes, simulando el pico del sábado.
**Verifica:** ninguna petición pasa de 3 segundos y no hay errores de conexión.

---

## T-505 · Segunda restauración de respaldo · **martes 1**
**Haz:** restaura el respaldo de producción a una base descartable. Cronométralo otra vez.
**Verifica:** los datos están completos y el tiempo cumple el objetivo de `docs/OPERACION.md`.
Segundo criterio eliminatorio.

---

## T-506 · Migrar los datos reales · **martes 1 y miércoles 2**
**Haz, en este orden:**
1. Los 13 módulos con sus nombres reales.
2. Las cohortes reales con su módulo actual, profesor y salón.
3. Los profesores, con `create-staff-user`.
4. Las Guías de Aprendizaje digitalizadas.
5. La matrícula completa, por CSV.
6. Las sesiones de clase de septiembre.
7. Aprovisionar el secreto QR de todos los estudiantes.

**Verifica después de cada paso**, no al final. Si el paso 5 falla con 100 filas, quieres
saberlo antes de haber cargado las sesiones.

**Si las guías no llegaron:** carga todo lo demás. El mapa de dominio es Fase 2, así que su
ausencia no bloquea la entrega, pero sí limita los exámenes ligados a competencias. Repórtalo.

---

## T-507 · Capacitación de profesores · **miércoles 2**
**Haz:** 90 minutos, **con sus propios teléfonos en la mano**, no con una demostración en
pantalla. Cada profesor debe, por sí mismo:
1. Entrar a la app.
2. Abrir una clase.
3. Escanear a un compañero.
4. Registrar a alguien manualmente con motivo.
5. Crear un examen de 3 preguntas y publicarlo.
6. Calificar una redacción.
7. Cargar las notas de un módulo.

**Verifica:** cada uno completó los 7 pasos sin ayuda. Si alguno no pudo, ahí hay un problema
de la app, no del profesor.

---

## T-508 · Capacitación de administración · **miércoles 2**
**Haz:** 90 minutos. Cada persona debe lograr, sola:
1. Dar de alta un estudiante y cargar un CSV.
2. Verificar un consentimiento parental.
3. Crear una cohorte y avanzarla de módulo.
4. Sacar los cuatro reportes en CSV.
5. Saber qué hacer si algo falla el sábado.

---

## T-509 · Guías rápidas impresas · **miércoles 2**
**Archivos:** `docs/guia-profesor.md`, `docs/guia-admin.md`, `docs/guia-estudiante.md`.
**Haz:** **una página cada una**, con capturas de pantalla. Imprímelas y pégalas en la pared
del aula y de la oficina.
**Por qué:** es la diferencia entre que el sistema se adopte y que el primer sábado difícil
todos vuelvan al papel.

---

## T-510 · Despliegue a producción · **jueves 3**
**Nunca en viernes.** Si algo se rompe el viernes, se rompe con la academia operando el sábado
y sin nadie para arreglarlo.
**Haz:**
1. `npm run verify` en la rama principal.
2. `supabase db push` a producción.
3. Desplegar en Vercel.
4. Verificar las variables de entorno de producción.
5. Comprobar que `SUPABASE_SERVICE_ROLE_KEY` **no** está en el paquete del navegador:
   ```bash
   npm run build && grep -rn "service_role" .next/static/ || echo "LIMPIO"
   ```
   Debe decir `LIMPIO`.

---

## T-511 · Verificación en producción · **jueves 3**
**Haz, sobre la base de producción real:**
- [ ] Registrar un estudiante de prueba, mayor de edad. Menos de 60 segundos.
- [ ] Registrar uno menor de edad y comprobar el bloqueo por consentimiento.
- [ ] Abrir una sesión y escanear un QR real.
- [ ] Escanear sin señal y comprobar que sincroniza al volver.
- [ ] Crear, publicar, presentar y calificar un examen.
- [ ] Abrir contenido.
- [ ] Enviar feedback.
- [ ] Comprobar que llega una notificación.
- [ ] Instalar la app en un Android y en un iPhone.

**Borra los datos de prueba antes del sábado.**

---

## T-512 · Plan de contingencia impreso · **jueves 3**
**Archivo:** `docs/contingencia.md`, impreso y en la carpeta del profesor.
**Contenido:**

| Si pasa esto | Haz esto |
|---|---|
| No hay señal en el taller | Sigue escaneando. La cola guarda todo y sube solo al volver la señal. |
| La cámara no abre | Usa **Buscar por cédula** con motivo *"falla de cámara"*. |
| El teléfono del profesor se queda sin batería | Usa el de otro profesor. La cola es por dispositivo, pero los escaneos ya subidos no se pierden. |
| Un estudiante no tiene teléfono | Regístralo manualmente con motivo. |
| La app no carga para nadie | Planilla de papel impresa. Carga los datos el lunes desde el panel de administración. |
| Alguien no puede entrar | Verifica su cédula con guion. Si sigue, restablece su contraseña desde el panel. |

**Incluye:** el nombre y el teléfono de quien está de guardia el sábado.

---

## T-513 · Canal de soporte · **jueves 3**
**Haz:** definir el canal (grupo de WhatsApp o teléfono directo), el horario y **quién está de
guardia el sábado 5**. Comunicarlo a profesores y administración por escrito.

---

## T-514 · Día de reserva · **viernes 4**
**No se despliega nada.** Este día existe para lo que salga mal, y siempre sale algo. Si no
sale nada, se usa para repasar las guías impresas y descansar.

---

## SÁBADO 5 DE SEPTIEMBRE · ENTREGA

La app opera en producción con **toda la matrícula**. Todo el equipo presente en la sede.

### Criterios de aceptación
1. Toda la matrícula activa pasa asistencia por la app, sin planilla de papel.
2. **Ningún estudiante menor de edad tiene cuenta activa sin consentimiento parental.**
3. Al menos un examen digital aplicado y calificado parcialmente de forma automática.
4. El contenido del módulo en curso está disponible en la app.
5. El personal opera el sistema sin intervención del equipo técnico.
6. **La prueba de acceso cruzado pasa en producción.**
7. **Existe un respaldo de menos de 24 horas con restauración probada.**
8. El tiempo de pase de lista es medible y **menor** que la línea base del 1 de agosto.

**Los criterios 2, 6 y 7 son eliminatorios.** Si alguno falla, la Fase 1 no se entrega, aunque
todo lo demás funcione perfectamente.

---

## T-515 · Retrospectiva · **domingo 6**
**Haz:** medir contra la línea base del 1 de agosto y responder con números:
- Minutos de pase de lista: antes y ahora.
- Minutos de calificación por examen: antes y ahora.
- Cuántos registros manuales hubo y por qué.
- Cuántos escaneos quedaron en cola sin conexión.
- Qué preguntó más la gente.

**Archivo:** `docs/retrospectiva-fase1.md`.

Con eso se decide qué entra en Fase 1.5 y con qué prioridad. Sin números, esa decisión se toma
por impresión, que es como se construyen las funciones que nadie usa.

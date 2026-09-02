# Sistema de Inscripciones — Especificación Técnica y Plan de Ejecución

> Documento generado a partir del análisis de la reunión del 01/09/2026 (Pedro + equipo).
> Objetivo: convertir lo conversado en requerimientos de ingeniería de software ejecutables, paso a paso.

---

## 1. Resumen ejecutivo

Se venía trabajando una integración de inscripciones vía **página web + Odoo**, pero no se pudo completar por dependencia de soporte externo (Odoo) y tiempo. **Se pivota** a una solución propia:

- Una aplicación descargable como **APK**, que funciona tanto en **móvil** como en **escritorio** (app tipo Chrome/Electron), independiente de Odoo.
- Cada **estudiante** tiene acceso individual (cédula + contraseña).
- El personal (**vendedor/setter**, ej. Érica) inscribe estudiantes desde su propio perfil.
- Alcance actual: **Programas** (largos), **no Cursos** (cortos, 4 semanas) — quedan fuera del sistema por ahora.

---

## 2. Actores del sistema

| Actor | Descripción |
|---|---|
| **Estudiante** | Accede solo a su propia información. Ve únicamente su programa/inscripción. |
| **Vendedor / Setter** (ej. Érica) | Inscribe estudiantes, crea programas/cortes, visualiza sus propias inscripciones. |
| **Administrador (equipo de Pedro)** | Crea usuarios del sistema, asigna contraseñas, da soporte técnico. |

---

## 3. Requerimientos funcionales

### 3.1 Autenticación y distribución de la app
- [ ] Login con **cédula + contraseña**.
- [ ] Contraseña inicial = **código autogenerado** asignado al crear el usuario (a futuro: el usuario podrá crear su propia contraseña).
- [ ] Distribución vía **APK descargable gratis** desde un apartado específico de la página web (pendiente: la página aún no está en producción).
- [ ] La app debe **funcionar igual en móvil y en escritorio**.
- [ ] Cualquiera puede descargar la APK, pero **solo funciona con credenciales válidas de estudiante inscrito**.
- ⚠️ **Contradicción a resolver**: se dijo que la app "se descarga desde la página" pero también que "no depende de Odoo". Aclarar si la descarga desde la web depende de que Odoo/la web estén en producción, o si son cosas independientes.

### 3.2 Módulo de inscripción (rol vendedor)
Formulario "Inscribir al estudiante" con los campos:
- Nombre completo — **obligatorio, sin abreviar** (evita ambigüedad; hay casos de nombres repetidos, ej. dos "Ricardo Hernández").
- Cédula — obligatorio.
- Fecha de nacimiento.
- Correo de contacto.
- Teléfono — ⚠️ **contradicción a resolver**: se pidió que fuera opcional, pero luego se indicó que se necesitan **mínimo 2 números de teléfono**. Definir con el equipo cuál es la regla final.
- Dirección — opcional.
- Selección de **programa/módulo** (dropdown).

### 3.3 Selección y vigencia de programas
- [ ] El dropdown de programas **actualmente muestra programas de años anteriores (ej. 2025)** que ya no deberían aparecer. **Bug/mejora a corregir**: filtrar y mostrar solo programas vigentes (2026 en adelante).
- [ ] Mejora futura (no urgente): ocultar automáticamente un programa **1 mes después** de su fecha de inicio.
- [ ] Confirmado: el sistema es solo para **Programas**, no aplica a Cursos (más cortos).

### 3.4 Generación del código de estudiante
- Formato: `[SIGLAS_PROGRAMA][AÑO][CORRELATIVO]`
  - Ejemplo visto: `PTMA-2026-01` (Programa Técnico Mecánica Automotriz).
- **Decisión tomada en la reunión**: el correlativo (`01`, `02`, …) representa el **orden de creación del programa/corte**, **no** el turno (mañana/tarde), porque la relación turno↔número **no es consistente entre sedes**:
  - En sede Central: 1 = mañana, 2 = tarde.
  - En sede San Antonio: 1 = tarde, 2 = mañana (es simplemente el correlativo de creación en el año).
- Se descarta usar `03`/`04` como números "de turno"; se mantiene la numeración simple `01`, `02`, etc.
- 🐞 **Bug detectado**: el sistema generó el código `04` cuando se esperaba `03`. **Revisar la lógica de generación del correlativo** antes de continuar.

### 3.5 Gestión de programas / cortes / sedes
- [ ] Pantalla para **crear un nuevo programa/corte**, con campos: nombre del programa, sede, turno (mañana/tarde).
- [ ] **Validación de unicidad de nombre** entre programas para evitar confusión (ejemplo actual: `PTMA` = La Morita, `PFTA` = Universidad Central — deben diferenciarse claramente en las siglas al crear uno nuevo).

### 3.6 Panel de inscripciones (rol vendedor)
- [ ] Pantalla donde el vendedor visualiza **las inscripciones que él mismo ha realizado**, para llevar control.

### 3.7 Gestión de usuarios del sistema
- [ ] El equipo de Pedro crea los usuarios (vendedor, admin, etc.) y asigna contraseñas iniciales.
- [ ] Actualmente los usuarios visibles son **de prueba**; falta la creación formal de los usuarios reales.

### 3.8 Mejoras futuras (explícitamente marcadas como "no urgentes")
- [ ] **Foto del estudiante**: captura desde la app con fondo blanco (similar a inscripciones virtuales existentes). Requiere validaciones de tamaño/formato de archivo antes de aceptar la imagen.
- [ ] Diferenciación **visual por color** según sede/programa — se descarta por ahora: la nomenclatura (siglas) ya diferencia, y el estudiante solo ve su propio programa, por lo que no aporta valor inmediato.

---

## 4. Modelo de datos sugerido (borrador)

```
Estudiante
- id / cédula (única)
- nombre_completo (obligatorio)
- fecha_nacimiento
- correo
- telefonos (1..2, definir si mínimo obligatorio)
- direccion (opcional)
- codigo_estudiante (generado)
- foto (futuro)

Programa
- id
- nombre (único)
- siglas
- sede
- turno (mañana/tarde)
- año
- correlativo (orden de creación dentro del año)
- fecha_inicio
- activo (booleano / calculado por fecha)

Inscripcion
- id
- estudiante_id (FK)
- programa_id (FK)
- vendedor_id (FK, quién la registró)
- fecha_inscripcion

Usuario (sistema)
- id
- rol (estudiante / vendedor / admin)
- cédula
- contraseña (hash)
```

---

## 5. Temas abiertos que requieren decisión antes de programar

1. ¿La APK depende de que la página web (Odoo) esté en producción, o es totalmente independiente?
2. Teléfono del estudiante: ¿opcional o mínimo 2 obligatorios?
3. Confirmar y documentar formalmente la fórmula exacta del código de estudiante (siglas + año + correlativo).
4. Definir el criterio exacto de "programa vigente" para el filtro del dropdown (¿por año? ¿por fecha de inicio + 1 mes?).

---

## 6. Plan de ejecución paso a paso

**Fase 0 — Corrección de bugs y decisiones bloqueantes**
1. Reunión corta para cerrar los 4 temas abiertos de la sección 5.
2. Corregir el bug del correlativo (`04` en vez de `03`).

**Fase 1 — Reglas de datos e inscripción**
3. Implementar validación de nombre completo obligatorio (sin abreviaturas).
4. Definir y aplicar la regla final de teléfono(s).
5. Filtrar el dropdown de programas para ocultar años anteriores (2025 y previos).

**Fase 2 — Programas y sedes**
6. Implementar validación de unicidad de nombre/siglas al crear un nuevo programa.
7. Pantalla de creación de programa/corte (nombre, sede, turno).

**Fase 3 — Panel y usuarios**
8. Pantalla de "mis inscripciones" para el rol vendedor.
9. Creación formal de usuarios reales (vendedor, admin) con contraseñas asignadas, eliminando los usuarios de prueba.

**Fase 4 — Distribución**
10. Publicar el apartado de descarga de la APK en la página web (cuando esté en producción).
11. Probar instalación y login en móvil y escritorio.

**Fase 5 — Mejoras futuras (backlog, no bloqueantes)**
12. Autoservicio de creación/cambio de contraseña por el estudiante.
13. Captura y validación de foto del estudiante (fondo blanco, tamaño/formato).
14. Regla automática de "ocultar programa 1 mes después de iniciar".
15. (Descartado por ahora) Diferenciación visual por color.

---

## 7. Notas
- Documento basado exclusivamente en lo conversado en la reunión transcrita; los puntos marcados con ⚠️ deben confirmarse con el equipo antes de implementarse, ya que hubo información contradictoria en la conversación.

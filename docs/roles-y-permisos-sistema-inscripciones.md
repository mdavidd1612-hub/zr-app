# Sistema de Inscripciones — Roles y Permisos

> Documento complementario a `plan-ejecucion-sistema-inscripciones.md`.
> Objetivo: dejar claramente definida la diferencia entre roles administrativos (hasta ahora "Dirección Académica" y "Superadmin" se solapaban) y la matriz de permisos de creación/inscripción.

---

## 1. Problema detectado

Actualmente **Dirección Académica** y **Superadmin** funcionan, en la práctica, como el mismo tipo de administrador — no hay una diferencia clara de alcance entre ambos. Es necesario **separar responsabilidades** por rol para que cada uno tenga un propósito distinto y no se dupliquen funciones.

---

## 2. Roles definidos

| Rol | Enfoque principal |
|---|---|
| **Superadmin** | Control total del sistema. Único rol que puede crear cualquier módulo y cualquier tipo de usuario (administradores, vendedores, etc.). |
| **Dirección Académica** | Todo lo relacionado con **profesores** (creación y gestión) y la parte académica de los programas. |
| **Administración** | **Asistencia y control estudiantil** — seguimiento del estudiante, asistencia, y también gestión de profesores. |
| **Vendedor / Setter** | Rol operativo principal de inscripción de nuevos estudiantes. |
| **Estudiante** | Solo ve su propia información/inscripción (definido en el documento anterior). |

⚠️ **Pendiente de cerrar con el equipo**: aunque ya hay una primera separación (Dirección Académica = profesores/académico, Administración = asistencia/control estudiantil), falta detallar con precisión **cada permiso individual** de estos dos roles para que no quede ambigüedad ante cualquier duda futura del equipo.

---

## 3. Matriz de permisos de creación

| Acción | Superadmin | Dirección Académica | Administración | Vendedor |
|---|:---:|:---:|:---:|:---:|
| Crear cualquier módulo del sistema | ✅ | ❌ | ❌ | ❌ |
| Crear usuarios **administradores** | ✅ | ❌ | ❌ | ❌ |
| Crear usuario **vendedor** | ✅ | ❌ | ❌ | ❌ |
| Crear **profesores** | ✅ (implícito, control total) | ✅ | ✅ | ❌ |
| **Inscribir estudiantes** (cargar nuevos) | ✅ (implícito) | ✅ | ✅ | ✅ (rol principal/operativo) |
| Control de asistencia / seguimiento estudiantil | ✅ (implícito) | — | ✅ | ❌ |

**Nota sobre inscripción de estudiantes**: el **vendedor** sigue siendo el responsable principal/operativo de inscribir estudiantes (es su función central), pero **Administración y Dirección Académica también deben poder hacerlo** como respaldo, no de forma exclusiva del vendedor.

---

## 4. Preguntas abiertas para cerrar con el equipo

1. ¿Qué otros permisos específicos (además de crear profesores y asistencia) le corresponden solo a **Administración** y no a **Dirección Académica**, y viceversa?
2. ¿Dirección Académica y Administración deben poder **editar/eliminar** profesores, o solo crearlos?
3. ¿Pueden Dirección Académica/Administración **editar** inscripciones ya hechas por el vendedor, o solo crear nuevas?
4. ¿El Superadmin es un rol único (una sola persona/cuenta) o pueden existir varias cuentas con ese nivel?

---

## 5. Cómo integrar esto al plan de ejecución existente

Agregar como nueva fase en `plan-ejecucion-sistema-inscripciones.md`:

**Fase 1.5 — Roles y permisos**
1. Cerrar las 4 preguntas abiertas de la sección 4 con el equipo.
2. Implementar el modelo de roles: `superadmin`, `direccion_academica`, `administracion`, `vendedor`, `estudiante`.
3. Aplicar la matriz de permisos de la sección 3 a nivel de backend (control de acceso por rol) y de interfaz (ocultar/mostrar opciones según el rol).
4. Extender el formulario de "Inscribir estudiante" para que sea accesible también desde los perfiles de Dirección Académica y Administración, no solo Vendedor.
5. Pruebas: verificar que cada rol solo pueda ejecutar exactamente las acciones que le corresponden (casos de prueba por rol).

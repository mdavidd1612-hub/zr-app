# SEGURIDAD · ESTADO Y VULNERABILIDADES CONOCIDAS

> Este documento existe porque `npm audit` reporta fallos que **no se deben "arreglar"** con el
> comando que el propio npm sugiere. Sin esta nota, alguien con buena intención corre
> `npm audit fix --force` y rompe el proyecto.
>
> Revisar en cada corte de despliegue (jueves) y antes de cada entrega.

---

## 1. La trampa de `npm audit fix --force`

**No lo corras. Nunca, en este proyecto.**

npm propone resolver los tres fallos actuales instalando `next@9.3.3`. Eso es un retroceso de
siete versiones mayores: destruye el App Router, los Server Components y todo lo que la
aplicación usa. El "arreglo" es infinitamente peor que el fallo.

Si `npm audit` te preocupa, lee esta tabla antes de tocar nada.

---

## 2. Vulnerabilidades abiertas hoy (1 de agosto de 2026)

Las tres vienen **dentro de Next.js**, no de una dependencia que nosotros eligiéramos.
Estamos en `next@16.2.12`, que es **la última versión estable publicada**. No existe todavía
una versión estable que las corrija.

| Paquete | Gravedad | Qué es | ¿Nos afecta hoy? |
|---|---|---|---|
| `postcss` (vía next) | Alta | XSS y lectura de archivos vía `sourceMappingURL` en comentarios CSS | **Riesgo bajo.** Es en tiempo de compilación y todo nuestro CSS lo escribimos nosotros. Un atacante tendría que poder inyectar CSS en el repositorio, y para eso ya tendría acceso de escritura. |
| `sharp` / `libvips` (vía next) | Alta | CVE-2026-33327, 33328, 35590, 35591 | **Riesgo bajo hoy, medio más adelante.** `sharp` procesa imágenes para `next/image`. Hoy no servimos imágenes subidas por usuarios. Cuando entren los avatares (`profiles.avatar_url`) y el material del repositorio, pasa a importar. |

### Qué hacer

1. **Vigilar** las publicaciones estables de Next.js. Cuando salga una `16.2.x` o `16.3.0`
   estable que suba `postcss` y `sharp`, actualizar y volver a correr `npm audit`.
2. **Antes de activar `next/image` sobre archivos subidos por usuarios** (avatares o material
   del repositorio), reevaluar el fallo de `sharp`. Si para entonces sigue abierto, servir esas
   imágenes sin optimización de Next hasta que se cierre.
3. **No** fijar versiones a mano dentro del árbol de `next`. Se rompe de formas difíciles de
   diagnosticar.

---

## 3. Lo que el proyecto ya hace bien

No hace falta añadir nada de esto: ya está construido. Se documenta para que nadie lo
desmonte por descuido.

| Control | Dónde vive |
|---|---|
| Row Level Security en el 100% de las tablas | `012_rls_policies.sql`, verificado en CI |
| Registro de auditoría inmutable (solo inserción) | `fn_block_update_delete` en `002_` |
| El rol nunca llega del cliente: siempre `estudiante` | `handle_new_user()` en `003_` |
| Las contraseñas viven solo en `auth.users`, jamás en tablas propias | `003_`, comentario de cabecera |
| La respuesta correcta de un examen nunca viaja al navegador | vista `v_exam_questions_student` |
| La clave de servicio no puede acabar en el paquete del navegador | paso final de `.github/workflows/ci.yml` |
| El estudiante no puede marcarse competencias a sí mismo | políticas RLS de `mastery_map` en `014_` |
| Ningún umbral de negocio escrito en el código | tabla `system_config` |

---

## 4. Accesibilidad — ya cumplimos WCAG 2.1 nivel AA

`spec/04_PANTALLAS.md` §0 y `spec/06_IDENTIDAD_VISUAL.md` fijan valores que **coinciden con el
estándar internacional**, aunque no lo nombren:

| Lo que exige la spec | Criterio WCAG 2.1 |
|---|---|
| Contraste mínimo 4,5:1 | 1.4.3 Contraste (mínimo) · nivel AA |
| Área táctil mínima 48 × 48 px | 2.5.5 Tamaño del objetivo · supera el AAA (44 × 44) |
| Texto nunca menor de 16 px | 1.4.4 Cambio de tamaño del texto · AA |
| Todo estado de error explica qué hacer después | 3.3.3 Sugerencia ante error · AA |

El manual de identidad documenta 14,2:1 para el navy sobre blanco, que es nivel AAA.
**Al construir cada pantalla, el trabajo no es "añadir accesibilidad": es no bajar de ahí.**

---

## 5. Lo que falta y no es código

Pendiente del Paso 8 de `docs/11_PLAN_EJECUCION_FASE1.md`, **con fecha límite del 14 de
agosto**. Sin esto la aplicación no se puede publicar legalmente:

- [ ] Política de privacidad y términos de uso. Requisito de LOPNNA, y requisito para publicar
      una PWA que pide permiso de cámara.
- [ ] Formato de consentimiento parental para 15-17 años, en versión física y digital.
- [ ] Período de conservación de datos y procedimiento de eliminación a solicitud.

Los tres son responsabilidad de la coordinación legal, no del equipo técnico. Pero si el 14 de
agosto no están, la entrega del 5 de septiembre no puede salir a producción con estudiantes
reales, por buena que esté la aplicación.

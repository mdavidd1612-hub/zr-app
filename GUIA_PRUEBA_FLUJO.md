# 📋 GUÍA PASO A PASO: FLUJO COMPLETO DE ZR APP

Fecha de creación: 5 de Agosto 2026  
Versión: SPRINT_4 (MVP)

---

## 🎯 OBJETIVO

Esta guía te muestra exactamente cómo probar ZR App en su totalidad:
1. **Profesor**: Crea un examen
2. **Estudiante**: Presenta el examen
3. **Profesor**: Califica el examen
4. **Estudiante**: Ve sus notas

---

## 📱 REQUISITOS PREVIOS

- ✅ App corriendo en `http://localhost:3000`
- ✅ Navegador con viewport móvil (375x812px)
- ✅ Dos usuarios de prueba ya creados:
  - **Profesor**: Cedula `V-30000001` | Contraseña: `Prueba123!`
  - **Estudiante**: Cedula `V-30000002` | Contraseña: `Prueba123!`

**Nota**: Si no tienes usuarios, ejecuta:
```bash
npm run db:seed
```

---

## PARTE 1: PROFESOR CREA UN EXAMEN

### Paso 1.1: Acceder al login

**URL**: `http://localhost:3000/login`

```
Aspecto:
- Logo ZR App en centro
- Dos inputs: Cédula y Contraseña
- Botón "Entrar" azul grande
- Links de "Olvidaste tu contraseña?" y "Regístrate"
```

### Paso 1.2: Ingresar credenciales del profesor

**Campos a llenar**:
```
Cédula:      V-30000001
Contraseña:  Prueba123!
```

**Qué esperar**:
- ✅ Se muestra loading en el botón
- ✅ Redirección automática a `/crear-examen`
- ✅ Página muestra "Mis Exámenes" con lista de exámenes

### Paso 1.3: Crear un nuevo examen

**En la página `/crear-examen`**:
- Haz clic en botón azul "✏️ Crear Examen"

**Se abre la página `/crear-examen/nuevo`**:

### Paso 1.4: Llenar datos del examen

**Completa estos campos**:

```
┌─────────────────────────────────────┐
│ DATOS DEL EXAMEN                    │
├─────────────────────────────────────┤
│ Título:      Electricidad Básica    │
│ Módulo:      Módulo 1              │
│ Puntos Máx:  20                     │
│ Duración:    90 (minutos)           │
└─────────────────────────────────────┘
```

**Qué ves**:
- Indicador de puntos: "Puntos asignados: 0 / 20" (en rojo porque falta)
- Botón "+ Agregar Pregunta" disponible

### Paso 1.5: Agregar Pregunta 1 - OPCIÓN MÚLTIPLE

Haz clic en "+ Agregar Pregunta"

**Se muestran 3 opciones**:
- ⭕ Opción Múltiple
- ✓ Verdadero / Falso
- 📝 Redacción Abierta

**Selecciona "Opción Múltiple"**

**Rellena el formulario**:

```
┌──────────────────────────────────────────────┐
│ PREGUNTA 1: OPCIÓN MÚLTIPLE                  │
├──────────────────────────────────────────────┤
│ Enunciado:                                   │
│ "¿Cuál es la función principal del          │
│  alternador en un vehículo?"                 │
│                                              │
│ Opciones:                                    │
│ A) ○ Generar electricidad                    │
│ B) ○ Almacenar energía (RESPUESTA CORRECTA) │
│ C) ○ Controlar la velocidad                 │
│ D) ○ Refrigerar el motor                    │
│                                              │
│ Puntos: 5                                    │
└──────────────────────────────────────────────┘
```

**Pasos exactos**:
1. Escribe el enunciado
2. Rellena opción A: "Generar electricidad"
3. Rellena opción B: "Almacenar energía"
4. **Haz clic en el radio button de B** (para marcar como correcta)
5. Rellena opción C: "Controlar la velocidad"
6. Rellena opción D: "Refrigerar el motor"
7. Cambia puntos a 5
8. Haz clic en "Guardar Pregunta" ✅

**Qué pasa**:
- ✅ Se cierra el editor
- ✅ Aparece la pregunta en la lista con:
  - Número: "1"
  - Texto: "¿Cuál es la función..."
  - Badge: "⭕ Opción múltiple" | "5 puntos"
- ✅ Indicador: "Puntos asignados: 5 / 20" (sigue en rojo)

### Paso 1.6: Agregar Pregunta 2 - VERDADERO/FALSO

Haz clic en "+ Agregar Pregunta" nuevamente

**Selecciona "Verdadero / Falso"**

**Rellena**:

```
┌──────────────────────────────────────────────┐
│ PREGUNTA 2: VERDADERO / FALSO                │
├──────────────────────────────────────────────┤
│ Enunciado:                                   │
│ "El alternador funciona cuando el motor     │
│  está apagado"                               │
│                                              │
│ Respuesta correcta: Falso (selecciona)      │
│ Puntos: 5                                    │
└──────────────────────────────────────────────┘
```

**Pasos**:
1. Escribe el enunciado
2. Haz clic en botón "Falso" (se pone rojo)
3. Cambia puntos a 5
4. Haz clic en "Guardar Pregunta" ✅

**Qué pasa**:
- ✅ Se agrega a la lista
- ✅ Indicador: "Puntos asignados: 10 / 20" (sigue en rojo)

### Paso 1.7: Agregar Pregunta 3 - REDACCIÓN ABIERTA

Haz clic en "+ Agregar Pregunta"

**Selecciona "Redacción Abierta"**

**Rellena**:

```
┌──────────────────────────────────────────────┐
│ PREGUNTA 3: REDACCIÓN ABIERTA                │
├──────────────────────────────────────────────┤
│ Enunciado:                                   │
│ "Explica paso a paso cómo diagnosticar     │
│  un problema en la batería de un auto"     │
│                                              │
│ Rúbrica (guía para calificar):              │
│ - Describe 3 pasos correctos = 10 puntos   │
│ - Usa términos técnicos = 5 puntos         │
│ - Menciona herramientas = 5 puntos         │
│                                              │
│ Puntos: 10                                   │
└──────────────────────────────────────────────┘
```

**Pasos**:
1. Escribe el enunciado
2. Escribe la rúbrica
3. Cambia puntos a 10
4. Haz clic en "Guardar Pregunta" ✅

**Qué pasa**:
- ✅ Se agrega a la lista
- ✅ **Indicador: "Puntos asignados: 20 / 20" (SE PONE VERDE)** ✅
- ✅ Botón "Guardar Examen" se activa

### Paso 1.8: Guardar y publicar el examen

**Haz clic en "Guardar Examen"** (botón azul, antes estaba gris)

**Qué pasa**:
- ✅ Se muestra loading "Guardando..."
- ✅ Redirección a `/crear-examen`
- ✅ El examen aparece en la lista con:
  - Título: "Electricidad Básica"
  - Status: "○ Borrador"
  - Botones: Editar, Publicar, Duplicar

**Haz clic en "🚀 Publicar"**

**Qué pasa**:
- ✅ Se muestra loading "Publicando..."
- ✅ Status cambia a "✓ Publicado"
- ✅ Desaparecen los botones Publicar y Duplicar
- ✅ **El examen está listo para que los estudiantes lo hagan**

---

## PARTE 2: ESTUDIANTE PRESENTA EL EXAMEN

### Paso 2.1: Cerrar sesión del profesor

En la barra de navegación, haz clic en el icono de perfil (debajo a la derecha) o accede a `/logout`

**Qué pasa**:
- ✅ Se cierra sesión
- ✅ Redirección a `/login`

### Paso 2.2: Ingresar como estudiante

**Campos a llenar**:
```
Cédula:      V-30000002
Contraseña:  Prueba123!
```

**Qué esperar**:
- ✅ Redirección a `/` (página de inicio)
- ✅ Se muestra "Bienvenido a ZR Academy"
- ✅ Botones: Mi Carnet, Clases, Exámenes, Material de Estudio
- ✅ Stats: Competencias dominadas, En progreso

### Paso 2.3: Ir a la sección de exámenes

**Haz clic en botón "Exámenes"** (o navega a `/examenes`)

**Qué ves**:
- Título: "Mis Exámenes"
- Lista de exámenes disponibles:
  - "Electricidad Básica" | "Módulo 1" | "3 preguntas" | "20 puntos"
  - Status: "✓ Disponible"

**Haz clic en el examen "Electricidad Básica"**

**Qué pasa**:
- ✅ Redirección a `/examenes/[examId]`
- ✅ Se crea automáticamente un intento
- ✅ Se muestra la **PRIMERA PREGUNTA**

### Paso 2.4: Responder Pregunta 1 - Opción Múltiple

**En pantalla ves**:
```
┌─────────────────────────────────────┐
│ Pregunta 1 de 3                     │
│ ┌─────────────────────────────────┐ │
│ │ ¿Cuál es la función principal   │ │
│ │ del alternador en un vehículo?  │ │
│ │                                 │ │
│ │ (◉) Generar electricidad        │ │
│ │ ( ) Almacenar energía           │ │
│ │ ( ) Controlar la velocidad      │ │
│ │ ( ) Refrigerar el motor         │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [Anterior] [Siguiente]              │
└─────────────────────────────────────┘
```

**Paso 1**: Haz clic en **"Generar electricidad"** (aunque NO es la correcta)

```
(◉) Generar electricidad ← SELECCIONADO (pero es INCORRECTA)
```

**Qué pasa**:
- ✅ Se selecciona la opción
- ✅ Se guarda automáticamente en la base de datos

**Paso 2**: Haz clic en "Siguiente"

**Qué pasa**:
- ✅ Redirección a pregunta 2
- ✅ Se guarda la respuesta anterior

### Paso 2.5: Responder Pregunta 2 - Verdadero/Falso

**En pantalla ves**:
```
┌─────────────────────────────────────┐
│ Pregunta 2 de 3                     │
│ ┌─────────────────────────────────┐ │
│ │ El alternador funciona cuando   │ │
│ │ el motor está apagado           │ │
│ │                                 │ │
│ │ [Verdadero]  [Falso] ◄ CORRECTA │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [Anterior] [Siguiente]              │
└─────────────────────────────────────┘
```

**Paso 1**: Haz clic en **"Falso"** (ES LA CORRECTA)

**Paso 2**: Haz clic en "Siguiente"

### Paso 2.6: Responder Pregunta 3 - Redacción Abierta

**En pantalla ves**:
```
┌──────────────────────────────────────────┐
│ Pregunta 3 de 3                          │
│ ┌──────────────────────────────────────┐ │
│ │ Explica paso a paso cómo diagnosticar│ │
│ │ un problema en la batería de un auto │ │
│ │                                      │ │
│ │ RÚBRICA:                             │ │
│ │ - Describe 3 pasos correctos = 10pt  │ │
│ │ - Usa términos técnicos = 5 puntos   │ │
│ │ - Menciona herramientas = 5 puntos   │ │
│ │                                      │ │
│ │ [Textarea para escribir respuesta]   │ │
│ │ ..............................        │ │
│ │                                      │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ [Anterior] [✓ Entregar]                 │ │
└──────────────────────────────────────────┘
```

**Paso 1**: Haz clic en el textarea y escribe:

```
Paso 1: Inspecciona los terminales de la batería
para verificar si hay corrosión o conexiones sueltas.

Paso 2: Usa un multímetro digital para medir el
voltaje. Debe estar entre 12.6-13.2V en reposo.

Paso 3: Enciende el motor y verifica que el 
alternador cargue la batería (13.5-14.5V).

Si el voltaje baja o no sube, la batería o el
alternador están dañados.
```

**Paso 2**: Haz clic en **"✓ Entregar"** (ES LA ÚLTIMA PREGUNTA)

**Qué pasa**:
- ✅ Se muestra dialog de confirmación: "¿Seguro que entregarás el examen?"
- ✅ Haz clic en "Sí, entregar"
- ✅ Se llama a Edge Function `submit-attempt`
- ✅ Se muestran resultados:

```
RESULTADOS:
✓ Pregunta 1 (Múltiple): ✗ INCORRECTA (0 puntos)
✓ Pregunta 2 (V/F): ✓ CORRECTA (5 puntos)
✓ Pregunta 3 (Redacción): ⏳ PENDIENTE (sera calificada por profesor)

Puntos Auto-Calificados: 5 de 20
Respuestas Pendientes: 1
```

- ✅ Redirección a `/examenes` (con examen mostrando estado "Entregado")

---

## PARTE 3: PROFESOR CALIFICA REDACCIONES

### Paso 3.1: Volver a ingresar como profesor

**Accede a `/login`**:
```
Cédula:      V-30000001
Contraseña:  Prueba123!
```

- ✅ Redirección a `/crear-examen`

### Paso 3.2: Ir a la cola de calificación

**Navega a `/calificar`**

**Qué ves**:
```
┌──────────────────────────────────────┐
│ Respuesta 1 de 1 (100%)              │
│                                      │
│ ESTUDIANTE: María García López       │
│ EXAMEN: Electricidad Básica          │
│ PREGUNTA: Máx 10 puntos              │
│                                      │
│ RÚBRICA:                             │
│ - Describe 3 pasos correctos = 10pt  │
│ - Usa términos técnicos = 5 puntos   │
│ - Menciona herramientas = 5 puntos   │
│                                      │
│ RESPUESTA DEL ESTUDIANTE:            │
│ "Paso 1: Inspecciona los terminales │
│  de la batería para verificar si    │
│  hay corrosión o conexiones sueltas.│
│  Paso 2: Usa un multímetro digital  │
│  para medir el voltaje. Debe estar  │
│  entre 12.6-13.2V en reposo.        │
│  Paso 3: Enciende el motor y        │
│  verifica que el alternador cargue   │
│  la batería (13.5-14.5V)."          │
│                                      │
│ CALIFICACIÓN:                        │
│ Puntuación: [8] (de 10)              │
│ Comentario: Excelente explicación,   │
│ faltó mencionar el fusible          │
└──────────────────────────────────────┘
```

### Paso 3.3: Calificar la respuesta

**Campos**:
1. **Puntuación**: Cambia a `8` (0-10 máximo)
2. **Comentario**: Escribe "Excelente explicación, faltó mencionar el fusible"

**Haz clic en "Guardar y Siguiente"**

**Qué pasa**:
- ✅ Se llama a Edge Function `grade-answer`
- ✅ Se actualiza la base de datos
- ✅ Intento cambia a "Calificado"
- ✅ Se muestran resultados:

```
RESULTADO FINAL:
Pregunta 1: 0 puntos (respuesta incorrecta)
Pregunta 2: 5 puntos (respuesta correcta)
Pregunta 3: 8 puntos (calificado por profesor)

PUNTUACIÓN TOTAL: 13 de 20 puntos
ESTADO: ✓ APROBADO (aprueba con 10)
```

---

## PARTE 4: ESTUDIANTE VE SUS NOTAS

### Paso 4.1: Volver a ingresar como estudiante

**Accede a `/login`**:
```
Cédula:      V-30000002
Contraseña:  Prueba123!
```

### Paso 4.2: Ver página de calificaciones

**Navega a `/notas`**

**Qué ves**:
```
┌─────────────────────────────────────┐
│ MIS CALIFICACIONES                  │
│                                     │
│ Módulo 1 - Electricidad Básica      │
│ ✓ APROBADO                          │
│ Aprueba con 10                      │
│                                     │
│ DETALLES:                           │
│ Teoría:  5                          │
│ Práctica: 8                         │
│ Participación: —                    │
│                                     │
│ ─────────────────────────────────   │
│ CALIFICACIÓN FINAL: 13              │
│ ESTADO: ✓ APROBADO                  │
│ Mínimo requerido: 10                │
└─────────────────────────────────────┘
```

**Qué sucedió**:
- ✅ La base de datos automáticamente calculó la nota final (13)
- ✅ Comparó con el mínimo (10) y muestra "APROBADO"
- ✅ El estudiante ve exactamente qué calificó el profesor

---

## PARTE 5: VER FEEDBACK (OPCIONAL)

### Paso 5.1: Acceder al formulario de feedback

**Navega a `/feedback/[sessionId]`** (o haz clic en link si está disponible)

**Qué ves**:
```
┌──────────────────────────────────┐
│ TU OPINIÓN IMPORTA               │
│ Pregunta 1 de 3                  │
│                                  │
│ ⏱️ 20s                           │
│                                  │
│ ¿Cuánto aprendiste hoy?          │
│                                  │
│ [😞] [😐] [😊] [😄] [🤩]        │
│  1    2    3    4    5           │
│ Muy poco      Excelente          │
└──────────────────────────────────┘
```

### Paso 5.2: Responder el feedback

**Haz clic en "😊" (opción 3)**

- ✅ Se selecciona y avanza a pregunta 2

**Pregunta 2: "¿Qué tan claro fue el profesor?"**
- Haz clic en "😄" (opción 4)

**Pregunta 3: "¿Cuánto disfrutaste la clase?"**
- Haz clic en "🤩" (opción 5)

**Qué pasa al terminar**:
```
┌─────────────────────────────────┐
│ ✨ ¡GRACIAS!                     │
│                                 │
│ Tu respuesta es completamente   │
│ anónima para tu profesor.       │
│                                 │
│ [Volver a Inicio]               │
└─────────────────────────────────┘
```

---

## 📊 RESUMEN DEL FLUJO PROBADO

| Paso | Actor | Acción | Resultado |
|------|-------|--------|-----------|
| 1 | Profesor | Crea examen con 3 preguntas | Examen en borrador |
| 2 | Profesor | Publica el examen | Examen disponible |
| 3 | Estudiante | Responde 3 preguntas | Intento "Entregado" |
| 4 | Edge Fn | Auto-califica objetivas | 5 puntos automáticos |
| 5 | Profesor | Califica redacción | 8 puntos adicionales |
| 6 | DB Trigger | Calcula nota final | 13/20 = APROBADO |
| 7 | Estudiante | Ve sus notas | 13 puntos con estado |
| 8 | Estudiante | Da feedback | Respuestas anónimas |

---

## ✅ CHECKLIST DE VERIFICACIÓN

Marca cada item que hayas probado exitosamente:

### Profesor
- [ ] ✅ Login funciona
- [ ] ✅ Puede crear examen
- [ ] ✅ Puede agregar 3 tipos de preguntas
- [ ] ✅ Indicador de puntos valida suma correcta
- [ ] ✅ Examen se guarda y publica
- [ ] ✅ Puede calificar respuestas abiertas
- [ ] ✅ Ver resultados finales del estudiante

### Estudiante
- [ ] ✅ Login funciona con usuario diferente
- [ ] ✅ Ve examen disponible
- [ ] ✅ Puede responder opción múltiple
- [ ] ✅ Puede responder verdadero/falso
- [ ] ✅ Puede escribir respuesta abierta
- [ ] ✅ Examen se entrega correctamente
- [ ] ✅ Ve resultados con puntos correctos
- [ ] ✅ Ve notas finales
- [ ] ✅ Da feedback anónimo

### Sistema
- [ ] ✅ Auto-calificación de objetivas funciona
- [ ] ✅ Calificación manual se guarda
- [ ] ✅ Nota final se calcula correctamente
- [ ] ✅ Status cambia a "APROBADO"
- [ ] ✅ Feedback se recopila anónimamente

---

## 🐛 POSIBLES ERRORES Y SOLUCIONES

| Error | Causa | Solución |
|-------|-------|----------|
| "Cédula o contraseña incorrecta" | Usuario no existe o dominio email mal | Ejecuta `npm run db:seed` |
| "Examen no disponible" | Estudiante no está en la cohorte | Verifica RLS de exams en Supabase |
| "No se puede calificar" | No hay respuesta guardada | Verifica que el estudiante haya respondido |
| Puntos no suman bien | Formato decimal (ej: 5.5 en lugar de 5) | Usa números enteros |
| Feedback no guarda | Base de datos sin tabla | Verifica migración 008_content_feedback.sql |

---

## 📞 SOPORTE

Si algo no funciona:
1. Abre la consola del navegador (F12)
2. Busca mensajes rojo en la sección "Console"
3. Ve a `/login` y intenta de nuevo
4. Reinicia el servidor: `npm run dev`

**¡Listo! Has probado el flujo completo de ZR App** 🎉

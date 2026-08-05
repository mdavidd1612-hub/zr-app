# 06 · IDENTIDAD VISUAL Y SISTEMA DE DISE�'O
> **Fuente oficial:** `Manual de Identidad ZR Mecademy 2025`.
> Copia local del manual y de los logos en `/marca/`.
> **Estado: CERRADO.** Los colores y tipografías de §2 y §3 son los oficiales de la marca. No
> se cambian ni se "mejoran".

---

## 1. EL CONTEXTO MANDA SOBRE EL GUSTO

Antes de cualquier decisión estética, cinco condiciones que no dependen de nosotros:

| Condición real | Consecuencia de diseño |
|---|---|
| Se usa **de pie, en un taller**, con las manos ocupadas o con guantes | Áreas táctiles enormes, todo alcanzable con un pulgar |
| Se usa **a la luz del día**, a veces bajo sol directo | Contraste alto obligatorio. Los azules claros sobre blanco desaparecen |
| Se usa en **teléfonos de gama media y baja** | Nada de sombras costosas ni degradados complejos |
| El usuario tiene **entre 15 y 25 años** | Estética actual, no institucional-aburrida |
| Hay **poca señal** | Fuentes e iconos siempre locales, nunca descargados |

**Regla que resume todo:** si un elemento no se lee de un vistazo, con el brazo estirado, bajo
el sol y con el teléfono sucio, está mal diseñado.

---

## 2. PALETA OFICIAL

Del manual de identidad, página «Paleta de colores». Son los seis colores de la marca:

| Color | Hex | Nombre interno | Uso en la app |
|---|---|---|---|
| �> Azul noche | `#21284F` | `--zr-navy` | Barra superior, barra inferior, texto principal |
| �YY� Azul institucional | `#1E4D96` | `--zr-blue-deep` | Encabezados de sección, énfasis |
| �Y"� **Azul de marca** | `#3869B1` | `--zr-blue` | **Color del logo. Botón de acción principal** |
| �Y"� Azul medio | `#6590CB` | `--zr-blue-mid` | Estados activos, bordes de foco |
| �Y'� Azul claro | `#98BAE3` | `--zr-blue-light` | Fondos de tarjeta, franjas informativas |
| �o Blanco | `#FFFFFF` | `--zr-white` | Superficies, texto sobre azul |

**Razón de la marca** (textual del manual): los azules comunican profesionalismo y confianza,
evocan conocimiento y concentración, y su asociación con la innovación refleja los métodos de
enseñanza de la academia.

### Contraste verificado
Calculado sobre la fórmula de WCAG. **No cambies estas combinaciones sin volver a medir.**

| Combinación | Ratio | Cumple |
|---|---|---|
| `#21284F` sobre blanco | **14,2:1** | AAA |
| Blanco sobre `#21284F` | **14,2:1** | AAA |
| Blanco sobre `#1E4D96` | **8,2:1** | AAA |
| Blanco sobre `#3869B1` | **5,5:1** | AA |
| `#21284F` sobre `#98BAE3` | **7,1:1** | AAA |
| Blanco sobre `#6590CB` | 3,4:1 | �O **Solo para texto de 24 px o más** |

> `#98BAE3` y `#6590CB` **nunca llevan texto blanco encima** en tamaño normal. Sobre esos dos,
> el texto va en `#21284F`.

---

## 3. LA CAPA FUNCIONAL �?" lo que el manual no cubre

**Hallazgo que hay que decir claro:** la paleta oficial es **monocromática azul**. Es una
identidad correcta y coherente para papelería, uniformes y redes sociales �?" para lo que fue
diseñada. Pero una interfaz operativa necesita algo que un manual de marca no contempla:
**señalar estados de forma inequívoca.**

El caso concreto: la pantalla de escaneo tiene que decirle al profesor, a un metro de
distancia, de reojo y bajo el sol, si el estudiante quedó registrado o si hubo un problema.
En azul sobre azul eso es imposible. Y confundirse ahí significa marcar mal la asistencia de
alguien.

**Decisión:** se añade una capa de **color semántico**, separada de la marca, con tres reglas
que la mantienen subordinada a la identidad:

1. Se usa **solo para comunicar estado**, jamás como decoración ni como fondo de página.
2. **Nunca toca el logo.** El manual prohíbe expresamente recolorearlo (página «Usos correctos
   e incorrectos»); esa prohibición se respeta al pie de la letra.
3. Aparece en superficies pequeñas y momentáneas: franjas de resultado, insignias de estado,
   texto de una nota. El azul sigue siendo el color de la aplicación.

| Estado | Hex | Dónde aparece |
|---|---|---|
| �o. �?xito | `#16A34A` | Asistencia registrada, módulo aprobado, competencia dominada |
| �s�️ Advertencia | `#EAB308` | «Ya registrado», consentimiento pendiente |
| �O Error | `#DC2626` | Código vencido, módulo reprobado, fallo de escaneo |

Es la misma lógica de un semáforo dentro de un edificio corporativo: el edificio tiene su
color, el semáforo tiene el suyo, y nadie los confunde.

---

## 4. TOKENS �?" TODO EL COLOR VIVE AQUÍ

```css
/* app/globals.css �?" �sNICO lugar donde se define color en todo el proyecto */
:root {
  /* Marca �?" Manual de Identidad ZR Mecademy 2025 */
  --zr-navy:        #21284F;
  --zr-blue-deep:   #1E4D96;
  --zr-blue:        #3869B1;   /* color del logo */
  --zr-blue-mid:    #6590CB;
  --zr-blue-light:  #98BAE3;
  --zr-white:       #FFFFFF;

  /* Capa funcional �?" estados, nunca decoración, nunca sobre el logo */
  --zr-success:     #16A34A;
  --zr-warning:     #EAB308;
  --zr-error:       #DC2626;

  /* Superficies derivadas */
  --zr-bg:          #F5F7FB;   /* blanco azulado, descansa la vista bajo sol */
  --zr-surface:     #FFFFFF;
  --zr-border:      #C9D6EA;

  /* Texto */
  --zr-text:        #21284F;   /* el navy de marca ES el color de texto */
  --zr-text-muted:  #4A5578;
  --zr-text-on-dark:#FFFFFF;

  /* Medidas */
  --zr-touch-min:   48px;
  --zr-button-h:    56px;
  --zr-button-h-lg: 64px;
  --zr-radius:      12px;
  --zr-gap:         16px;
  --zr-page-pad:    16px;
}
```

**Si un componente tiene un color escrito directamente, es un error.** Se corrige.

---

## 5. TIPOGRAFÍA OFICIAL

Del manual: **Roboto (principal)** y **Raleway (secundaria)**.

Instalación local �?" **nunca desde Google Fonts**, porque sin señal no cargarían:

```bash
npm install @fontsource-variable/roboto @fontsource-variable/raleway
```

| Uso | Familia | Tamaño | Peso |
|---|---|---|---|
| Nota grande, resultado de escaneo | **Raleway** | 40 px | 700 |
| Título de pantalla | **Raleway** | 24 px | 700 |
| Subtítulo, nombre en tarjeta | **Raleway** | 20 px | 600 |
| **Texto general, botones, formularios** | **Roboto** | **16 px** | 400 |
| Etiqueta de campo | Roboto | 14 px | 500 |
| Números, cédulas, códigos | Roboto | según contexto | 500 |
| **Mínimo absoluto** | �?" | **14 px** | �?" |

**Criterio de reparto:** Raleway para lo que se lee de un vistazo (títulos, cifras grandes);
Roboto para lo que se lee de cerca (texto corrido, formularios, datos). Roboto distingue bien
el `1` del `l` y el `0` de la `O`, lo que importa cuando en pantalla hay cédulas y torques.

**Nunca uses texto por debajo de 14 px.** Si algo no cabe a 14 px, sobra.

---

## 6. LOGO

Archivos en `/marca/`:

| Archivo | Cuándo usarlo |
|---|---|
| `logo-color.svg` | Sobre fondo blanco o claro. **Uso por defecto** |
| `logo-blanco.svg` | Sobre `--zr-navy` o `--zr-blue`. Barra superior de la app |
| `logo-oscuro.svg` | Sobre fondos claros cuando se necesita máxima sobriedad |
| `isotipo-zr.svg` | Solo el bloque «ZR». Íconos de la PWA, avatar, espacios cuadrados |
| `icon.ico` | Favicon |

### Reglas del manual �?" se cumplen sin excepción
- **Nunca recolorear el logo.** El manual muestra explícitamente el logo en verde y en gris
  claro como usos prohibidos.
- **Nunca deformarlo, rotarlo ni aplicarle sombras o degradados.**
- Debe ser siempre fácil de ver: si el fondo compite, se cambia la versión del logo, no el logo.
- Espacio libre alrededor: como mínimo, la altura del bloque «ZR» por cada lado.

### Íconos de la PWA
Se generan a partir de `isotipo-zr.svg` sobre fondo `--zr-blue` (`#3869B1`):
`icon-192.png`, `icon-512.png` y una versión `maskable` con margen de seguridad del 20%.

---

## 7. APLICACI�"N A LA APP

| Zona | Color |
|---|---|
| Barra superior | `--zr-navy` con logo blanco |
| Barra inferior de navegación (estudiante) | `--zr-navy`, ícono activo en `--zr-blue-light` |
| Fondo de página | `--zr-bg` |
| Tarjetas | `--zr-surface` con borde `--zr-border` |
| **Botón de acción principal** | `--zr-blue` con texto blanco |
| Botón secundario | Borde `--zr-blue`, texto `--zr-blue`, fondo transparente |
| Franja informativa | `--zr-blue-light` con texto `--zr-navy` |
| Marco del QR en el carnet | `--zr-navy` |
| Franja de resultado de escaneo | `--zr-success` / `--zr-warning` / `--zr-error`, a pantalla completa |
| Nota aprobada / reprobada | `--zr-success` / `--zr-error` |

---

## 8. VOZ Y TONO

| Regla | Sí | No |
|---|---|---|
| Tutea siempre | *"Ya tienes nota"* | *"Usted tiene una calificación disponible"* |
| Español de Venezuela, sin regionalismos forzados | *"Tu profesor habilitó un examen"* | *"Tu profe te puso una prueba, pana"* |
| Los errores dicen qué hacer | *"El código venció. Pídele al estudiante que muestre el nuevo."* | *"Error 403: token inválido"* |
| Sin jerga técnica jamás | *"No hay internet. Se guardó y se enviará solo."* | *"Fallo de sincronización con el backend"* |
| Celebra lo que costó, no lo trivial | *"Dominaste el diagnóstico de batería"* | *"¡Iniciaste sesión! �YZ?"* |
| Nunca culpes al usuario | *"No encontramos esa cédula"* | *"Escribiste mal la cédula"* |

**Formato local siempre:** coma decimal (`16,5`), fechas `sáb 15 ago 2026`, horas en 24 h
(`08:30`), cédula con guion (`V-30000001`).

---

## 9. ICONOGRAFÍA

`lucide-react`, local. Trazo 2 px, mínimo 24 px (32 px en acciones principales).

```bash
npm install lucide-react
```

| Concepto | Icono |
|---|---|
| Carnet / inicio | `IdCard` |
| Clases / asistencia | `CalendarCheck` |
| Exámenes | `ClipboardList` |
| Material de estudio | `BookOpen` |
| Escanear | `ScanLine` |
| Progreso / dominio | `Target` |
| Próximo sábado | `CalendarClock` |
| Refrigerio | `Coffee` |
| Sin conexión | `CloudOff` |
| Aprobado | `CircleCheck` |
| Error | `CircleAlert` |

No cambies un icono entre pantallas: la consistencia es lo que hace que se aprendan solos.

---

## 10. LOS TRES MOMENTOS QUE DEFINEN LA MARCA

Si solo se pulen tres pantallas al detalle, que sean estas:

**10.1 · El resultado del escaneo (profesor).** Es lo que más veces se ve: cien veces cada
sábado. Franja a pantalla completa en color semántico sólido, nombre del estudiante en Raleway
40 px, más un sonido corto. Se tiene que leer a un metro, de reojo, mientras el profesor mira
al estudiante y no al teléfono.

**10.2 · La nota que aparece (estudiante).** El momento de mayor carga emocional de la
aplicación. La nota enorme, en `--zr-success` o `--zr-error`, con el umbral debajo en pequeño:
*"Aprueba con 12"*. **Sin animaciones de celebración**: para quien reprobó, un confeti es una
burla.

**10.3 · La pantalla de inicio del estudiante.** Los primeros diez segundos deciden si la app
se percibe como *"algo que me obligan a usar"* o *"algo mío"*. Orden obligatorio
(ver `docs/13_DISENO_DE_PRODUCTO_ESTUDIANTE.md` §9):
**lo que viene el próximo sábado �?' mi progreso �?' el carnet con el QR.**

---

## 11. LO QUE FALTA

- [ ] Generar `icon-192.png`, `icon-512.png` y la versión maskable desde `isotipo-zr.svg`.
- [ ] Confirmar el nombre visible de la aplicación: **ZR App** o **ZR Mecademy**.
      *(Propuesta: en la barra va el logo, no texto; en la tienda y en el manifiesto,
      «ZR Mecademy».)*


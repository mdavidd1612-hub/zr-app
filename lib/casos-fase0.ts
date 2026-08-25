/**
 * Banco de casos conceptuales · Fase 0 (docs/14_FASE0_PLAN_SPRINTS.md, Sprint 2).
 *
 * De lunes a viernes el estudiante trabaja un caso corto de diagnóstico,
 * conceptual y sin cifras. El sábado no hay caso: hay clase, y lo que
 * corresponde ese día es marcar asistencia (mostrando el carnet al profesor).
 *
 * Contenido cerrado por la academia para la demo del 5 de septiembre de 2026.
 * No se califica ni se envía a ningún lado: es reflexión guiada con una
 * respuesta de referencia al final, igual que en el prototipo del equipo.
 */

export interface PasoCaso {
  pregunta: string
  opciones: string[]
  correcta: number
}

export interface Caso {
  dia: string
  titulo: string
  escenario: string
  pasos: PasoCaso[]
  reflexion: string
  referencia: {
    que: string
    porQueNo: string[]
    quedaClaro: string
  }
}

export const CASOS: Record<number, Caso> = {
  1: {
    dia: 'Lunes',
    titulo: 'El carro que arranca flojo en la mañana',
    escenario:
      'Un cliente trae su carro. Dice que en la mañana, cuando arranca por primera vez, el motor «se demora y suena flojo», pero que si lo intenta una segunda vez arranca bien. En la tarde nunca le ha pasado.',
    pasos: [
      {
        pregunta: '¿Cuál es tu primera hipótesis?',
        opciones: [
          'El sistema de arranque no está recibiendo suficiente energía',
          'El motor de arranque está dañado y hay que cambiarlo',
          'El combustible no está llegando bien',
          'Es normal en las mañanas frías, no hay falla',
        ],
        correcta: 0,
      },
      {
        pregunta: '¿Qué revisarías primero?',
        opciones: [
          'El estado y la conexión de los bornes, antes de desconectar nada',
          'Desmontar el motor de arranque para revisarlo',
          'El filtro de combustible',
          'Nada: le digo que lo deje encendido más tiempo',
        ],
        correcta: 0,
      },
    ],
    reflexion:
      '¿Por qué crees que pasa en la mañana y no en la tarde? ¿Qué te dice que arranque al segundo intento?',
    referencia: {
      que: 'El sistema de arranque no está recibiendo la energía que necesita. El patrón de «en frío falla, en caliente no» y de «al segundo intento sí» apunta a que la energía disponible está justo en el límite.',
      porQueNo: [
        'Motor de arranque dañado — si estuviera dañado fallaría también en la tarde.',
        'Combustible — un problema de combustible no mejora al segundo intento inmediato.',
        'Es normal — un arranque «flojo» es un aviso temprano, no una normalidad.',
      ],
      quedaClaro:
        'Antes de desmontar nada, se revisa lo que está a la vista y lo que es reversible.',
    },
  },
  2: {
    dia: 'Martes',
    titulo: 'La luz que se pone débil al frenar',
    escenario:
      'Una clienta dice que cuando frena de noche, las luces del tablero «se ponen flojas» por un momento y luego vuelven. El carro nunca se ha apagado y arranca sin problema.',
    pasos: [
      {
        pregunta: '¿Cuál es tu primera hipótesis?',
        opciones: [
          'Hay una conexión de mala calidad en el circuito, que se nota cuando sube la demanda',
          'Las luces del tablero están quemadas',
          'El sistema de frenos está fallando',
          'Es un defecto normal de fábrica del modelo',
        ],
        correcta: 0,
      },
      {
        pregunta: '¿Qué revisarías primero?',
        opciones: [
          'Los puntos de conexión y las masas, buscando suciedad, holgura o corrosión',
          'Cambiar todas las luces del tablero',
          'Purgar el sistema de frenos',
          'Nada, porque el carro funciona',
        ],
        correcta: 0,
      },
    ],
    reflexion: '¿Por qué el síntoma aparece justo al frenar y no en otro momento?',
    referencia: {
      que: 'Casi siempre es una conexión de mala calidad. Al frenar de noche se suman varios consumos a la vez, y una conexión floja o sucia deja de aguantar cuando la demanda sube.',
      porQueNo: [
        'Luces quemadas — una luz quemada no vuelve sola.',
        'Sistema de frenos — el freno solo activa el consumo, el problema no está ahí.',
        'Defecto de fábrica — es la respuesta que cierra la puerta a buscar.',
      ],
      quedaClaro:
        'Un síntoma que aparece justo cuando sube la demanda, y que se corrige solo, casi nunca es una pieza rota.',
    },
  },
  3: {
    dia: 'Miércoles',
    titulo: 'Dos mecánicos, dos diagnósticos',
    escenario:
      'Un carro entra con una falla. Un compañero dice que es una cosa; otro dice que es otra distinta. Los dos tienen argumentos y ninguno ha medido nada todavía. El cliente está esperando.',
    pasos: [
      {
        pregunta: '¿Qué haces primero?',
        opciones: [
          'Preguntar qué observación concreta sostiene cada hipótesis',
          'Hacerle caso al que tiene más años de experiencia',
          'Empezar a desarmar por donde dice el primero',
          'Decirle al cliente que vuelva mañana',
        ],
        correcta: 0,
      },
      {
        pregunta: '¿Cómo decides por dónde seguir?',
        opciones: [
          'Por la revisión que descarte más posibilidades de una vez, aunque no confirme ninguna',
          'Por la que sea más rápida de hacer',
          'Por la que confirme la hipótesis que a ti te parece correcta',
          'Por la que menos ensucie',
        ],
        correcta: 0,
      },
    ],
    reflexion:
      'Explica por qué conviene más una revisión que descarta varias causas que una que confirma solo una.',
    referencia: {
      que: 'Se le pide a cada uno la observación concreta en la que se apoya, y se elige la revisión que descarte más caminos de una vez.',
      porQueNo: [
        'Los años de experiencia ayudan a generar hipótesis, no a saltarse la comprobación.',
        'Empezar a desarmar es la decisión más cara y menos reversible.',
        'Que vuelva mañana no resuelve nada y pierde al cliente.',
      ],
      quedaClaro:
        'Cuando dos hipótesis compiten, la revisión que más vale es la que elimina más, no la que confirma una.',
    },
  },
  4: {
    dia: 'Jueves',
    titulo: 'Lo que el cliente no cuenta',
    escenario:
      'Llega un carro con una falla que aparece «de vez en cuando». El cliente no sabe decir cuándo. No puedes reproducirla en el taller: probaste media hora y funcionó perfecto todo el tiempo.',
    pasos: [
      {
        pregunta: '¿Cuál es tu mejor jugada?',
        opciones: [
          'Preguntarle al cliente por el contexto: hora, clima, carga, qué estaba haciendo',
          'Decirle que no tiene nada, porque no falló',
          'Cambiar la pieza que más suele fallar en ese modelo',
          'Dejarlo encendido todo el día a ver si pasa',
        ],
        correcta: 0,
      },
      {
        pregunta: '¿Qué pregunta sirve más?',
        opciones: [
          '«¿Pasa más cuando el carro lleva rato apagado, o cuando ya lleva rato andando?»',
          '«¿Usted cree que es caro?»',
          '«¿Quién se lo arregló la última vez?»',
          '«¿Qué marca de repuestos prefiere?»',
        ],
        correcta: 0,
      },
    ],
    reflexion:
      '¿Por qué una falla intermitente que depende del contexto es una pista y no un obstáculo?',
    referencia: {
      que: 'Se investiga el contexto. Una falla intermitente casi nunca es aleatoria: depende de algo, y ese «algo» es la pista más valiosa que hay.',
      porQueNo: [
        '«No tiene nada» — que no falle en media hora no significa que no falle.',
        'Cambiar la pieza que más falla es adivinar con el dinero del cliente.',
        'Dejarlo encendido todo el día gasta tiempo sin controlar la variable que importa.',
      ],
      quedaClaro: 'El cliente es el único testigo de la falla. Saber preguntarle es una habilidad técnica.',
    },
  },
  5: {
    dia: 'Viernes',
    titulo: 'La reparación que duró tres días',
    escenario:
      'Un carro vuelve al taller. Hace tres días se reparó lo que se diagnosticó, el cliente se fue contento, y ahora está de vuelta con el mismo síntoma.',
    pasos: [
      {
        pregunta: '¿Qué es lo más probable?',
        opciones: [
          'Se trató un efecto y no la causa que lo produce',
          'El repuesto que se puso venía malo',
          'El cliente hizo algo mal',
          'Es mala suerte',
        ],
        correcta: 0,
      },
      {
        pregunta: '¿Por dónde empiezas ahora?',
        opciones: [
          'Por revisar qué evidencia sostuvo el diagnóstico anterior, y qué no se comprobó',
          'Por repetir la misma reparación con otro repuesto',
          'Por revisar todo el carro desde cero, ignorando lo anterior',
          'Por cobrarle de nuevo la revisión',
        ],
        correcta: 0,
      },
    ],
    reflexion: 'Explica la diferencia entre tratar un efecto y tratar la causa. Da un ejemplo tuyo.',
    referencia: {
      que: 'Lo más probable es que se atendió un efecto y no la causa. Una pieza que se daña puede ser la víctima de otra cosa que sigue ahí.',
      porQueNo: [
        'Repuesto malo ocurre, pero es la primera explicación que uno quiere creer sin comprobar.',
        'Culpa del cliente cierra la investigación y daña la relación.',
        'Mala suerte no es una categoría técnica.',
      ],
      quedaClaro: 'Un trabajo que vuelve no es un fracaso: es la información más honesta que da el oficio.',
    },
  },
}

/** 1=lunes … 6=sábado. Domingo (0) no tiene actividad académica. */
export function diaSemanaISO(fecha: Date): number {
  const d = fecha.getDay()
  return d === 0 ? 7 : d
}

export function lunesDeLaSemana(fecha: Date): Date {
  const copia = new Date(fecha)
  const dia = diaSemanaISO(copia)
  copia.setDate(copia.getDate() - (dia - 1))
  copia.setHours(0, 0, 0, 0)
  return copia
}

export function fechaISO(fecha: Date): string {
  return fecha.toISOString().slice(0, 10)
}

import { describe, expect, it } from 'vitest'
import { esDiaDeClase } from '../../lib/dias-clase'

// 2026-09-19 es sábado, 2026-09-15 es martes, 2026-09-20 es domingo.
describe('esDiaDeClase', () => {
  it('sábados: el sábado sí, el martes no', () => {
    expect(esDiaDeClase('Sábados', '2026-09-19')).toBe(true)
    expect(esDiaDeClase('Sábados', '2026-09-15')).toBe(false)
  })

  it('sin texto o sin día reconocible se asume sábado', () => {
    expect(esDiaDeClase(null, '2026-09-19')).toBe(true)
    expect(esDiaDeClase('', '2026-09-15')).toBe(false)
    expect(esDiaDeClase('por definir', '2026-09-19')).toBe(true)
  })

  it('varios días, con o sin tildes y mayúsculas', () => {
    expect(esDiaDeClase('SABADOS y Domingos', '2026-09-20')).toBe(true)
    expect(esDiaDeClase('Martes y jueves', '2026-09-15')).toBe(true)
    expect(esDiaDeClase('Martes y jueves', '2026-09-19')).toBe(false)
  })
})

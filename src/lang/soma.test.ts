import { describe, expect, it } from 'vitest'
import { resolve } from './resolve'

const abre = (...fs: string[]) => {
  const r = resolve(fs.map((fonte, i) => ({ id: `l${i}`, fonte })))
  return { r, a: r.analises[r.analises.length - 1] }
}
const calc = (...fs: string[]) => {
  const { r, a } = abre(...fs)
  expect(a.erro).toBeUndefined()
  expect(a.faltando).toEqual([])
  return a.calcula!(r.numeros)
}

/** Borda do triângulo (0,0) → (1,0) → (0,1) → (0,0), um segmento por linha. */
const TRIANGULO = [
  'A(t)=(t,0),\\ 0\\le t\\le1',
  'B(t)=(1-t,t),\\ 0\\le t\\le1',
  'D(t)=(0,1-t),\\ 0\\le t\\le1',
]

describe('integral de linha por pedaços', () => {
  it('borda de triângulo bate com Green', () => {
    const s = calc('F=(-y,x)', ...TRIANGULO, '\\int_{A}F\\cdot dr+\\int_{B}F\\cdot dr+\\int_{D}F\\cdot dr')
    expect(s.rotulo).toBe('Soma de integrais')
    expect(s.selo).toBe('exato')
    expect(s.exato).toBe('1')
    const g = calc('F=(-y,x)', 'R:0\\le x\\le1,\\ 0\\le y\\le1-x', '\\operatorname{green}\\left(F,R\\right)')
    expect(s.valor).toBeCloseTo(g.comparacao!.valorA, 9)
    expect(s.passos.filter((p) => p.titulo.startsWith('Parcela'))).toHaveLength(3)
  })

  it('segmento escrito como (1 − t)P + tQ', () => {
    const s = calc('F=(-y,x)', 'P=(1,0)', 'Q=(0,1)', 'B(t)=(1-t)P+tQ,\\ 0\\le t\\le1', '\\int_{B}F\\cdot dr+\\int_{B}F\\cdot dr')
    expect(s.exato).toBe('2')
  })

  it('coeficientes, subtração, controle deslizante e constante', () => {
    expect(calc('F=(y,x)', 'C(t)=(t,t^2),\\ 0\\le t\\le1', '2\\int_{C}F\\cdot dr-\\int_{C}F\\cdot dr').exato).toBe('1')
    expect(calc('F=(y,x)', 'C(t)=(t,t^2),\\ 0\\le t\\le1', '\\frac{\\int_{C}F\\cdot dr}{2}').exato).toBe('\\frac{1}{2}')
    expect(calc('k=3', 'F=(y,x)', 'C(t)=(t,t^2),\\ 0\\le t\\le1', 'k\\int_{C}F\\cdot dr').exato).toBe('3')
    expect(calc('F=(y,x)', 'C(t)=(t,t^2),\\ 0\\le t\\le1', '\\int_{C}F\\cdot dr+\\pi').exato).toBe('1 + \\pi')
  })

  it('mistura linha, região e integral com limites', () => {
    const s = calc('C(t)=(\\cos t,\\sin t),\\ 0\\le t\\le2\\pi', 'R:0\\le x\\le1,\\ 0\\le y\\le1', '\\oint_{C}-y\\,dx+x\\,dy-\\iint_{R}2\\,dA+\\int_0^1x\\,dx')
    expect(s.valor).toBeCloseTo(2 * Math.PI - 2 + 0.5, 9)
    expect(s.selo).toBe('exato')
  })

  it('parcela sem primitiva deixa a soma numérica, sem mentir exatidão', () => {
    const s = calc('C(t)=(t,0),\\ 0\\le t\\le1', '\\int_{C}e^{x^2}\\,ds+\\int_{C}x\\,ds')
    expect(s.selo).toBe('numerico')
    expect(s.valor).toBeCloseTo(1.4626517459 + 0.5, 8)
  })

  it('soma desenha as curvas de todas as parcelas', () => {
    const { a } = abre('F=(-y,x)', ...TRIANGULO, '\\int_{A}F\\cdot dr+\\int_{B}F\\cdot dr')
    expect(a.tipo).toBe('calculo')
  })

  it.each<[string, RegExp]>([
    ['\\sin\\left(\\int_{C}F\\cdot dr\\right)', /só entra em somas e múltiplos/],
    ['x\\int_{C}F\\cdot dr', /não pode depender de x/],
    ['\\int_{C}F\\cdot dr\\cdot\\int_{C}F\\cdot dr', /só entra em somas/],
  ])('recusa %s com mensagem clara', (f, msg) => {
    const { a } = abre('F=(y,x)', 'C(t)=(t,t^2),\\ 0\\le t\\le1', f)
    expect(a.erro).toMatch(msg)
  })
})

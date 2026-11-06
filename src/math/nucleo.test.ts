import { describe, expect, it } from 'vitest'
import { parseExpr } from '../lang/parser'
import { type Valor, escopoVazio, paraValor } from '../lang/valor'
import { type Expr, S, avalia, chave, subst } from './alg'
import { deriva } from './diff'
import { primitiva } from './integra'
import { compila, executa, funcao } from './lote'
import { integraNumerico, reconhece } from './quad'
import { tex } from './tex'

const fun = new Set<string>()
export const E = (s: string): Expr => paraValor(parseExpr(s, { nomes: [], funcoes: fun }), escopoVazio()) as Expr
const V = (s: string): Valor => paraValor(parseExpr(s, { nomes: [], funcoes: fun }), escopoVazio())

const iguala = (a: string, b: string) => expect(chave(E(a))).toBe(chave(E(b)))

describe('forma canônica', () => {
  it.each([
    ['x+x', '2x'], ['x*x', 'x^2'], ['x^2*x^3', 'x^5'], ['2(x+1)', '2x+2'], ['x/x', '1'], ['(x+1)/(x+1)', '1'],
    ['sqrt(4)', '2'], ['sqrt(8)', '2sqrt(2)'], ['sqrt(1/4)', '1/2'], ['sqrt(x^2)', '|x|'], ['sqrt(x^4)', 'x^2'],
    ['sin(pi/6)', '1/2'], ['cos(pi)', '-1'], ['tan(pi/4)', '1'], ['sin(pi/4)', 'sqrt(2)/2'], ['cos(5pi/3)', '1/2'],
    ['sin^2 x + cos^2 x', '1'], ['r^2 cos^2 t + r^2 sin^2 t', 'r^2'], ['cosh^2 x - sinh^2 x', '1'],
    ['a^2 sin^2 p cos^2 t + a^2 sin^2 p sin^2 t + a^2 cos^2 p', 'a^2'],
    ['ln(e^x)', 'x'], ['e^(ln x)', 'x'], ['e^(2 ln x)', 'x^2'], ['sin(-x)', '-sin x'], ['cos(-x)', 'cos x'],
    ['asin(1/2)', 'pi/6'], ['atan(1)', 'pi/4'], ['acos(-1)', 'pi'], ['1/sqrt(2)', 'sqrt(2)/2'], ['2/sqrt(2)', 'sqrt(2)'], ['|-3x|', '3|x|'],
    ['(x^(1/2))^2', 'x'], ['(2x)^3', '8x^3'], ['x^0', '1'], ['0*x', '0'], ['1/3+1/6', '1/2'],
  ])('%s = %s', iguala)

  it('imprime como no caderno', () => {
    expect(tex(E('1-x^2'))).toBe('1 - x^{2}')
    expect(tex(E('8pi/3'))).toBe('\\frac{8 \\pi}{3}')
    expect(tex(E('x^2+y^2-1'))).toBe('x^{2} + y^{2} - 1')
    expect(tex(E('1/(x+1)'))).toBe('\\frac{1}{x + 1}')
    expect(tex(E('sin(x)^2'))).toBe('\\sin^{2}\\,x')
    expect(tex(E('sqrt(1+x^2)'))).toBe('\\sqrt{x^{2} + 1}')
    expect(tex(E('-3x/2'))).toBe('-\\frac{3 x}{2}')
  })
})

describe('leitura de fórmulas', () => {
  const casos: [string, string][] = [
    ['2x', '2*x'], ['xy', 'x*y'], ['2xy^2', '2*x*(y^2)'], ['sen x', 'sin(x)'], ['sen 2x', 'sin(2*x)'], ['sen x cos y', 'sin(x)*cos(y)'],
    ['tg x', 'tan(x)'], ['cossec x', 'csc(x)'], ['arctg x', 'atan(x)'], ['senh x', 'sinh(x)'], ['sin^2 x', '(sin(x))^2'], ['sin^{-1}(x)', 'asin(x)'],
    ['-x^2', '-(x^2)'], ['x^-1', '1/x'], ['2^3x', '8*x'], ['e^-x', 'exp(-x)'], ['e^{-x^2}', 'exp(-(x^2))'], ['\\frac{x}{2}', 'x/2'], ['\\sqrt{x}', 'sqrt(x)'], ['\\sqrt[3]{x}', 'x^(1/3)'],
    ['\\left(x+1\\right)^{2}', '(x+1)^2'], ['\\sin\\left(x\\right)', 'sin(x)'], ['\\cos^{2}\\theta', '(cos(theta))^2'], ['\\pi r^2', 'pi*r^2'], ['θ', 'theta'], ['2π', '2*pi'],
    ['x\\cdot y', 'x*y'], ['x²', 'x^2'], ['√x', 'sqrt(x)'], ['|x|', 'abs(x)'], ['\\left|x\\right|', 'abs(x)'], ['|x||y|', 'abs(x)*abs(y)'], ['log_2 x', 'ln(x)/ln(2)'], ['ln x', 'ln(x)'], ['x y z', 'x*y*z'],
    ['\\frac{\\partial}{\\partial x}\\left(x^2y\\right)', '2*x*y'], ['\\frac{\\partial^2}{\\partial x\\partial y}\\left(x^2y\\right)', '2*x'], ['∂(x^2 y)/∂y', 'x^2'], ['\\frac{d}{dt}\\sin t', 'cos(t)'],
    ['1{,}5x', '3*x/2'], ['\\operatorname{sen}x', 'sin(x)'], ['\\mathrm{e}^x', 'exp(x)'], ['\\exponentialE^x', 'exp(x)'],
  ]
  it.each(casos)('%s', (a, b) => iguala(a, b))

  it('vetores e operações', () => {
    expect((V('(1,2,3)·(0,1,0)') as Expr).k).toBe('num')
    expect((V('(1,0,0)×(0,1,0)') as Expr[]).map(chave)).toEqual(['0', '0', '1'])
    expect((V('2(1,2)') as Expr[]).map(chave)).toEqual(['2', '4'])
    expect((V('grad(x^2+y^2)') as Expr[]).map(tex)).toEqual(['2 x', '2 y'])
    expect(tex(V('div((x,y,z))') as Expr)).toBe('3')
    expect((V('rot((-y,x,0))') as Expr[]).map(tex)).toEqual(['0', '0', '2'])
    expect((V('∇(x y)') as Expr[]).map(tex)).toEqual(['y', 'x'])
    expect(tex(V('∇·(x,y,z)') as Expr)).toBe('3')
    expect(tex(V('∇^2 (x^2+y^2+z^2)') as Expr)).toBe('6')
  })

  it.each(['(', 'x+', '2 ^', '\\frac{1}', 'sen', '|x', '∫x', '\\foo x'])('recusa com mensagem: %s', (s) => {
    expect(() => E(s)).toThrow()
  })
})

describe('derivadas conferem com diferenças finitas', () => {
  const fs = [
    'x^3 y', 'sin(x y)', 'e^(x^2+y)', 'ln(1+x^2+y^2)', 'atan(y/x)', 'sqrt(x^2+y^2+1)', 'x^y', 'cos(x)^3 sin(y)', 'tan(x)+sec(y)', 'sinh(x)cosh(y)', 'asin(x/3)', 'acos(y/3)', 'tanh(x y)', 'cot(x+1)', 'csc(y+1)', 'atan2(y,x)', '|x-3|', 'max(x,y)', 'min(x^2,y)',
  ]
  it.each(fs)('%s', (s) => {
    const f = E(s)
    for (const [x, y] of [[1.2, 0.7], [0.6, 1.9], [2.1, 1.3]]) {
      for (const v of ['x', 'y']) {
        const d = deriva(f, v)
        const h = 1e-6
        const m = { x, y }
        const num = (avalia(f, { ...m, [v]: m[v as 'x'] + h }) - avalia(f, { ...m, [v]: m[v as 'x'] - h })) / (2 * h)
        expect(avalia(d, m)).toBeCloseTo(num, 5)
      }
    }
  })
})

describe('primitivas', () => {
  const casos = [
    'x^2', 'x^5-3x+1', '1/x', '1/(2x+1)', 'sqrt(x)', 'sqrt(3x+1)', '(2x+1)^4', 'e^x', 'e^(-3x)', '2^x', 'sin x', 'cos(2x+1)', 'tan x', 'sec x', 'csc x', 'cot x', 'sec(x)^2', 'csc(x)^2', 'tan(x)^2',
    'sinh x', 'cosh(2x)', 'tanh x', 'ln x', 'atan x', 'asin(x/4)', 'acos(x/4)',
    'sin(x)^2', 'cos(x)^2', 'sin(x)^3', 'cos(x)^5', 'sin(x)^2 cos(x)^2', 'sin(x)^3 cos(x)^2', 'sin(2x) cos(3x)', 'sin(x) sin(3x)', 'cos(x) cos(2x)', 'sin(x)^4',
    'x e^x', 'x^2 e^(2x)', 'x sin x', 'x^2 cos(3x)', 'x ln x', 'x^2 ln x', 'x atan x', 'e^x sin x', 'e^(2x) cos(3x)', 'x cosh x',
    'x e^(x^2)', 'x sqrt(1+x^2)', 'x/(1+x^2)', 'x^3 sqrt(1+x^2)', 'sin(x) cos(x)', 'sin(x)^2 cos(x)', 'cos(x) e^(sin x)', 'ln(x)/x', '2x cos(x^2)', 'x/sqrt(4-x^2)', 'x (4-x^2)^(3/2)',
    '1/(1+x^2)', '1/(4+x^2)', '1/(x^2-1)', '1/(x^2+2x+5)', '1/sqrt(4-x^2)', '1/sqrt(1+x^2)', 'sqrt(4-x^2)', 'sqrt(1+x^2)', '(1+x^2)^(-3/2)',
    '(x+1)(x-2)', '(x+1)^2 x', 'x^2 y + y^3', 'x sin(y)', 'y e^(x y)', 'sin(a x)', 'e^(a x)', 'x/(a^2+x^2)', 'x sqrt(a^2-x^2)',
  ]
  it.each(casos)('∫ %s dx', (s) => {
    const f = E(s)
    const p = primitiva(f, 'x')
    expect(p, 'sem primitiva').not.toBeNull()
    const env = { y: 0.8, a: 1.3 }
    for (const [lo, hi] of [[0.3, 0.9], [0.5, 0.75]]) {
      const F = p!.F
      const exato = avalia(subst(F, { x: S('b') }), { ...env, b: hi }) - avalia(subst(F, { x: S('b') }), { ...env, b: lo })
      const n = integraNumerico(f, [{ v: 'x', lo: E(String(lo)), hi: E(String(hi)) }], env)
      expect(exato).toBeCloseTo(n.valor, 7)
    }
  })

  it('quando não sabe, diz que não sabe', () => {
    expect(primitiva(E('e^(x^2)'), 'x')).toBeNull()
    expect(primitiva(E('sin(x)/x'), 'x')).toBeNull()
  })
})

describe('quadratura', () => {
  it.each<[string, [string, string, string][], number]>([
    ['1', [['x', '-1', '1'], ['y', '-sqrt(1-x^2)', 'sqrt(1-x^2)']], Math.PI],
    ['x^2+y^2', [['x', '0', '1'], ['y', '0', '1']], 2 / 3],
    ['1', [['x', '-1', '1'], ['y', '-sqrt(1-x^2)', 'sqrt(1-x^2)'], ['z', '-sqrt(1-x^2-y^2)', 'sqrt(1-x^2-y^2)']], (4 * Math.PI) / 3],
    ['r', [['theta', '0', '2pi'], ['r', '0', '2']], 4 * Math.PI],
    ['rho^2 sin(phi)', [['theta', '0', '2pi'], ['phi', '0', 'pi'], ['rho', '0', '1']], (4 * Math.PI) / 3],
    ['ln(x)', [['x', '0', '1']], -1],
    ['1/sqrt(x)', [['x', '0', '1']], 2],
  ])('%s', (f, lim, esperado) => {
    const r = integraNumerico(E(f), lim.map(([v, lo, hi]) => ({ v, lo: E(lo), hi: E(hi) })))
    expect(Math.abs(r.valor - esperado)).toBeLessThan(2e-7)
    expect(r.erro).toBeLessThan(1e-3)
  })

  it('reconhece formas fechadas e não inventa', () => {
    expect(reconhece((8 * Math.PI) / 3, 1e-13)).toMatchObject({ num: 8, den: 3, base: '\\pi' })
    expect(reconhece(Math.SQRT2 / 2, 1e-13)).toMatchObject({ num: 1, den: 2, base: '\\sqrt{2}' })
    expect(reconhece(0.123456, 1e-3)).toBeNull()
  })
})

describe('avaliador em lote', () => {
  const fs = ['sin(x y)+z^2', 'sqrt(x^2+y^2+z^2)', '1/(x+2)', 'x^3-2x y+z', 'atan2(y,x)', 'max(x,y)+|z|', 'e^(-x^2-y^2)', 'ln(x+3) cosh(y)', 'a x + 2a']
  it.each(fs)('%s coincide com a avaliação ponto a ponto', (s) => {
    const f = E(s)
    const p = compila([f], ['x', 'y', 'z'])
    const n = 64
    const [x, y, z] = [0, 1, 2].map((k) => Float64Array.from({ length: n }, (_, i) => Math.sin(i * 1.3 + k) * 2))
    const r = executa(p, [x, y, z], n).saidas[0]
    for (let i = 0; i < n; i++) {
      const v = avalia(f, { x: x[i], y: y[i], z: z[i], a: NaN })
      if (Number.isNaN(v)) expect(Number.isNaN(r[i])).toBe(true)
      else expect(r[i]).toBeCloseTo(v, 10)
    }
  })

  it('parâmetro entra como número e subexpressão repetida é única', () => {
    const f = E('a x + a')
    const r = executa(compila([f], ['x', 'a']), [new Float64Array([1, 2]), 3], 2).saidas[0]
    expect([...r]).toEqual([6, 9])
    expect(funcao([E('x+1')], ['x'])([2])).toEqual([3])
    const repetido = compila([E('sin(x)^2+sin(x)')], ['x'])
    expect(repetido.instr.filter((i) => i.op === 'fn')).toHaveLength(1)
  })

  it('malha de 40 mil pontos custa poucos milissegundos', () => {
    const p = compila([E('sin(x)cos(y)+x^2/5-y^2/7')], ['x', 'y'])
    const n = 8192
    const x = Float64Array.from({ length: n }, (_, i) => i / n)
    const t0 = performance.now()
    for (let i = 0; i < 5; i++) executa(p, [x, x], n)
    expect(performance.now() - t0).toBeLessThan(400)
  })
})

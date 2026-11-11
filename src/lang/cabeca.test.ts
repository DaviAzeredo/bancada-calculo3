import { describe, expect, it } from 'vitest'
import { EXEMPLOS } from '../exemplos'
import { GUIA } from '../guia'
import { cabecaSolta, cabecaTex, comCabeca, contextoDe, separaCabeca, variaveisDe } from './cabeca'

const vazio = contextoDe([])

describe('cabeçalho de função', () => {
  it.each([
    ['f(x,y)=x^2', 'f', ['x', 'y'], 'x^2'],
    ['f\\left(x,y\\right)=\\sin x', 'f', ['x', 'y'], '\\sin x'],
    ['g(x,y,z)=x+y+z', 'g', ['x', 'y', 'z'], 'x+y+z'],
    ['r(t)=(\\cos t,\\sin t,t)', 'r', ['t'], '(\\cos t,\\sin t,t)'],
    ['S(u,v)=(u,v,0), 0\\le u\\le1', 'S', ['u', 'v'], '(u,v,0), 0\\le u\\le1'],
    ['f(r,\\theta)=r', 'f', ['r', 'theta'], 'r'],
    ['f_1(x,y)=x', 'f_1', ['x', 'y'], 'x'],
  ])('separa %s', (fonte, nome, params, corpo) => {
    expect(separaCabeca(fonte)).toEqual({ nome, params, corpo })
  })

  it.each(['z=x^2', 'a=1', 'f(1,2)=3', 'f(x,x)=x', 'f(x+1)=2', 'f()=1', 'x(x,y)=x', 'e(x,y)=1', '\\operatorname{grad}\\left(f\\right)', 'f(x,y)==x', 'f(a,b)=a'])(
    'não trava %s',
    (fonte) => expect(separaCabeca(fonte)).toBeNull(),
  )

  it('lê o cabeçalho escrito à mão, para refazê-lo', () => {
    expect(cabecaSolta('g(x,x)=x^2')).toEqual({ nome: 'g', params: ['x', 'x'], corpo: 'x^2' })
    expect(cabecaSolta('h(a,b)=a+b')?.params).toEqual(['a', 'b'])
    expect(cabecaSolta('f(570,y)=x^2')).toEqual({ nome: 'f', params: ['570', 'y'], corpo: 'x^2' })
    expect(cabecaSolta('f\\left(-2,y\\right)=x')?.params).toEqual(['2', 'y'])
    expect(cabecaSolta('f(x+1,y)=x')).toBeNull()
    expect(separaCabeca('f(570,y)=x^2')).toBeNull()
    expect(contextoDe(['f(x,y)=x', 'f(1,y)=z']).definicoes.get('f')).toBe(2)
    expect(variaveisDe('x^2', 'g', [], vazio)).toEqual(['x', 'y'])
    expect(variaveisDe('a+b', 'h', [], vazio)).toEqual([])
  })

  it('remonta o cabeçalho com as letras gregas do editor', () => {
    expect(cabecaTex('f', ['r', 'theta'])).toBe('f(r,\\theta)=')
    expect(separaCabeca(comCabeca('h', ['rho', 'theta', 'phi'], '\\rho'))).toEqual({ nome: 'h', params: ['rho', 'theta', 'phi'], corpo: '\\rho' })
  })

  it.each<[string, string[], string[]?]>([
    ['x^2+y^2', ['x', 'y']],
    ['x', ['x', 'y']],
    ['y', ['x', 'y']],
    ['x+z', ['x', 'y', 'z']],
    ['xyz', ['x', 'y', 'z']],
    ['(-y,x)', ['x', 'y']],
    ['(y,-x,0)', ['x', 'y', 'z']],
    ['(1,0,0)', ['x', 'y', 'z']],
    ['(\\cos t,\\sin t,t)', ['t']],
    ['(u,v,u^2)', ['u', 'v']],
    ['r^2\\cos\\theta', ['r', 'theta']],
    ['3', ['x', 'y'], ['x', 'y']],
    ['3', ['t'], ['t']],
    ['x+', ['x', 'y', 'z'], ['x', 'y', 'z']],
  ])('variáveis de %s', (corpo, esperadas, antes = ['x', 'y']) => {
    expect(variaveisDe(corpo, 'f', antes, vazio)).toEqual(esperadas)
  })

  it('um controle não vira variável', () => {
    const ctx = contextoDe(['t=0.8', 'a=1', 'raio=2'])
    expect(variaveisDe('\\sin(x-t)', 'f', ['x', 'y'], ctx)).toEqual(['x', 'y'])
    expect(variaveisDe('a+t', 'f', ['x', 'y'], ctx)).toEqual(['x', 'y'])
    expect(variaveisDe('raio\\cdot x', 'f', ['x', 'y'], ctx)).toEqual(['x', 'y'])
  })

  it('reconhece de volta as variáveis de todos os exemplos e do guia', () => {
    const conjuntos = [...EXEMPLOS.flatMap((t) => t.itens.map((e) => e.linhas.map((l) => (typeof l === 'string' ? l : l[0])))), ...GUIA.flatMap((t) => t.itens.map((i) => [i.fonte]))]
    let vistos = 0
    for (const fontes of conjuntos) {
      const ctx = contextoDe(fontes)
      for (const f of fontes) {
        const c = separaCabeca(f)
        if (!c) continue
        vistos++
        expect(variaveisDe(c.corpo, c.nome, [], ctx), f).toEqual(c.params)
      }
    }
    expect(vistos).toBeGreaterThan(30)
  })
})

import { describe, expect, it } from 'vitest'
import { GUIA, buscaExemplos, buscaGuia } from './guia'
import { resolve } from './lang/resolve'

const CONTEXTO = [
  'f(x,y)=x^2+y^2',
  'g(x,y)=x^2+y^2-1',
  'F(x,y,z)=(y,-x,z)',
  'C(t)=(cos t, sin t, 0), 0<=t<=2pi',
  'R: 0<=x<=1, 0<=y<=x',
  'E: 0<=x<=1, 0<=y<=1, 0<=z<=1',
  'S(u,v)=(u,v,u v), 0<=u<=1, 0<=v<=1',
  'A(t)=(t,0,0), 0<=t<=1',
  'B(t)=(1-t,t,0), 0<=t<=1',
  'a=1',
  'b=1',
  'c=0.5',
  'n=4',
  'q=1',
]
const itens = GUIA.flatMap((t) => t.itens)
const nomeDe = (s: string) => /^\s*([A-Za-z]\w*)\s*[(=:]/.exec(s)?.[1]

describe('guia', () => {
  it.each(itens.map((i) => [i.desc, i] as const))('"%s" entra na lista sem erro', (_d, i) => {
    // o item que define um nome substitui a definição do contexto com o mesmo nome
    const nome = nomeDe(i.fonte)
    let ctx = CONTEXTO.filter((l) => !nome || nomeDe(l) !== nome)
    // a curva r só entra para os comandos de curva: com ela, z = r^2 deixaria de ser cilíndrica
    if (/left\(r[,\\]/.test(i.fonte)) ctx = [...ctx, 'r(t)=(cos t, sin t, t), 0<=t<=4pi']
    // Green pede campo plano
    if (i.fonte.includes('green')) ctx = ctx.map((l) => (nomeDe(l) === 'F' ? 'F(x,y)=(-y,x)' : l))
    const r = resolve([...ctx, i.fonte].map((fonte, k) => ({ id: `l${k}`, fonte })))
    const a = r.analises[r.analises.length - 1]
    expect(a.erro).toBeUndefined()
    expect(a.faltando).toEqual([])
    expect(a.tipo).not.toBe('vazio')
  })

  it.each(['grad', 'div', 'rot', 'lap', 'tangente', 'direcional', 'criticos', 'lagrange', 'taylor', 'hessiana', 'potencial', 'comprimento', 'curvatura', 'torcao', 'frenet', 'area', 'volume', 'massa', 'centroide', 'linha', 'fluxo', 'green', 'stokes', 'gauss', 'jacobiano', 'riemann', 'fatia', 'sonda', 'curvas'])('o comando %s está no guia', (c) => {
    expect(buscaGuia(c).length).toBeGreaterThan(0)
  })

  it('busca sem acento, sem caixa e no plural', () => {
    const descs = (q: string) => buscaGuia(q).flatMap((t) => t.itens.map((i) => i.desc))
    expect(descs('Divergência')).toContain('Teorema da divergência (Gauss)')
    expect(descs('ESFÉRICAS')).toContain('Sólido em esféricas')
    expect(descs('esfericas')).toEqual(descs('esférica'))
    expect(descs('raio hélice')).toEqual(['Curvatura, raio de curvatura e raio da hélice'])
    expect(descs('ponto critico')).toContain('Pontos críticos, com teste da segunda derivada')
    expect(buscaGuia('derivadas').map((t) => t.tema)).toContain('Derivadas')
  })

  it('não acha os comandos do LaTeX nem o que não existe', () => {
    expect(buscaGuia('left')).toEqual([])
    expect(buscaGuia('operatorname')).toEqual([])
    expect(buscaGuia('xyzzy')).toEqual([])
    expect(buscaExemplos('xyzzy')).toEqual([])
  })

  it('busca vazia mostra o guia inteiro e nenhum exemplo', () => {
    expect(buscaGuia('  ')).toBe(GUIA)
    expect(buscaExemplos('')).toEqual([])
  })

  it('traz também os exemplos prontos', () => {
    expect(buscaExemplos('Stokes').map((e) => e.titulo)).toContain('Teorema de Stokes')
    expect(buscaExemplos('hélice').map((e) => e.titulo)).toContain('Hélice e comprimento')
    expect(buscaExemplos('lagrange').map((e) => e.titulo)).toEqual(['Multiplicadores de Lagrange'])
  })
})

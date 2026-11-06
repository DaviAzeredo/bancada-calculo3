import { describe, expect, it } from 'vitest'
import { acoesDe } from './acoes'
import { decodifica, saneia } from './compartilha'
import { EXEMPLOS, estadoDe } from './exemplos'
import { resolve } from './lang/resolve'
import { QUALIDADE, constroi } from './malha/malhas'

const todos = EXEMPLOS.flatMap((t) => t.itens)
const abre = (fontes: string[]) => resolve(fontes.map((fonte, i) => ({ id: `l${i}`, fonte })))

describe('galeria', () => {
  it('ids únicos e todos os temas do curso', () => {
    expect(new Set(todos.map((e) => e.id)).size).toBe(todos.length)
    expect(EXEMPLOS.map((t) => t.tema)).toContain('Integrais de linha e de superfície')
    expect(todos.length).toBeGreaterThanOrEqual(36)
  })

  it.each(todos.map((e) => [e.titulo, e] as const))('%s abre, desenha e calcula', (_t, e) => {
    const st = estadoDe(e)
    const r = resolve(st.linhas.map((l, i) => ({ id: `l${i}`, fonte: l.fonte })), st.vista)
    for (const a of r.analises) {
      expect(a.erro, a.rotulo).toBeUndefined()
      expect(a.faltando, a.rotulo).toEqual([])
      expect(a.tipo).not.toBe('vazio')
      for (const d of a.desenhos) expect(constroi(d, { nums: r.numeros, vista: st.vista, q: QUALIDADE.baixa, opc: st.linhas[Number(a.id.slice(1))].opc })).toBeDefined()
      if (a.calcula) {
        const res = a.calcula(r.numeros)
        expect(res.selo, a.rotulo).not.toBe('falhou')
        expect(JSON.stringify(res.exato ?? ''), a.rotulo).not.toMatch(/indefinido|NaN/)
      }
    }
  })
})

describe('ações por objeto', () => {
  it.each<[string, string[]]>([
    ['função', ['f(x,y)=x^2+y^2']],
    ['campo escalar', ['g(x,y,z)=x y z']],
    ['campo', ['F(x,y,z)=(y,-x,z)']],
    ['curva', ['r(t)=(cos t, sin t, t)']],
    ['superfície', ['S(u,v)=(u,v,u v), 0<=u<=1, 0<=v<=1']],
    ['região', ['E: 0<=x<=1, 0<=y<=1, 0<=z<=1']],
  ])('%s: toda ação gera linhas válidas', (_n, fontes) => {
    const r = abre(fontes)
    const acoes = acoesDe(r.analises[0], r)
    expect(acoes.length).toBeGreaterThan(0)
    for (const ac of acoes) {
      const s = abre([...fontes, ...ac.linhas.map((l) => l.fonte)])
      for (const a of s.analises) {
        expect(a.erro, ac.rotulo).toBeUndefined()
        expect(a.faltando, ac.rotulo).toEqual([])
      }
    }
  })
})

describe('entrada de fora', () => {
  const vista = { x: [-1, 1], y: [-1, 1], z: [-1, 1] }

  it('saneia aceita o que é válido', () => {
    const e = saneia({ linhas: [{ fonte: 'z=x', visivel: false, cor: 3, opc: { opacidade: 0.5, grade: false } }], vista, titulo: 'ok' })
    expect(e?.linhas[0]).toEqual({ fonte: 'z=x', visivel: false, cor: 3, opc: { opacidade: 0.5, grade: false } })
  })

  it.each<[string, unknown]>([
    ['nulo', null],
    ['número', 3],
    ['sem linhas', { vista }],
    ['linhas de tipo errado', { linhas: 'x', vista }],
    ['sem vista', { linhas: [] }],
    ['vista invertida', { linhas: [], vista: { x: [1, -1], y: [-1, 1], z: [-1, 1] } }],
    ['vista infinita', { linhas: [], vista: { x: [-Infinity, 1], y: [-1, 1], z: [-1, 1] } }],
    ['vista gigante', { linhas: [], vista: { x: [-1e9, 1e9], y: [-1, 1], z: [-1, 1] } }],
  ])('recusa %s', (_n, v) => {
    expect(saneia(v)).toBeNull()
  })

  it('descarta campos ruins sem perder o resto', () => {
    const e = saneia({
      vista,
      linhas: [
        { fonte: 5 },
        { fonte: 'x'.repeat(3000) },
        { fonte: 'z=1', cor: 99, opc: { opacidade: 40, nivel: 'x', __proto__: { polu: 1 }, extra: 1 } },
      ],
    })
    expect(e?.linhas).toEqual([{ fonte: 'z=1', visivel: true, cor: 0, opc: {} }])
    expect(({} as Record<string, unknown>).polu).toBeUndefined()
  })

  it('recusa comandos que abririam URL', () => {
    const e = saneia({ vista, linhas: [{ fonte: '\\href{javascript:alert(1)}{x}' }, { fonte: '\\includegraphics{http://x}' }, { fonte: 'z=x' }] })
    expect(e?.linhas.map((l) => l.fonte)).toEqual(['z=x'])
  })

  it('limita linhas e tamanho do título', () => {
    const e = saneia({ vista, titulo: 'a'.repeat(500), linhas: Array.from({ length: 500 }, () => ({ fonte: 'z=1' })) })
    expect(e?.linhas).toHaveLength(64)
    expect(e?.titulo).toHaveLength(80)
  })

  it.each(['#c=', '#c=!!!', '#c=e30', '#c=bnVsbA', '#outra', ''])('hash %s não abre nada', (h) => {
    expect(decodifica(h)).toBeNull()
  })

  it.each([
    '\\href{javascript:alert(1)}{x}', '<img src=x onerror=alert(1)>', '__proto__=1', 'constructor(x)=1', 'x^x^x^x^x^x^x^x', '((((((((((((((((((((', '9^9^9^9^9', '1/0', '0^0', 'ln(0)', '∫_0^1 ∫_0^1 ∫_0^1 ∫_0^1 x dx dy dz dt',
    'sin('.repeat(200), 'f(x)=f(x)', 'a=b', 'b=a', 'F=(x,y)(x,y)', '|', '‖', '^', '_', '∂', '∇', 'z=', '=', ',', '{', '}', '\\frac{', '\\sqrt', 'E:', ':', 'grad', 'riemann(', 'R: 0<=x<=y, 0<=y<=x',
  ])('%s não derruba nada', (f) => {
    const r = abre(['z=x^2', f])
    expect(r.analises[0].tipo).toBe('superficie')
    for (const a of r.analises) if (a.calcula) expect(() => a.calcula!(r.numeros)).not.toThrow()
  })
})

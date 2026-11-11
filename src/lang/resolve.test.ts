import { describe, expect, it } from 'vitest'
import { type Analise, type Entrada, resolve } from './resolve'

const linhas = (...fs: string[]): Entrada[] => fs.map((fonte, i) => ({ id: `l${i}`, fonte }))
const uma = (...fs: string[]): Analise => {
  const r = resolve(linhas(...fs))
  return r.analises[r.analises.length - 1]
}
const nums = (...fs: string[]) => resolve(linhas(...fs)).numeros
const calc = (...fs: string[]) => {
  const r = resolve(linhas(...fs))
  const a = r.analises[r.analises.length - 1]
  expect(a.erro).toBeUndefined()
  expect(a.calcula, 'sem cálculo').toBeDefined()
  return a.calcula!(r.numeros)
}

describe('classificação das linhas', () => {
  it.each<[string[], string, string?]>([
    [['z=x^2+y^2'], 'superficie', 'grafico'],
    [['x=y^2'], 'superficie', 'grafico'],
    [['x^2+y^2+z^2=1'], 'superficie', 'implicita'],
    [['2x+y-z=3'], 'superficie', 'implicita'],
    [['f(x,y)=x^2-y^2'], 'funcao', 'grafico'],
    [['g(x,y,z)=x^2+y^2+z^2'], 'escalar', 'escalar'],
    [['r(t)=(cos t, sin t, t)'], 'curva', 'curva'],
    [['r(t)=(cos t, sin t)'], 'curva', 'curva'],
    [['(cos t, sin t, t/2)'], 'curva', 'curva'],
    [['L(t)=(1,2,3)+t(1,0,1)'], 'curva', 'curva'],
    [['S(u,v)=(cos u sin v, sin u sin v, cos v), 0<=u<=2pi, 0<=v<=pi'], 'superficie', 'param'],
    [['(u,v,u v)'], 'superficie', 'param'],
    [['F(x,y,z)=(y,-x,z)'], 'campo', 'campo'],
    [['F=(y,-x,z)'], 'campo', 'campo'],
    [['F(x,y)=(-y,x)'], 'campo', 'campo'],
    [['F=y i - x j + z k'], 'campo', 'campo'],
    [['P=(1,2,3)'], 'ponto', 'ponto'],
    [['(1,2,3)'], 'ponto', 'ponto'],
    [['v=(1,2,3)'], 'vetor', 'seta'],
    [['r=2'], 'superficie', 'param'],
    [['z=r^2'], 'superficie', 'param'],
    [['rho=2'], 'superficie', 'param'],
    [['ρ=1+cos φ'], 'superficie', 'param'],
    [['θ=π/4'], 'superficie', 'param'],
    [['φ=π/4'], 'superficie', 'param'],
    [['x^2+y^2=r+1'], 'superficie', 'implicita'],
    [['x^2+y^2<=4'], 'regiao', 'desigualdade'],
    [['x^2+y^2<=z<=4'], 'regiao', 'desigualdade'],
    [['E: 0<=x<=1, 0<=y<=x, 0<=z<=x+y'], 'regiao', 'solido'],
    [['R: 0<=r<=1, 0<=θ<=2π'], 'regiao', 'solido'],
    [['z=x^2\\left\\lbrace x^2+y^2\\le1\\right\\rbrace'], 'superficie', 'grafico'],
    [['x^2+y^2'], 'funcao', 'grafico'],
    [['S: z=1-x^2-y^2, 0<=r<=1, 0<=θ<=2π'], 'superficie', 'param'],
    [['C: y=x^2, 0<=x<=1'], 'curva', 'curva'],
    [['f(x,y)=x y', 'tangente(f,1,2)'], 'calculo', 'grafico'],
    [['2+2'], 'calculo'],
    [['\\frac{\\partial}{\\partial x}\\left(x^2y\\right)'], 'funcao', 'grafico'],
  ])('%s', (fs, tipo, desenho) => {
    const a = uma(...fs)
    expect(a.erro).toBeUndefined()
    expect(a.tipo).toBe(tipo)
    if (desenho) expect(a.desenhos[0]?.d).toBe(desenho)
  })

  it('definição pode vir depois do uso', () => {
    const r = resolve(linhas('z=a x^2', 'a=2'))
    expect(r.analises[0].faltando).toEqual([])
    expect(r.numeros.a).toBe(2)
  })

  it('aponta o que falta e sugere controle', () => {
    expect(uma('z=a x^2+b').faltando.sort()).toEqual(['a', 'b'])
    expect(uma('r(t)=(k cos t, sin t, 0)').faltando).toEqual(['k'])
  })

  it('números derivados', () => {
    expect(nums('a=2', 'b=a^2+1')).toEqual({ a: 2, b: 5 })
    expect(uma('a=2').numero).toEqual({ valor: 2, literal: true })
    expect(uma('a=2', 'b=2a').numero?.literal).toBe(false)
  })

  it('erros em português, sem derrubar as outras linhas', () => {
    const r = resolve(linhas('z=x^2', 'z=(', 'a=a+1', 'f(x)=x', 'f(y)=y'))
    expect(r.analises[0].tipo).toBe('superficie')
    expect(r.analises[1].erro).toBeTruthy()
    expect(r.analises[4].erro).toMatch(/já foi definido/)
  })

  it('nomes de várias letras', () => {
    const r = resolve(linhas('raio=2', 'z=raio x'))
    expect(r.numeros.raio).toBe(2)
    expect(r.analises[1].faltando).toEqual([])
  })
})

const perto = (v: number | undefined, e: number, t = 1e-6) => expect(Math.abs((v ?? NaN) - e)).toBeLessThan(t)

describe('problemas clássicos de Cálculo III', () => {
  const { PI: p, sqrt: q, E: e } = Math
  it.each<[string, string[], number, string?]>([
    ['iterada', ['\\int_{0}^{1}\\int_{0}^{x}xy\\,dy\\,dx'], 1 / 8, '\\frac{1}{8}'],
    ['ordem invertida', ['∫_0^1 ∫_y^1 x y dx dy'], 1 / 8, '\\frac{1}{8}'],
    ['polar: área do disco', ['\\int_{0}^{2\\pi}\\int_{0}^{2}r\\,dr\\,d\\theta'], 4 * p, '4 \\pi'],
    ['polar: gaussiana', ['∫_0^(2π) ∫_0^1 r e^(-r^2) dr dθ'], p * (1 - 1 / e), undefined],
    ['volume da esfera (cartesiano)', ['E: -1<=x<=1, -sqrt(1-x^2)<=y<=sqrt(1-x^2), -sqrt(1-x^2-y^2)<=z<=sqrt(1-x^2-y^2)', 'volume(E)'], (4 * p) / 3],
    ['volume da esfera (esféricas)', ['E: 0<=ρ<=1, 0<=φ<=π, 0<=θ<=2π', 'volume(E)'], (4 * p) / 3, '\\frac{4 \\pi}{3}'],
    ['sorvete', ['E: 0<=ρ<=2, 0<=φ<=π/4, 0<=θ<=2π', 'volume(E)'], ((16 * p) / 3) * (1 - q(2) / 2)],
    ['cilindro menos paraboloide', ['E: 0<=r<=2, 0<=θ<=2π, 0<=z<=4-r^2', 'volume(E)'], 8 * p, '8 \\pi'],
    ['tripla com integrando', ['E: 0<=x<=1, 0<=y<=1, 0<=z<=1', '\\iiint_E x y z dV'], 1 / 8, '\\frac{1}{8}'],
    ['dupla em região nomeada', ['R: 0<=x<=1, 0<=y<=x^2', '\\iint_R x y dA'], 1 / 12, '\\frac{1}{12}'],
    ['polar nomeada, integrando em x,y', ['R: 0<=r<=1, 0<=θ<=2π', '\\iint_R (x^2+y^2) dA'], p / 2, '\\frac{\\pi}{2}'],
    ['esféricas, integrando em x,y,z', ['E: 0<=ρ<=1, 0<=φ<=π, 0<=θ<=2π', '\\iiint_E (x^2+y^2+z^2) dV'], (4 * p) / 5, '\\frac{4 \\pi}{5}'],
    ['imprópria', ['∫_0^(inf) e^(-x) dx'], 1],
    ['gaussiana inteira', ['∫_(-inf)^(inf) e^(-x^2) dx'], q(p), '\\sqrt{\\pi}'],
    ['sem primitiva elementar', ['∫_0^1 e^(x^2) dx'], 1.4626517459],
    ['comprimento da hélice', ['r(t)=(cos t, sin t, t), 0<=t<=2π', 'comprimento(r)'], 2 * p * q(2), '2 \\pi \\sqrt{2}'],
    ['linha fechada', ['F=(-y,x)', 'C(t)=(cos t, sin t), 0<=t<=2π', '\\oint_C F\\cdot dr'], 2 * p, '2 \\pi'],
    ['linha com P dx + Q dy', ['C(t)=(cos t, sin t), 0<=t<=2π', '∮_C -y dx + x dy'], 2 * p, '2 \\pi'],
    ['conservativo', ['F=(2x,2y,2z)', 'C(t)=(t,t^2,t^3), 0<=t<=1', '∫_C F·dr'], 3, '3'],
    ['escalar de linha', ['C(t)=(cos t, sin t, t), 0<=t<=2π', '∫_C z ds'], 2 * p * p * q(2)],
    ['fluxo pela esfera', ['S(u,v)=(sin v cos u, sin v sin u, cos v), 0<=u<=2π, 0<=v<=π', 'fluxo((x,y,z), S)'], -4 * p],
    ['fluxo por gráfico', ['S: z=1-x^2-y^2, 0<=r<=1, 0<=θ<=2π', '\\iint_S (0,0,1)\\cdot dS'], p, '\\pi'],
    ['área da esfera', ['S(u,v)=(sin v cos u, sin v sin u, cos v), 0<=u<=2π, 0<=v<=π', 'area(S)'], 4 * p, '4 \\pi'],
    ['área do paraboloide', ['S: z=x^2+y^2, 0<=r<=1, 0<=θ<=2π', 'area(S)'], (p / 6) * (5 * q(5) - 1)],
    ['massa variável', ['R: 0<=x<=1, 0<=y<=1', 'massa(R, x+y)'], 1, '1'],
    ['curvatura do círculo', ['r(t)=(2cos t, 2sin t, 0)', 'curvatura(r, 1)'], 0.5],
  ])('%s', (_n, fs, v, exato) => {
    const r = calc(...fs)
    perto(r.valor, v, 2e-6)
    if (exato) {
      expect(['exato', 'identificado']).toContain(r.selo)
      expect(r.exato).toBe(exato)
    }
  })

  it('Green', () => {
    const r = calc('F=(-y,x)', 'R: 0<=x<=1, 0<=y<=2', 'green(F,R)')
    perto(r.comparacao?.valorA, 4)
    perto(r.comparacao?.valorB, 4)
    expect(r.aviso).toBeUndefined()
    const s = calc('F=(x y, x^2)', 'R: 0<=x<=1, x^2<=y<=x', 'green(F,R)')
    perto(s.comparacao?.valorA, s.comparacao?.valorB ?? 0)
  })

  it('Stokes vale em superfície curva e em paramétrica', () => {
    const r = calc('F=(-y,x,z)', 'S: z=1-x^2-y^2, 0<=r<=1, 0<=θ<=2π', 'stokes(F,S)')
    perto(r.comparacao?.valorA, 2 * p)
    perto(r.comparacao?.valorB, 2 * p)
    const s = calc('F=(z,x,y)', 'S(u,v)=(u,v,u^2+v^2), 0<=u<=1, 0<=v<=1', 'stokes(F,S)')
    perto(s.comparacao?.valorA, s.comparacao?.valorB ?? 0)
  })

  it('Gauss em cartesianas, cilíndricas e esféricas', () => {
    for (const [reg, esperado] of [
      ['E: 0<=x<=1, 0<=y<=2, 0<=z<=3', 18],
      ['E: 0<=r<=1, 0<=θ<=2π, 0<=z<=2', 6 * p],
      ['E: 0<=ρ<=1, 0<=φ<=π, 0<=θ<=2π', 4 * p],
    ] as const) {
      const r = calc('F=(x,y,z)', reg, 'gauss(F,E)')
      perto(r.comparacao?.valorB, esperado, 1e-5)
      perto(r.comparacao?.valorA, esperado, 1e-4)
      expect(r.aviso).toBeUndefined()
    }
  })

  it('derivadas e geometria', () => {
    expect(calc('f(x,y)=x^2+y^2', 'tangente(f,1,2)').exato).toBe('z = 2 x + 4 y - 5')
    expect(calc('g(x,y,z)=x^2+y^2+z^2', 'tangente(g,1,1,1)').exato).toBe('2 x + 2 y + 2 z - 6 = 0')
    expect(calc('f(x,y)=x^2+y^2', 'direcional(f,(1,1),(3,4))').valor).toBeCloseTo(14 / 5)
    expect(calc('F=(2x y, x^2, 2z)', 'potencial(F)').exato).toBe('\\varphi = x^{2} y + z^{2} + C')
    expect(calc('F=(-y,x)', 'potencial(F)').aviso).toMatch(/não é nulo/)
    expect(calc('jacobiano((r cos(s), r sin(s)), r, s)').exato).toBe('r')
    expect(calc('jacobiano((u+v, u-v), u, v)').exato).toBe('-2')
    expect(calc('∫ x^2 dx').exato).toBe('\\frac{x^{3}}{3} + C')
  })

  it('pontos críticos com classificação', () => {
    const r = calc('f(x,y)=x^3-3x+y^2', 'criticos(f)')
    const tipos = r.pontos!.map((a) => a.tipo).sort()
    expect(tipos).toEqual(['mínimo local', 'ponto de sela'])
    const s = calc('f(x,y)=x^2-y^2', 'criticos(f)')
    expect(s.pontos![0].tipo).toBe('ponto de sela')
    const t = calc('f(x,y)=-(x^2+y^2)', 'criticos(f)')
    expect(t.pontos![0].tipo).toBe('máximo local')
  })

  it('o cartão de pontos críticos mostra quais são, não só quantos', () => {
    const r = calc('f(x,y)=x^3-3x+y^2', 'criticos(f)')
    expect(r.exato).toContain('\\left(1,\\ 0\\right)')
    expect(r.exato).toContain('\\left(-1,\\ 0\\right)')
    expect(r.exato).toContain('mínimo local')
    expect(r.exato).toContain('ponto de sela')
    expect(r.exato).toContain('f = -2')
    const muitos = calc('f(x,y)=sin(2x) sin(2y)', 'criticos(f)')
    expect(muitos.pontos!.length).toBeGreaterThan(8)
    expect(muitos.exato).toContain(`e mais ${muitos.pontos!.length - 8} no passo a passo`)
  })

  it('Lagrange diz onde ficam o máximo e o mínimo', () => {
    const r = calc('f(x,y)=x+y', 'g(x,y)=x^2+y^2-1', 'lagrange(f,g)')
    expect(r.exato).toContain('\\max = \\sqrt{2}\\ \\text{em}\\ \\left(\\frac{\\sqrt{2}}{2},\\ \\frac{\\sqrt{2}}{2}\\right)')
    expect(r.exato).toContain('\\min = -\\sqrt{2}\\ \\text{em}\\ \\left(-\\frac{\\sqrt{2}}{2},\\ -\\frac{\\sqrt{2}}{2}\\right)')
  })

  it.each<[string, string, string]>([
    ['hélice do exemplo', 'r(t)=(cos t, sin t, t/4), 0<=t<=4pi', '\\text{raio da hélice } 1,\\quad \\rho = \\tfrac{1}{\\kappa} = \\frac{17}{16}'],
    ['hélice de raio 2', 'r(t)=(2cos t, 2sin t, t), 0<=t<=4pi', '\\text{raio da hélice } 2,\\quad \\rho = \\tfrac{1}{\\kappa} = \\frac{5}{2}'],
    ['circunferência', 'r(t)=(3cos t, 3sin t), 0<=t<=2pi', '\\text{circunferência de raio } 3'],
  ])('curvatura reconhece a forma: %s', (_n, curva, esperado) => {
    const r = calc(curva, 'curvatura(r)')
    expect(r.exato).toBe(esperado)
  })

  it('passo da hélice e raio de curvatura de curva qualquer', () => {
    const h = calc('r(t)=(cos t, sin t, t/4), 0<=t<=4pi', 'curvatura(r)')
    expect(h.passos.at(-1)!.tex).toContain('\\text{passo} = \\frac{2\\pi\\,|\\tau|}{\\kappa^{2}+\\tau^{2}} = \\frac{\\pi}{2}')
    const p = calc('r(t)=(t, t^2, 0), 0<=t<=1', 'curvatura(r)')
    expect(p.exato).toBeUndefined()
    expect(p.passos.at(-1)!.titulo).toBe('Raio de curvatura')
    const q = calc('r(t)=(t, t^2, 0), 0<=t<=1', 'curvatura(r, 0)')
    expect(q.valor).toBeCloseTo(2)
    expect(q.passos.at(-1)!.tex).toContain('= \\frac{1}{2}')
  })

  it.each<[string[], string[]]>([
    [['F=(-y,x)', 'sonda(F,a,b,0)'], ['a', 'b']],
    [['f(x,y)=x y', 'R: 0<=x<=1, 0<=y<=1', 'riemann(f,R,n)'], ['n']],
    [['E: 0<=x<=1, 0<=y<=1, 0<=z<=1', 'fatia(E,c)'], ['c']],
    [['r(t)=(cos t, sin t, t)', 'frenet(r,q)'], ['q']],
    [['r(t)=(cos t, sin t, t)', 'curvatura(r,s)'], ['s']],
    [['r(t)=(cos t, sin t, t)', 'torcao(r,s)'], ['s']],
  ])('comando com número sem definir pede controle: %j', (fs, falta) => {
    expect(uma(...fs).faltando.sort()).toEqual(falta)
  })

  it('Lagrange', () => {
    const r = calc('f(x,y)=x+y', 'g(x,y)=x^2+y^2-1', 'lagrange(f,g)')
    expect(r.exato).toContain('\\max')
    expect(r.exato).toContain('\\sqrt{2}')
    const s = calc('f(x,y,z)=x y z', 'g(x,y,z)=x+y+z-3', 'lagrange(f,g)')
    expect(s.pontos!.length).toBeGreaterThan(0)
  })

  it('a soma de Riemann converge', () => {
    const a = calc('R: 0<=x<=1, 0<=y<=1', 'riemann(x+y, R, 4)').valor!
    expect(a).toBeCloseTo(1, 8)
    const b = calc('R: 0<=x<=1, 0<=y<=1', 'riemann(x^2 y^2, R, 40)').valor!
    expect(b).toBeCloseTo(1 / 9, 3)
  })

  it('o controle deslizante entra como número exato', () => {
    const r = calc('a=2', '\\int_{0}^{a}x\\,dx')
    expect(r.exato).toBe('2')
  })

  it('primitiva com descontinuidade não engana a conferência', () => {
    const r = calc('∫_(-1)^1 1/x^2 dx')
    expect(r.selo === 'exato' && r.valor === -2).toBe(false)
  })
})

describe('cabeçalho com número', () => {
  it('diz o que fazer, em vez de tratar a linha como equação', () => {
    for (const f of ['f(570,y)=x^2-y^2', 'f\\left(570,y\\right)=x', 'f(1,2)=3', 'g(-1)=x']) {
      const r = resolve(linhas(f, '\\operatorname{tangente}\\left(f,1,1\\right)'))
      expect(r.analises[0].erro, f).toMatch(/vão só variáveis/)
    }
  })

  it('com f definida em outra linha, f(1, y) = z continua sendo equação', () => {
    expect(uma('f(x,y)=x^2+y^2', 'f(1,y)=z').erro).toBeUndefined()
  })
})


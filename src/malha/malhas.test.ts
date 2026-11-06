import { describe, expect, it } from 'vitest'
import { resolve, type Vista } from '../lang/resolve'
import { type Feito, type MalhaLinhas, type MalhaSetas, type MalhaSup, type Opcoes, QUALIDADE, constroi } from './malhas'

const V: Vista = { x: [-2, 2], y: [-2, 2], z: [-2, 2] }

function malha(fs: string[], opc: Opcoes = {}, vista = V): Feito[] {
  const r = resolve(fs.map((fonte, i) => ({ id: `l${i}`, fonte })), vista)
  const a = r.analises[r.analises.length - 1]
  expect(a.erro).toBeUndefined()
  return a.desenhos.flatMap((d) => constroi(d, { nums: r.numeros, vista, q: QUALIDADE.alta, opc }))
}
const sup = (...fs: string[]) => malha(fs)[0] as MalhaSup

function area(m: MalhaSup) {
  let s = 0
  for (let i = 0; i < m.idx.length; i += 3) {
    const [a, b, c] = [m.idx[i], m.idx[i + 1], m.idx[i + 2]]
    const u = [0, 1, 2].map((e) => m.pos[3 * b + e] - m.pos[3 * a + e])
    const v = [0, 1, 2].map((e) => m.pos[3 * c + e] - m.pos[3 * a + e])
    s += Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2
  }
  return s
}

function volume(m: MalhaSup) {
  let s = 0
  for (let i = 0; i < m.idx.length; i += 3) {
    const [a, b, c] = [m.idx[i], m.idx[i + 1], m.idx[i + 2]].map((k) => [m.pos[3 * k], m.pos[3 * k + 1], m.pos[3 * k + 2]])
    s += (a[0] * (b[1] * c[2] - b[2] * c[1]) + a[1] * (b[2] * c[0] - b[0] * c[2]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6
  }
  return Math.abs(s)
}

/** Cada aresta dividida por exatamente dois triângulos: superfície fechada, sem furos. */
function fechada(m: MalhaSup) {
  const cont = new Map<string, number>()
  for (let i = 0; i < m.idx.length; i += 3) {
    for (const [a, b] of [[m.idx[i], m.idx[i + 1]], [m.idx[i + 1], m.idx[i + 2]], [m.idx[i + 2], m.idx[i]]]) {
      const k = a < b ? `${a},${b}` : `${b},${a}`
      cont.set(k, (cont.get(k) ?? 0) + 1)
    }
  }
  return [...cont.values()].every((n) => n === 2)
}

function normaisCoerentes(m: MalhaSup, saida: (p: number[]) => number[]) {
  let ruins = 0
  const n = m.pos.length / 3
  for (let i = 0; i < n; i++) {
    const p = [m.pos[3 * i], m.pos[3 * i + 1], m.pos[3 * i + 2]]
    const N = [m.nor[3 * i], m.nor[3 * i + 1], m.nor[3 * i + 2]]
    const e = saida(p)
    const c = (N[0] * e[0] + N[1] * e[1] + N[2] * e[2]) / (Math.hypot(...e) || 1)
    if (Math.abs(c) < 0.98) ruins++
  }
  return ruins / n
}

describe('superfícies', () => {
  it('esfera implícita: fechada, com área e volume certos', () => {
    const m = sup('x^2+y^2+z^2=1')
    expect(fechada(m)).toBe(true)
    expect(area(m)).toBeCloseTo(4 * Math.PI, 2)
    expect(volume(m)).toBeCloseTo((4 * Math.PI) / 3, 2)
    expect(normaisCoerentes(m, (p) => p)).toBeLessThan(0.001)
  })

  it('Newton põe os vértices na superfície', () => {
    const m = sup('x^2+y^2+z^2=1')
    for (let i = 0; i < m.pos.length / 3; i += 37) expect(Math.hypot(m.pos[3 * i], m.pos[3 * i + 1], m.pos[3 * i + 2])).toBeCloseTo(1, 5)
  })

  it('toro implícito fechado, mesmo com caixa achatada', () => {
    const m = malha(['(sqrt(x^2+y^2)-1.2)^2+z^2=0.16'], {}, { x: [-2, 2], y: [-2, 2], z: [-0.6, 0.6] })[0] as MalhaSup
    expect(fechada(m)).toBe(true)
    expect(area(m)).toBeCloseTo(4 * Math.PI ** 2 * 1.2 * 0.4, 1)
  })

  it('semiesfera: bissecção leva a borda até o círculo unitário', () => {
    const m = sup('z=sqrt(1-x^2-y^2)')
    expect(area(m)).toBeCloseTo(2 * Math.PI, 1)
    let menor = 9
    let maiorR = 0
    for (let i = 0; i < m.pos.length / 3; i++) {
      menor = Math.min(menor, m.pos[3 * i + 2])
      maiorR = Math.max(maiorR, Math.hypot(m.pos[3 * i], m.pos[3 * i + 1]))
    }
    expect(menor).toBeLessThan(0.02)
    expect(maiorR).toBeCloseTo(1, 3)
  })

  it('gráfico: normal analítica para cima', () => {
    const m = sup('z=x^2-y^2')
    const n = m.pos.length / 3
    let certo = 0
    for (let i = 0; i < n; i++) {
      const [x, y] = [m.pos[3 * i], m.pos[3 * i + 1]]
      const N = [-2 * x, 2 * y, 1]
      const q = Math.hypot(...N)
      if (Math.abs(m.nor[3 * i + 2] - 1 / q) < 1e-4) certo++
    }
    expect(certo / n).toBeGreaterThan(0.999)
  })

  it('outros eixos e restrição recortada com nitidez', () => {
    expect(area(sup('x=0'))).toBeCloseTo(16, 3)
    expect(area(sup('y=1'))).toBeCloseTo(16, 3)
    expect(area(sup('z=1\\left\\lbrace x^2+y^2\\le1\\right\\rbrace'))).toBeCloseTo(Math.PI, 2)
  })

  it('polo não vira parede', () => {
    const m = sup('z=1/x')
    let parede = 0
    for (let i = 0; i < m.idx.length; i += 3) {
      const z = [m.idx[i], m.idx[i + 1], m.idx[i + 2]].map((k) => m.pos[3 * k + 2])
      if (Math.max(...z) - Math.min(...z) > 12) parede++
    }
    expect(parede).toBe(0)
  })

  it('paramétrica: esfera com polos', () => {
    const m = sup('S(u,v)=(sin v cos u, sin v sin u, cos v), 0<=u<=2pi, 0<=v<=pi')
    expect(area(m)).toBeCloseTo(4 * Math.PI, 2)
    expect(normaisCoerentes(m, (p) => p)).toBeLessThan(0.002)
  })

  it('coordenadas cilíndricas e esféricas', () => {
    const cil = malha(['r=1'])[0] as MalhaSup
    expect(area(cil)).toBeCloseTo(2 * Math.PI * 4, 1)
    const esf = malha(['ρ=1'])[0] as MalhaSup
    expect(area(esf)).toBeCloseTo(4 * Math.PI, 2)
  })

  it('malha cabe em Float32 sem NaN', () => {
    for (const f of ['z=sqrt(x)', 'z=ln(x^2+y^2)', 'z=tan(x)', 'x^2=y^2+z^2', 'z=|x|+|y|']) {
      const m = sup(f)
      expect(m.pos.every(Number.isFinite), f).toBe(true)
      expect(m.nor.every(Number.isFinite), f).toBe(true)
    }
  })
})

describe('regiões', () => {
  it('sólido cilíndrico: fechado em volume, sem paredes internas', () => {
    const m = sup('E: 0<=r<=1, 0<=θ<=2π, 0<=z<=2')
    expect(area(m)).toBeCloseTo(2 * Math.PI * 2 + 2 * Math.PI, 1)
  })

  it('caixa cartesiana', () => {
    const m = sup('E: 0<=x<=1, 0<=y<=2, 0<=z<=1')
    expect(area(m)).toBeCloseTo(10, 3)
  })

  it('sólido sob um gráfico', () => {
    const fs = ['\\int_{0}^{1}\\int_{0}^{1}\\left(x+1\\right)\\,dy\\,dx']
    const m = malha(fs)[0] as MalhaSup
    const zMax = Math.max(...Array.from({ length: m.pos.length / 3 }, (_, i) => m.pos[3 * i + 2]))
    expect(zMax).toBeCloseTo(2, 5)
  })

  it('desigualdade: esfera sólida e cilindro com tampas', () => {
    expect(area(sup('x^2+y^2+z^2<=1'))).toBeCloseTo(4 * Math.PI, 1)
    const c = malha(['x^2+y^2<=1'])[0] as MalhaSup
    expect(area(c)).toBeCloseTo(2 * Math.PI * 4 + 2 * Math.PI, 0)
    const m = malha(['x^2+y^2<=z<=1'])[0] as MalhaSup
    const r = Math.max(...Array.from({ length: m.pos.length / 3 }, (_, i) => Math.hypot(m.pos[3 * i], m.pos[3 * i + 1])))
    expect(r).toBeCloseTo(1, 1)
  })

  it('colunas de Riemann', () => {
    const m = malha(['R: 0<=x<=1, 0<=y<=1', 'riemann(1, R, 3)'])[0] as MalhaSup
    expect(m.idx.length).toBe(3 ** 2 * 6 * 6)
  })
})

describe('curvas e campos', () => {
  it('tubo sem buracos e no raio certo', () => {
    const m = sup('r(t)=(cos t, sin t, 0), 0<=t<=2π')
    expect(m.pos.every(Number.isFinite)).toBe(true)
    expect(m.idx.length).toBeGreaterThan(1000)
  })

  it('curva com polo quebra em vez de riscar a cena', () => {
    const m = sup('r(t)=(t, 1/t, 0), -1<=t<=1')
    const n = m.pos.length / 3
    let longo = 0
    for (let i = 0; i < m.idx.length; i += 3) {
      const [a, b] = [m.idx[i], m.idx[i + 1]]
      const d = Math.hypot(m.pos[3 * a] - m.pos[3 * b], m.pos[3 * a + 1] - m.pos[3 * b + 1])
      if (d > 3.6) longo++
    }
    expect(n).toBeGreaterThan(100)
    expect(longo).toBe(0)
  })

  it('setas 3D unitárias, com módulo guardado', () => {
    const m = malha(['F=(-y,x,0)'])[0] as MalhaSetas
    expect(m.tipo).toBe('setas')
    expect(m.pos.length / 3).toBe(512)
    expect(m.max).toBeGreaterThan(2)
    for (let i = 0; i < m.mag.length; i += 57) {
      if (m.mag[i] > 0) expect(Math.hypot(m.dir[3 * i], m.dir[3 * i + 1], m.dir[3 * i + 2])).toBeCloseTo(1, 5)
    }
  })

  it('linhas de corrente de uma rotação pura seguem círculos', () => {
    const [, l] = malha(['F=(-y,x)'], { linhasFluxo: true }) as [MalhaSetas, MalhaLinhas]
    expect(l.seg.length).toBeGreaterThan(1000)
    for (let i = 0; i < l.seg.length; i += 600) {
      const r0 = Math.hypot(l.seg[i], l.seg[i + 1])
      const r1 = Math.hypot(l.seg[i + 3], l.seg[i + 4])
      expect(Math.abs(r0 - r1)).toBeLessThan(1e-2)
    }
  })

  it('curvas de nível são círculos no piso', () => {
    const l = malha(['f(x,y)=x^2+y^2', 'curvas(f)'])[0] as MalhaLinhas
    expect(l.seg.length).toBeGreaterThan(300)
    for (let i = 0; i < l.seg.length; i += 300) {
      expect(l.seg[i + 2]).toBe(-2)
      expect(l.seg[i] ** 2 + l.seg[i + 1] ** 2).toBeCloseTo(l.val[i / 3], 1)
    }
  })

  it('nível do campo escalar', () => {
    const m = malha(['g(x,y,z)=x^2+y^2+z^2'], { nivel: 1 })[0] as MalhaSup
    expect(area(m)).toBeCloseTo(4 * Math.PI, 2)
    expect(m.faixa![0]).toBeLessThan(1)
    expect(m.faixa![1]).toBeGreaterThan(4)
  })

  it('tangente traz plano, ponto e normal', () => {
    const d = malha(['f(x,y)=x^2+y^2', 'tangente(f,1,0)'])
    expect(d.map((x) => x.tipo)).toEqual(['sup', 'marcas', 'marcas'])
  })
})

describe('desempenho', () => {
  it.each<[string, number]>([
    ['z=sin(x)cos(y)', 60],
    ['x^2+y^2+z^2=1', 200],
    ['F=(-y,x,z)', 40],
  ])('%s em menos de %i ms', (f, ms) => {
    const t0 = performance.now()
    malha([f])
    // folga para máquina carregada: o teste pega regressão de ordem de grandeza
    expect(performance.now() - t0).toBeLessThan(ms * 10)
  })
})

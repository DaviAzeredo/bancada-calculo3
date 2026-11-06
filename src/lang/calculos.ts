import { type Expr, INF, MEIO, MENOS1, Q, S, UM, ZERO, avalia, deNumero, div, ehZero, expande, fn, igual, livres, pot, prod, quad, soma, sub, subst } from '../math/alg'
import { cruz, deriva, det, divergente, gradiente, hessiana, norma, pontoV, rotacional } from '../math/diff'
import { primitiva } from '../math/integra'
import { type Limite, integraNumerico, reconhece } from '../math/quad'
import { tex, texSimbolo, texVetor } from '../math/tex'
import { type Regiao, TEX_DIF, jacobiano, posicao, pullback, texDiferenciais, texIterada } from './regiao'

export type Passo = { titulo: string; tex?: string; nota?: string }
export type Selo = 'exato' | 'identificado' | 'numerico' | 'simbolico' | 'falhou'

export type Resultado = {
  rotulo: string
  formula: string
  /** Forma exata, ou a que foi reconhecida a partir do decimal. */
  exato?: string
  valor?: number
  erro?: number
  selo: Selo
  aviso?: string
  passos: Passo[]
  pontos?: { p: [number, number, number]; rotulo: string; tipo?: string }[]
  /** A mesma fórmula com coeficientes decimais, quando a exata pesa com cossenos e raízes. */
  aproximado?: string
  /** Duas contas que deviam coincidir: Green, Stokes, Gauss. */
  comparacao?: { a: string; b: string; valorA: number; valorB: number }
  /** O valor exato como expressão, quando há: é o que deixa somar parcelas sem arredondar. */
  expr?: Expr
}

export type Curva = { r: Expr[]; t: Limite; nome: string }
export type Superficie = { S: Expr[]; u: Limite; v: Limite; nome: string }

export type Nums = Record<string, number>

/** Fixa os controles deslizantes em racionais exatos antes de qualquer conta simbólica. */
export function fixa(e: Expr, nums: Nums): Expr {
  const m: Record<string, Expr> = {}
  for (const s of livres(e)) if (Object.hasOwn(nums, s)) m[s] = deNumero(nums[s])
  return subst(e, m)
}
const fixaL = (l: Limite, nums: Nums): Limite => ({ v: l.v, lo: fixa(l.lo, nums), hi: fixa(l.hi, nums) })

const temIndef = (e: Expr): boolean => {
  if (e.k === 'sym') return e.s === 'indefinido' || e.s === 'inf'
  if (e.k === 'num') return false
  if (e.k === 'pow') return temIndef(e.b) || temIndef(e.e)
  return e.a.some(temIndef)
}

function amostras(lim: Limite[], n = 7): Record<string, number>[] {
  let pts: Record<string, number>[] = [{}]
  for (const { v, lo, hi } of lim) {
    const prox: Record<string, number>[] = []
    for (const p of pts) {
      const a = avalia(lo, p)
      const b = avalia(hi, p)
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue
      for (let i = 0; i < n; i++) prox.push({ ...p, [v]: a + ((b - a) * (i + 0.5)) / n })
    }
    pts = prox
    if (pts.length > 4000) pts = pts.filter((_, i) => i % 3 === 0)
  }
  return pts
}

/** |u| vira ±u quando u não troca de sinal na região: √(r²) = r só vale porque r ≥ 0. */
function semModulo(e: Expr, lim: Limite[]): Expr {
  const pts = amostras(lim)
  const anda = (x: Expr): Expr => {
    if (x.k === 'num' || x.k === 'sym') return x
    if (x.k === 'fn' && (x.f === 'abs' || x.f === 'sign')) {
      const u = anda(x.a[0])
      let pos = 0
      let negs = 0
      for (const p of pts) {
        const v = avalia(u, p)
        if (v > 1e-12) pos++
        else if (v < -1e-12) negs++
      }
      if (pos + negs > 0 && (pos === 0 || negs === 0)) {
        const s = negs ? -1 : 1
        return x.f === 'abs' ? prod(Q(s), u) : Q(s)
      }
      return fn(x.f, u)
    }
    if (x.k === 'add') return soma(...x.a.map(anda))
    if (x.k === 'mul') return prod(...x.a.map(anda))
    if (x.k === 'pow') return pot(anda(x.b), anda(x.e))
    return fn(x.f, ...x.a.map(anda))
  }
  return anda(e)
}

/** Troca limites infinitos por intervalos finitos: x = t/(1−t) e x = t/(1−t²). */
function semInfinito(f: Expr, lim: Limite[]): { f: Expr; lim: Limite[] } {
  let g = f
  const out = lim.map((l) => {
    const loInf = (l.lo.k === 'mul' && l.lo.a.some((x) => igual(x, INF))) || igual(l.lo, INF)
    const hiInf = igual(l.hi, INF)
    if (!loInf && !hiInf) return l
    const t = S(`${l.v}_t`)
    const c = sub(UM, t)
    if (hiInf && !loInf) {
      const novo = soma(l.lo, div(t, c))
      g = prod(subst(g, { [l.v]: novo }), pot(c, Q(-2)))
      return { v: `${l.v}_t`, lo: ZERO, hi: UM }
    }
    const d = sub(UM, quad(t))
    if (hiInf) {
      g = prod(subst(g, { [l.v]: div(t, d) }), soma(UM, quad(t)), pot(d, Q(-2)))
      return { v: `${l.v}_t`, lo: Q(-1), hi: UM }
    }
    const novo = sub(l.hi, div(t, c))
    g = prod(subst(g, { [l.v]: novo }), pot(c, Q(-2)))
    return { v: `${l.v}_t`, lo: ZERO, hi: UM }
  })
  return { f: g, lim: out }
}

function simbolica(f: Expr, lim: Limite[]): { valor: Expr; passos: Passo[] } | null {
  let g = f
  const passos: Passo[] = []
  for (let i = lim.length - 1; i >= 0; i--) {
    const { v, lo, hi } = lim[i]
    if (temIndef(lo) || temIndef(hi)) return null
    const p = primitiva(g, v)
    if (!p) return null
    const r = sub(subst(p.F, { [v]: hi }), subst(p.F, { [v]: lo }))
    if (temIndef(r)) return null
    const s = texSimbolo(v)
    passos.push({
      titulo: `Integrando em $${s}$`,
      tex: `\\int_{${tex(lo)}}^{${tex(hi)}} ${paren(g)}\\,d${s} = \\left[${tex(p.F)}\\right]_{${s}=${tex(lo)}}^{${s}=${tex(hi)}} = ${tex(r)}`,
      nota: p.regras.length ? `Regra usada: ${p.regras.join(', ')}.` : undefined,
    })
    g = r
  }
  return { valor: g, passos }
}

const paren = (e: Expr) => (e.k === 'add' ? `\\left(${tex(e)}\\right)` : tex(e))

/** Coeficientes em decimal: mantém x, y e z, e troca o resto pelo valor. */
function texAproximado(e: Expr): string | undefined {
  const termos = e.k === 'add' ? e.a : [e]
  const soNumeros = (x: Expr): boolean => x.k === 'num' || (x.k === 'sym' && (x.s === 'pi' || x.s === 'e')) || (x.k === 'mul' && x.a.every(soNumeros)) || (x.k === 'add' && x.a.every(soNumeros)) || (x.k === 'pow' && soNumeros(x.b) && soNumeros(x.e)) || (x.k === 'fn' && x.a.every(soNumeros))
  const irracional = (x: Expr): boolean => x.k !== 'num' && x.k !== 'sym' && (x.k === 'fn' || x.k === 'pow' ? soNumeros(x) : x.k === 'mul' || x.k === 'add' ? x.a.some(irracional) : false)
  if (!termos.some(irracional)) return undefined
  const partes = termos.map((t) => {
    const fs = t.k === 'mul' ? t.a : [t]
    const c = avalia(prod(...fs.filter(soNumeros)))
    const resto = fs.filter((f) => !soNumeros(f))
    return { c, v: resto.length ? tex(prod(...resto)) : '' }
  })
  return partes.map(({ c, v }, i) => {
    const m = Number(Math.abs(c).toPrecision(4))
    return `${i ? (c < 0 ? ' - ' : ' + ') : c < 0 ? '-' : ''}${virgula(String(m))}${v ? `\\,${v}` : ''}`
  }).join('')
}

/** Vírgula decimal em LaTeX: as chaves impedem o espaço de separador de lista. */
const virgula = (t: string) => t.replace('.', '{,}')

export const texDecimal = (v: number) => {
  if (!Number.isFinite(v)) return '\\text{indefinido}'
  if (Object.is(v, -0)) v = 0
  const a = Math.abs(v)
  if (a !== 0 && (a >= 1e6 || a < 1e-4)) {
    const [m, e] = v.toExponential(5).split('e')
    return `${virgula(m)}\\times 10^{${Number(e)}}`
  }
  return virgula(String(Number(v.toPrecision(10))))
}

/** O coração das integrais: tenta a conta exata e sempre a confere com a quadratura. */
export function integraRegiao(f: Expr, lim: Limite[], base: { rotulo: string; formula: string; passos?: Passo[] }): Resultado {
  const passos = [...(base.passos ?? [])]
  const g = semModulo(f, lim)
  const infinito = lim.some((l) => temIndef(l.lo) || temIndef(l.hi))
  const nInf = semInfinito(f, lim)
  const num = integraNumerico(nInf.f, nInf.lim)
  const s = infinito ? null : simbolica(g, lim)
  if (s) {
    const v = avalia(s.valor)
    // sem a quadratura ter convergido não há conferência: é assim que ∫₋₁¹ dx/x² deixa de dar −2
    const dif = Math.abs(v - num.valor)
    const confirma = dif <= 1e-6 * (1 + Math.abs(v)) || (num.erro <= 1e-4 * (1 + Math.abs(v)) && dif <= num.erro * 8)
    if (Number.isFinite(v) && confirma) {
      return {
        ...base,
        exato: tex(s.valor),
        expr: s.valor,
        valor: v,
        erro: 0,
        selo: 'exato',
        passos: [...passos, ...s.passos, { titulo: 'Conferência numérica', nota: `A quadratura independente dá ${texDecimalTexto(num.valor)}, com ${num.pontos.toLocaleString('pt-BR')} pontos.` }],
      }
    }
    passos.push({ titulo: 'Primitiva descartada', nota: 'A conta simbólica não bateu com a quadratura, provavelmente por uma descontinuidade. Fica o valor numérico.' })
  }
  if (!Number.isFinite(num.valor)) return { ...base, selo: 'falhou', aviso: 'A integral não convergiu nesta região.', passos }
  const achado = reconhece(num.valor, num.erro)
  const passoNum: Passo = { titulo: 'Quadratura numérica', nota: `Sem primitiva fechada por estas regras. Tanh-sinh com ${num.pontos.toLocaleString('pt-BR')} pontos; diferença entre os dois últimos níveis: ${num.erro.toExponential(1)}.` }
  if (achado) {
    const { num: n, den: d, base: b } = achado
    const sinal = n < 0 ? '-' : ''
    const m = Math.abs(n)
    const coef = m === 1 ? '' : `${m} `
    const corpo = b === '1' ? (d === 1 ? `${m}` : `\\frac{${m}}{${d}}`) : d === 1 ? `${coef}${b}` : `\\frac{${coef}${b}}{${d}}`
    return { ...base, exato: sinal + corpo, valor: num.valor, erro: num.erro, selo: 'identificado', passos: [...passos, passoNum, { titulo: 'Forma fechada', nota: 'Reconhecida a partir do decimal, não demonstrada: confira no papel.' }] }
  }
  const solto = num.erro > 1e-3 * (1 + Math.abs(num.valor))
  return { ...base, valor: num.valor, erro: num.erro, selo: 'numerico', aviso: solto ? 'A quadratura não estabilizou: a integral pode divergir.' : undefined, passos: [...passos, passoNum] }
}

const texDecimalTexto = (v: number) => Number(v.toPrecision(10)).toLocaleString('pt-BR', { maximumFractionDigits: 10 })

// — integrais —

export function integralEmRegiao(f: Expr, reg: Regiao, nums: Nums, rotulo: string, nomeDif: string): Resultado {
  const r: Regiao = { coords: reg.coords, lim: reg.lim.map((l) => fixaL(l, nums)) }
  const fn0 = fixa(f, nums)
  const J = jacobiano(r.coords)
  const puxada = prod(pullback(fn0, r), J)
  const corpo = paren(puxada)
  const form = texIterada(corpo, r.lim)
  const passos: Passo[] = []
  if (r.coords !== 'cart') {
    passos.push({ titulo: 'Mudança de coordenadas', tex: `d${nomeDif} = ${TEX_DIF[r.coords]}\\;${texDiferenciais(r.lim)}`, nota: 'O fator vem do determinante jacobiano da mudança.' })
    passos.push({ titulo: 'Integrando em coordenadas novas', tex: `${tex(puxada)}` })
  }
  return integraRegiao(puxada, r.lim, { rotulo, formula: form, passos })
}

export function integralIterada(f: Expr, lim: Limite[], nums: Nums): Resultado {
  const l = lim.map((x) => fixaL(x, nums))
  const g = fixa(f, nums)
  const rotulo = l.length === 1 ? 'Integral' : l.length === 2 ? 'Integral dupla' : 'Integral tripla'
  return integraRegiao(g, l, { rotulo, formula: texIterada(paren(g), l) })
}

export function integralDeLinha(F: Expr[], c: Curva, nums: Nums, fechada: boolean): Resultado {
  const r = c.r.map((x) => fixa(x, nums))
  const t = fixaL(c.t, nums)
  const m = pontoNaCurva(r)
  const dr = r.map((x) => deriva(x, t.v))
  const G = F.map((x) => subst(fixa(x, nums), m))
  const integrando = pontoV(G.length === 2 ? [...G, ZERO] : G, dr)
  const s = texSimbolo(t.v)
  return integraRegiao(integrando, [t], {
    rotulo: 'Integral de linha',
    formula: `${fechada ? '\\oint' : '\\int'}_{${texSimbolo(c.nome)}} \\mathbf{F}\\cdot d\\mathbf{r}`,
    passos: [
      { titulo: 'Curva e derivada', tex: `\\mathbf{r}(${s}) = ${texVetor(r)},\\quad \\mathbf{r}'(${s}) = ${texVetor(dr)}` },
      { titulo: 'Campo sobre a curva', tex: `\\mathbf{F}(\\mathbf{r}(${s})) = ${texVetor(G)}` },
      { titulo: 'Produto escalar', tex: `\\mathbf{F}\\cdot\\mathbf{r}' = ${tex(integrando)}` },
    ],
  })
}

const pontoNaCurva = (r: Expr[]): Record<string, Expr> => ({ x: r[0], y: r[1], z: r[2] ?? ZERO })

export function integralEscalarDeLinha(f: Expr, c: Curva, nums: Nums): Resultado {
  const r = c.r.map((x) => fixa(x, nums))
  const t = fixaL(c.t, nums)
  const speed = norma(r.map((x) => deriva(x, t.v)))
  const g = prod(subst(fixa(f, nums), pontoNaCurva(r)), speed)
  const s = texSimbolo(t.v)
  return integraRegiao(g, [t], {
    rotulo: 'Integral de linha escalar',
    formula: `\\int_{${texSimbolo(c.nome)}} f\\,ds`,
    passos: [{ titulo: 'Elemento de arco', tex: `ds = |\\mathbf{r}'(${s})|\\,d${s} = ${tex(speed)}\\,d${s}` }],
  })
}

export function fluxoPorSuperficie(F: Expr[], S0: Superficie, nums: Nums): Resultado {
  const Sx = S0.S.map((x) => fixa(x, nums))
  const [u, v] = [fixaL(S0.u, nums), fixaL(S0.v, nums)]
  const Su = Sx.map((x) => deriva(x, u.v))
  const Sv = Sx.map((x) => deriva(x, v.v))
  const N = cruz(Su, Sv)
  const G = F.map((x) => subst(fixa(x, nums), pontoNaCurva(Sx)))
  const integrando = pontoV(G, N)
  const [a, b] = [texSimbolo(u.v), texSimbolo(v.v)]
  return integraRegiao(integrando, [u, v], {
    rotulo: 'Fluxo',
    formula: `\\iint_{${texSimbolo(S0.nome)}} \\mathbf{F}\\cdot d\\mathbf{S}`,
    passos: [
      { titulo: 'Vetor normal', tex: `\\mathbf{N} = \\mathbf{S}_{${a}}\\times\\mathbf{S}_{${b}} = ${texVetor(N)}`, nota: `A orientação segue a ordem (${a}, ${b}): troque-a para inverter o sinal.` },
      { titulo: 'Campo sobre a superfície', tex: `\\mathbf{F}(\\mathbf{S}) = ${texVetor(G)}` },
      { titulo: 'Produto escalar', tex: `\\mathbf{F}\\cdot\\mathbf{N} = ${tex(integrando)}` },
    ],
  })
}

export function integralEscalarDeSuperficie(f: Expr, S0: Superficie, nums: Nums, rotulo = 'Integral de superfície', formula?: string): Resultado {
  const Sx = S0.S.map((x) => fixa(x, nums))
  const [u, v] = [fixaL(S0.u, nums), fixaL(S0.v, nums)]
  const N = cruz(Sx.map((x) => deriva(x, u.v)), Sx.map((x) => deriva(x, v.v)))
  const m = norma(N)
  const dS = semModulo(m, [u, v])
  const g = prod(subst(fixa(f, nums), pontoNaCurva(Sx)), dS)
  return integraRegiao(g, [u, v], {
    rotulo,
    formula: formula ?? `\\iint_{${texSimbolo(S0.nome)}} f\\,dS`,
    passos: [
      { titulo: 'Vetor normal', tex: `\\mathbf{S}_{${texSimbolo(u.v)}}\\times\\mathbf{S}_{${texSimbolo(v.v)}} = ${texVetor(N)}` },
      { titulo: 'Elemento de área', tex: `dS = ${tex(dS)}\\;d${texSimbolo(u.v)}\\,d${texSimbolo(v.v)}` },
    ],
  })
}

// — geometria de curvas —

export function comprimento(c: Curva, nums: Nums): Resultado {
  const r = c.r.map((x) => fixa(x, nums))
  const t = fixaL(c.t, nums)
  const d = r.map((x) => deriva(x, t.v))
  const sp = semModulo(norma(d), [t])
  const s = texSimbolo(t.v)
  return integraRegiao(sp, [t], {
    rotulo: 'Comprimento de arco',
    formula: `L = \\int_{${tex(t.lo)}}^{${tex(t.hi)}} |\\mathbf{r}'(${s})|\\,d${s}`,
    passos: [
      { titulo: 'Vetor velocidade', tex: `\\mathbf{r}'(${s}) = ${texVetor(d)}` },
      { titulo: 'Velocidade escalar', tex: `|\\mathbf{r}'(${s})| = ${tex(sp)}` },
    ],
  })
}

export function curvatura(c: Curva, t0: Expr | null, nums: Nums): Resultado {
  const r = c.r.map((x) => fixa(x, nums))
  const v = c.t.v
  const s = texSimbolo(v)
  const p3 = (u: Expr[]) => (u.length === 2 ? [...u, ZERO] : u)
  const d1 = p3(r.map((x) => deriva(x, v)))
  const d2 = d1.map((x) => deriva(x, v))
  const C = cruz(d1, d2)
  const k = div(norma(C), pot(norma(d1), Q(3)))
  const passos: Passo[] = [
    { titulo: 'Derivadas', tex: `\\mathbf{r}' = ${texVetor(d1)},\\quad \\mathbf{r}'' = ${texVetor(d2)}` },
    { titulo: 'Fórmula', tex: `\\kappa(${s}) = \\frac{|\\mathbf{r}'\\times\\mathbf{r}''|}{|\\mathbf{r}'|^{3}} = ${tex(k)}` },
  ]
  if (t0) {
    const a = fixa(t0, nums)
    const e = subst(k, { [v]: a })
    return { rotulo: 'Curvatura', formula: `\\kappa(${tex(a)})`, exato: tex(e), valor: avalia(e), selo: 'simbolico', passos }
  }
  return { rotulo: 'Curvatura', formula: `\\kappa(${s}) = ${tex(k)}`, selo: 'simbolico', passos }
}

export function torcao(c: Curva, t0: Expr | null, nums: Nums): Resultado {
  const r = c.r.map((x) => fixa(x, nums))
  const v = c.t.v
  const s = texSimbolo(v)
  const d1 = r.map((x) => deriva(x, v))
  const d2 = d1.map((x) => deriva(x, v))
  const d3 = d2.map((x) => deriva(x, v))
  const C = cruz(d1, d2)
  const tau = div(pontoV(C, d3), pontoV(C, C))
  const passos: Passo[] = [{ titulo: 'Fórmula', tex: `\\tau = \\frac{(\\mathbf{r}'\\times\\mathbf{r}'')\\cdot\\mathbf{r}'''}{|\\mathbf{r}'\\times\\mathbf{r}''|^{2}} = ${tex(tau)}` }]
  if (t0) {
    const e = subst(tau, { [v]: fixa(t0, nums) })
    return { rotulo: 'Torção', formula: `\\tau(${tex(fixa(t0, nums))})`, exato: tex(e), valor: avalia(e), selo: 'simbolico', passos }
  }
  return { rotulo: 'Torção', formula: `\\tau(${s}) = ${tex(tau)}`, selo: 'simbolico', passos }
}

// — campos —

export function potencial(F: Expr[], nums: Nums): Resultado {
  const G = F.map((x) => fixa(x, nums))
  const vars = ['x', 'y', 'z'].slice(0, G.length)
  const rotulo = 'Função potencial'
  const formula = `\\nabla\\varphi = ${texVetor(G)}`
  const R = G.length === 2 ? [sub(deriva(G[1], 'x'), deriva(G[0], 'y'))] : rotacional(G)
  const passos: Passo[] = [{ titulo: 'Teste do rotacional', tex: G.length === 2 ? `\\frac{\\partial Q}{\\partial x} - \\frac{\\partial P}{\\partial y} = ${tex(R[0])}` : `\\nabla\\times\\mathbf{F} = ${texVetor(R)}` }]
  if (!R.every((c) => ehZero(expande(c)))) {
    return { rotulo, formula, selo: 'simbolico', exato: '\\text{não conservativo}', passos, aviso: 'O rotacional não é nulo: nenhum potencial existe.' }
  }
  let phi: Expr = ZERO
  for (let i = 0; i < vars.length; i++) {
    const v = vars[i]
    const falta = expande(sub(G[i], deriva(phi, v)))
    const p = primitiva(falta, v)
    if (!p) return { rotulo, formula, selo: 'falhou', passos, aviso: `Não consegui integrar em ${v}.` }
    if (!ehZero(falta)) passos.push({ titulo: `Integrando em $${v}$`, tex: `\\int ${paren(falta)}\\,d${v} = ${tex(p.F)}` })
    phi = soma(phi, p.F)
  }
  return { rotulo, formula, exato: `\\varphi = ${tex(phi)} + C`, selo: 'simbolico', passos }
}

export function teoremaGreen(F: Expr[], reg: Regiao, nums: Nums): Resultado {
  const [P, Q0] = F.map((x) => fixa(x, nums))
  const r: Regiao = { coords: reg.coords, lim: reg.lim.map((l) => fixaL(l, nums)) }
  const rot = sub(deriva(Q0, 'x'), deriva(P, 'y'))
  const a = integralEmRegiao(rot, r, {}, 'Green', 'A')
  const [u, v] = r.lim
  const [X, Y] = posicao(r.coords, 2)
  const borda = bordaPlana(u, v)
  let soma0 = 0
  const passos: Passo[] = [{ titulo: 'Integrando duplo', tex: `\\frac{\\partial Q}{\\partial x}-\\frac{\\partial P}{\\partial y} = ${tex(rot)}` }]
  for (const pedaco of borda) {
    const m = pedaco.m
    const [xx, yy] = [subst(X, m), subst(Y, m)]
    const PQ = [subst(subst(P, { x: xx, y: yy }), {}), subst(Q0, { x: xx, y: yy })]
    const f = pontoV(PQ, [deriva(xx, pedaco.t.v), deriva(yy, pedaco.t.v)])
    const n = integraNumerico(f, [pedaco.t])
    soma0 += pedaco.sinal * n.valor
  }
  return comparacao('Teorema de Green', `\\oint_{\\partial R} P\\,dx + Q\\,dy = \\iint_R \\left(\\frac{\\partial Q}{\\partial x}-\\frac{\\partial P}{\\partial y}\\right) dA`, 'Pela borda', soma0, 'Pela região', a, passos)
}

function comparacao(rotulo: string, formula: string, nomeA: string, valorA: number, nomeB: string, b: Resultado, passos: Passo[]): Resultado {
  const ok = Math.abs(valorA - (b.valor ?? NaN)) < 1e-5 * (1 + Math.abs(valorA))
  return {
    rotulo,
    formula,
    exato: b.exato,
    valor: b.valor,
    erro: b.erro,
    selo: b.selo,
    aviso: ok ? undefined : 'Os dois lados não coincidem. Confira a orientação e a região.',
    passos: [...passos, ...b.passos],
    comparacao: { a: nomeA, b: nomeB, valorA, valorB: b.valor ?? NaN },
  }
}

type Pedaco = { m: Record<string, Expr>; t: Limite; sinal: number }

/** Contorno anti-horário do retângulo de parâmetros (u, v(u)): quatro lados. */
function bordaPlana(u: Limite, v: Limite): Pedaco[] {
  const s = 'q'
  const q = S(s)
  const tv = (uFix: Expr): Limite => ({ v: s, lo: subst(v.lo, { [u.v]: uFix }), hi: subst(v.hi, { [u.v]: uFix }) })
  return [
    { m: { [u.v]: q, [v.v]: subst(v.lo, { [u.v]: q }) }, t: { v: s, lo: u.lo, hi: u.hi }, sinal: 1 },
    { m: { [u.v]: u.hi, [v.v]: q }, t: tv(u.hi), sinal: 1 },
    { m: { [u.v]: q, [v.v]: subst(v.hi, { [u.v]: q }) }, t: { v: s, lo: u.lo, hi: u.hi }, sinal: -1 },
    { m: { [u.v]: u.lo, [v.v]: q }, t: tv(u.lo), sinal: -1 },
  ]
}

export function teoremaStokes(F: Expr[], S0: Superficie, nums: Nums): Resultado {
  const G = F.map((x) => fixa(x, nums))
  const R = rotacional(G.length === 2 ? [...G, ZERO] : G)
  const lado = fluxoPorSuperficie(R, S0, {})
  const Sx = S0.S.map((x) => fixa(x, nums))
  const [u, v] = [fixaL(S0.u, nums), fixaL(S0.v, nums)]
  let total = 0
  // os lados do retângulo de parâmetros: costuras internas se cancelam sozinhas
  for (const p of bordaPlana(u, v)) {
    const r = Sx.map((c) => subst(c, p.m))
    const H = (G.length === 2 ? [...G, ZERO] : G).map((c) => subst(c, pontoNaCurva(r)))
    const f = pontoV(H, r.map((c) => deriva(c, p.t.v)))
    total += p.sinal * integraNumerico(f, [p.t]).valor
  }
  return comparacao('Teorema de Stokes', `\\oint_{\\partial S} \\mathbf{F}\\cdot d\\mathbf{r} = \\iint_S (\\nabla\\times\\mathbf{F})\\cdot d\\mathbf{S}`, 'Pela borda', total, 'Pelo rotacional', lado, [{ titulo: 'Rotacional', tex: `\\nabla\\times\\mathbf{F} = ${texVetor(R)}` }])
}

export function teoremaGauss(F: Expr[], reg: Regiao, nums: Nums): Resultado {
  const G = F.map((x) => fixa(x, nums))
  const r: Regiao = { coords: reg.coords, lim: reg.lim.map((l) => fixaL(l, nums)) }
  const d = divergente(G, ['x', 'y', 'z'])
  const b = integralEmRegiao(d, r, {}, 'Gauss', 'V')
  const X = posicao(r.coords, 3)
  let total = 0
  const [u, v, w] = r.lim
  const faces: { m: Record<string, Expr>; a: Limite; b: Limite; s: number }[] = [
    { m: { [w.v]: w.hi }, a: u, b: v, s: 1 },
    { m: { [w.v]: w.lo }, a: u, b: v, s: -1 },
    { m: { [v.v]: v.lo }, a: u, b: { ...w, lo: subst(w.lo, { [v.v]: v.lo }), hi: subst(w.hi, { [v.v]: v.lo }) }, s: 1 },
    { m: { [v.v]: v.hi }, a: u, b: { ...w, lo: subst(w.lo, { [v.v]: v.hi }), hi: subst(w.hi, { [v.v]: v.hi }) }, s: -1 },
    { m: { [u.v]: u.hi }, a: { ...v, lo: subst(v.lo, { [u.v]: u.hi }), hi: subst(v.hi, { [u.v]: u.hi }) }, b: { ...w, lo: subst(w.lo, { [u.v]: u.hi }), hi: subst(w.hi, { [u.v]: u.hi }) }, s: 1 },
    { m: { [u.v]: u.lo }, a: { ...v, lo: subst(v.lo, { [u.v]: u.lo }), hi: subst(v.hi, { [u.v]: u.lo }) }, b: { ...w, lo: subst(w.lo, { [u.v]: u.lo }), hi: subst(w.hi, { [u.v]: u.lo }) }, s: -1 },
  ]
  // orientação de (u, v, w): o sinal de u×v aponta para fora em w = alto se o jacobiano for positivo
  for (const f of faces) {
    const p = X.map((c) => subst(c, f.m))
    const H = G.map((c) => subst(c, pontoNaCurva(p)))
    const N = cruz(p.map((c) => deriva(c, f.a.v)), p.map((c) => deriva(c, f.b.v)))
    const e = pontoV(H, N)
    if (ehZero(e)) continue
    total += f.s * integraNumerico(e, [f.a, f.b], {}, 1e-9, 4e5).valor
  }
  const J = det([0, 1, 2].map((i) => [u, v, w].map((l) => deriva(X[i], l.v))))
  const pts = amostras(r.lim, 3)
  const sinalJ = pts.reduce((s, p) => s + Math.sign(avalia(J, p) || 0), 0) >= 0 ? 1 : -1
  return comparacao('Teorema da divergência', `\\iint_{\\partial E} \\mathbf{F}\\cdot d\\mathbf{S} = \\iiint_E \\nabla\\cdot\\mathbf{F}\\,dV`, 'Fluxo pelas faces', total * sinalJ, 'Divergente no volume', b, [{ titulo: 'Divergente', tex: `\\nabla\\cdot\\mathbf{F} = ${tex(d)}` }])
}

// — derivadas —

export function planoTangente(f: Expr, vars: string[], ponto: Expr[], nums: Nums) {
  const g = fixa(f, nums)
  const m: Record<string, Expr> = {}
  vars.forEach((v, i) => (m[v] = fixa(ponto[i], nums)))
  const grad = gradiente(g, vars).map((c) => subst(c, m))
  const f0 = subst(g, m)
  return { grad, f0, m }
}

export function resultadoTangente(f: Expr, vars: string[], ponto: Expr[], nums: Nums, nome: string): Resultado {
  const { grad, f0, m } = planoTangente(f, vars, ponto, nums)
  const passos: Passo[] = [
    { titulo: 'Derivadas parciais', tex: gradiente(fixa(f, nums), vars).map((d, i) => `${nome}_{${vars[i]}} = ${tex(d)}`).join(',\\quad ') },
    { titulo: 'No ponto', tex: `${vars.map((v, i) => `${nome}_{${v}} = ${tex(grad[i])}`).join(',\\quad ')},\\quad ${nome} = ${tex(f0)}` },
  ]
  if (vars.length === 2) {
    const [a, b] = vars.map((v) => m[v])
    const z = soma(f0, prod(grad[0], sub(S(vars[0]), a)), prod(grad[1], sub(S(vars[1]), b)))
    const plano = expande(z)
    const ap = texAproximado(plano)
    return { rotulo: 'Plano tangente', formula: `z = ${nome}(a,b) + ${nome}_x(a,b)(x-a) + ${nome}_y(a,b)(y-b)`, exato: `z = ${tex(plano)}`, aproximado: ap && `z \\approx ${ap}`, selo: 'simbolico', passos }
  }
  const e = soma(...vars.map((v, i) => prod(grad[i], sub(S(v), m[v]))))
  return { rotulo: 'Plano tangente', formula: `\\nabla ${nome}(P)\\cdot(X-P) = 0`, exato: `${tex(expande(e))} = 0`, selo: 'simbolico', passos }
}

export function direcional(f: Expr, vars: string[], ponto: Expr[], dir: Expr[], nums: Nums, nome: string): Resultado {
  const { grad } = planoTangente(f, vars, ponto, nums)
  const d = dir.map((c) => fixa(c, nums))
  const mod = norma(d)
  const u = d.map((c) => div(c, mod))
  const e = pontoV(grad, u)
  return {
    rotulo: 'Derivada direcional',
    formula: `D_{\\mathbf{u}}${nome} = \\nabla ${nome}\\cdot\\mathbf{u}`,
    exato: tex(e),
    valor: avalia(e),
    selo: 'simbolico',
    passos: [
      { titulo: 'Gradiente no ponto', tex: `\\nabla ${nome} = ${texVetor(grad)}` },
      { titulo: 'Direção unitária', tex: `\\mathbf{u} = ${texVetor(u)}` },
      { titulo: 'Taxa máxima', tex: `|\\nabla ${nome}| = ${tex(norma(grad))}`, nota: 'É o maior valor possível, na direção do próprio gradiente.' },
    ],
  }
}

export function taylor2(f: Expr, ponto: Expr[], nums: Nums): { P: Expr; passos: Passo[] } {
  const g = fixa(f, nums)
  const [a, b] = ponto.map((c) => fixa(c, nums))
  const m = { x: a, y: b }
  const [dx, dy] = [sub(S('x'), a), sub(S('y'), b)]
  const fx = subst(deriva(g, 'x'), m)
  const fy = subst(deriva(g, 'y'), m)
  const H = hessiana(g, ['x', 'y']).map((l) => l.map((c) => subst(c, m)))
  const P = soma(subst(g, m), prod(fx, dx), prod(fy, dy), prod(MEIO, H[0][0], quad(dx)), prod(H[0][1], dx, dy), prod(MEIO, H[1][1], quad(dy)))
  return { P, passos: [
    { titulo: 'Gradiente', tex: `f_x = ${tex(fx)},\\quad f_y = ${tex(fy)}` },
    { titulo: 'Hessiana', tex: `f_{xx} = ${tex(H[0][0])},\\quad f_{xy} = ${tex(H[0][1])},\\quad f_{yy} = ${tex(H[1][1])}` },
  ] }
}

/** Newton com passo limitado, a partir de uma grade: acha os zeros do sistema na caixa. */
function zeros(F: Expr[], vars: string[], caixa: [number, number][], n: number): number[][] {
  const J = F.map((c) => vars.map((v) => deriva(c, v)))
  const achados: number[][] = []
  const dim = vars.length
  const total = n ** Math.min(dim, 3)
  for (let k = 0; k < total; k++) {
    const x = caixa.map(([a, b], i) => {
      const idx = i < 3 ? Math.floor(k / n ** i) % n : 0
      return a + ((b - a) * (idx + 0.37)) / n
    })
    let ok = false
    for (let it = 0; it < 40; it++) {
      const env: Record<string, number> = {}
      vars.forEach((v, i) => (env[v] = x[i]))
      const r = F.map((c) => avalia(c, env))
      if (r.some((v) => !Number.isFinite(v))) break
      if (Math.hypot(...r) < 1e-12) {
        ok = true
        break
      }
      const dx = resolve(J.map((l) => l.map((c) => avalia(c, env))), r.map((v) => -v))
      if (!dx) break
      const passo = Math.hypot(...dx)
      const esc = passo > 2 ? 2 / passo : 1
      dx.forEach((d, i) => (x[i] += esc * d))
    }
    if (!ok || x.some((v, i) => v < caixa[i][0] - 1e-9 || v > caixa[i][1] + 1e-9)) continue
    if (!achados.some((p) => Math.hypot(...p.map((v, i) => v - x[i])) < 1e-6)) achados.push(x)
  }
  return achados
}

function resolve(A: number[][], b: number[]): number[] | null {
  const n = b.length
  const M = A.map((l, i) => [...l, b[i]])
  for (let c = 0; c < n; c++) {
    let p = c
    for (let i = c + 1; i < n; i++) if (Math.abs(M[i][c]) > Math.abs(M[p][c])) p = i
    if (Math.abs(M[p][c]) < 1e-13) return null
    ;[M[c], M[p]] = [M[p], M[c]]
    for (let i = c + 1; i < n; i++) {
      const f = M[i][c] / M[c][c]
      for (let j = c; j <= n; j++) M[i][j] -= f * M[c][j]
    }
  }
  const x: number[] = b.map(() => 0)
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n]
    for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j]
    x[i] = s / M[i][i]
  }
  return x
}

const texNum = (v: number) => {
  const a = reconhece(v, 1e-12)
  if (a && a.den <= 24) {
    const s = a.num < 0 ? '-' : ''
    const m = Math.abs(a.num)
    if (a.base === '1') return a.den === 1 ? `${s}${m}` : `${s}\\frac{${m}}{${a.den}}`
    return a.den === 1 ? `${s}${m === 1 ? '' : m}${a.base}` : `${s}\\frac{${m === 1 ? '' : m}${a.base}}{${a.den}}`
  }
  return Math.abs(v) < 1e-11 ? '0' : virgula(String(Number(v.toPrecision(7))))
}

export function pontosCriticos(f: Expr, vars: string[], caixa: [number, number][], nums: Nums, nome: string): Resultado {
  const g = fixa(f, nums)
  const grad = gradiente(g, vars)
  const H = hessiana(g, vars)
  const pts = zeros(grad, vars, caixa, vars.length === 2 ? 14 : 7)
  const passos: Passo[] = [{ titulo: 'Gradiente nulo', tex: grad.map((d, i) => `${nome}_{${vars[i]}} = ${tex(d)} = 0`).join(',\\quad ') }]
  if (vars.length === 2) passos.push({ titulo: 'Teste da segunda derivada', tex: `D = ${nome}_{xx}${nome}_{yy} - ${nome}_{xy}^{2} = ${tex(det(H))}` })
  const pontos: Resultado['pontos'] = []
  const linhas: string[] = []
  for (const x of pts) {
    const env: Record<string, number> = {}
    vars.forEach((v, i) => (env[v] = x[i]))
    const Hn = H.map((l) => l.map((c) => avalia(c, env)))
    const val = avalia(g, env)
    const tipo = classifica(Hn)
    const coord = x.map(texNum).join(',\\ ')
    linhas.push(`\\left(${coord}\\right) \\;\\to\\; ${nome} = ${texNum(val)}\\quad\\text{${tipo}}`)
    const z = vars.length === 2 ? val : x[2]
    pontos.push({ p: [x[0], x[1], z], rotulo: tipo, tipo })
  }
  passos.push({ titulo: `${pts.length} ponto(s) na região visível`, tex: linhas.length ? `\\begin{aligned}${linhas.map((l) => `&${l}`).join('\\\\')}\\end{aligned}` : undefined, nota: 'Busca numérica por Newton a partir de uma grade: pontos fora da caixa de visualização não aparecem.' })
  return { rotulo: 'Pontos críticos', formula: `\\nabla ${nome} = \\mathbf{0}`, exato: pts.length ? `${pts.length}\\text{ ponto${pts.length > 1 ? 's' : ''}}` : `\\text{nenhum na caixa}`, selo: 'numerico', passos, pontos }
}

/** Autovalores por Jacobi: sinais decidem máximo, mínimo ou sela em qualquer dimensão. */
function classifica(H: number[][]): string {
  const n = H.length
  const A = H.map((l) => [...l])
  for (let it = 0; it < 60; it++) {
    let p = 0
    let q = 1
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (Math.abs(A[i][j]) > Math.abs(A[p][q])) [p, q] = [i, j]
    if (Math.abs(A[p][q]) < 1e-12) break
    const th = 0.5 * Math.atan2(2 * A[p][q], A[q][q] - A[p][p])
    const [c, s] = [Math.cos(th), Math.sin(th)]
    for (let k = 0; k < n; k++) {
      const [a, b] = [A[k][p], A[k][q]]
      A[k][p] = c * a - s * b
      A[k][q] = s * a + c * b
    }
    for (let k = 0; k < n; k++) {
      const [a, b] = [A[p][k], A[q][k]]
      A[p][k] = c * a - s * b
      A[q][k] = s * a + c * b
    }
  }
  const ev = A.map((l, i) => l[i])
  if (ev.some((v) => Math.abs(v) < 1e-9)) return 'degenerado'
  if (ev.every((v) => v > 0)) return 'mínimo local'
  if (ev.every((v) => v < 0)) return 'máximo local'
  return 'ponto de sela'
}

export function lagrange(f: Expr, g: Expr, vars: string[], caixa: [number, number][], nums: Nums, nomes: [string, string]): Resultado {
  const [a, b] = [fixa(f, nums), fixa(g, nums)]
  const L = 'lambda'
  const sis = [...vars.map((v) => sub(deriva(a, v), prod(S(L), deriva(b, v)))), b]
  const pts = zeros(sis, [...vars, L], [...caixa, [-20, 20]], vars.length === 2 ? 9 : 6)
  const vistos: { x: number[]; val: number }[] = []
  for (const x of pts) {
    const env: Record<string, number> = {}
    vars.forEach((v, i) => (env[v] = x[i]))
    vistos.push({ x: x.slice(0, vars.length), val: avalia(a, env) })
  }
  vistos.sort((p, q) => q.val - p.val)
  const maior = vistos[0]?.val
  const menor = vistos[vistos.length - 1]?.val
  const passos: Passo[] = [{ titulo: 'Sistema de Lagrange', tex: `\\nabla ${nomes[0]} = \\lambda\\nabla ${nomes[1]},\\quad ${tex(b)} = 0` }]
  const linhas = vistos.map((p) => `\\left(${p.x.map(texNum).join(',\\ ')}\\right)\\;\\to\\; ${nomes[0]} = ${texNum(p.val)}`)
  if (linhas.length) passos.push({ titulo: 'Soluções na caixa', tex: `\\begin{aligned}${linhas.map((l) => `&${l}`).join('\\\\')}\\end{aligned}`, nota: 'Busca numérica: entre as soluções, a maior e a menor são os extremos se a restrição for fechada e limitada.' })
  const dimensao = vars.length
  const pontos: Resultado['pontos'] = vistos.map((p) => ({
    p: dimensao === 2 ? [p.x[0], p.x[1], p.val] : [p.x[0], p.x[1], p.x[2]],
    rotulo: Math.abs(p.val - maior) < 1e-9 ? 'máximo' : Math.abs(p.val - menor) < 1e-9 ? 'mínimo' : 'candidato',
  }))
  return {
    rotulo: 'Multiplicadores de Lagrange',
    formula: `\\text{extremos de } ${nomes[0]} \\text{ com } ${nomes[1]} = 0`,
    exato: vistos.length ? `\\max = ${texNum(maior)},\\quad \\min = ${texNum(menor)}` : '\\text{sem solução na caixa}',
    selo: 'numerico',
    passos,
    pontos,
  }
}

export function resultadoJacobiano(T: Expr[], vars: string[]): Resultado {
  const m = T.map((c) => vars.map((v) => deriva(c, v)))
  const d = det(m)
  const linhas = m.map((l) => l.map(tex).join(' & ')).join(' \\\\ ')
  return {
    rotulo: 'Jacobiano',
    formula: `\\frac{\\partial(${T.map((_, i) => 'xyz'[i]).join(',')})}{\\partial(${vars.map(texSimbolo).join(',')})}`,
    exato: tex(expande(d)),
    selo: 'simbolico',
    passos: [{ titulo: 'Matriz jacobiana', tex: `\\begin{pmatrix}${linhas}\\end{pmatrix}` }],
  }
}

export function somaRiemann(f: Expr, reg: Regiao, nCel: Expr, nums: Nums): Resultado {
  const n = Math.max(1, Math.min(60, Math.round(avalia(fixa(nCel, nums), nums))))
  const r: Regiao = { coords: reg.coords, lim: reg.lim.map((l) => fixaL(l, nums)) }
  const g = prod(pullback(fixa(f, nums), r), jacobiano(r.coords))
  const [u, v] = r.lim
  let total = 0
  const du = (avalia(u.hi) - avalia(u.lo)) / n
  for (let i = 0; i < n; i++) {
    const a = avalia(u.lo) + du * (i + 0.5)
    const lo = avalia(v.lo, { [u.v]: a })
    const dv = (avalia(v.hi, { [u.v]: a }) - lo) / n
    for (let j = 0; j < n; j++) total += avalia(g, { [u.v]: a, [v.v]: lo + dv * (j + 0.5) }) * du * dv
  }
  const exata = integraNumerico(g, r.lim)
  return {
    rotulo: 'Soma de Riemann',
    formula: `\\sum_{i,j=1}^{${n}} f(x_i^{*}, y_j^{*})\\,\\Delta A`,
    exato: texDecimal(total),
    valor: total,
    selo: 'numerico',
    passos: [{ titulo: 'Integral', tex: `\\iint_R f\\,dA \\approx ${texDecimal(exata.valor)}`, nota: `Com ${n}×${n} células, a soma erra por ${Math.abs(total - exata.valor).toExponential(2)}. Aumente n para ver a soma convergir.` }],
  }
}

export function resultadoSonda(F: Expr[], p: Expr[], nums: Nums): Resultado {
  const G = (F.length === 2 ? [...F, ZERO] : F).map((c) => fixa(c, nums))
  const m = { x: fixa(p[0], nums), y: fixa(p[1], nums), z: fixa(p[2], nums) }
  const d = divergente(G, ['x', 'y', 'z'])
  const R = rotacional(G)
  const nP = (e: Expr) => texDecimal(avalia(subst(e, m), nums))
  return {
    rotulo: 'Sonda de campo',
    formula: `\\mathbf{F}(P) = \\left(${G.map(nP).join(',\\ ')}\\right)`,
    exato: `\\nabla\\cdot\\mathbf{F} = ${nP(d)},\\quad \\nabla\\times\\mathbf{F} = \\left(${R.map(nP).join(',\\ ')}\\right)`,
    selo: 'simbolico',
    passos: [{ titulo: 'Leitura', nota: 'Divergente positivo: o ponto é fonte, e o fluxo sai. Rotacional: a pá gira em torno desse eixo, com velocidade angular igual à metade do módulo.' }],
  }
}

/** Seção do sólido num valor da variável de fora: de onde vêm os limites de dentro. */
export function resultadoFatia(reg: Regiao, c: Expr, nums: Nums): Resultado {
  const [u, ...resto] = reg.lim.map((l) => fixaL(l, nums))
  const a = fixa(c, nums)
  const m = { [u.v]: a }
  const nome = texSimbolo(u.v)
  const linhas = resto.map((l) => {
    const lo = subst(l.lo, m)
    const hi = subst(l.hi, m)
    return `${tex(lo)} \\le ${texSimbolo(l.v)} \\le ${tex(hi)}`
  })
  return {
    rotulo: 'Fatia da região',
    formula: `${nome} = ${tex(a)}`,
    exato: linhas.join(',\\quad '),
    selo: 'simbolico',
    passos: [{ titulo: 'Como ler', nota: `Fixado ${u.v === 'theta' ? 'θ' : u.v === 'rho' ? 'ρ' : u.v === 'phi' ? 'φ' : u.v}, os limites de dentro são os da fatia. Mova o controle: se eles mudam de fórmula no caminho, a integral precisa ser dividida.` }],
  }
}

/** Soma de parcelas c·∫…: exata se todas forem, com o passo a passo de cada uma. */
export function combinaResultados(partes: { c: Expr; r: Resultado; formula: string }[], nums: Nums): Resultado {
  const formula = partes.map(({ c, formula: f }, i) => {
    const cn = fixa(c, nums)
    const neg0 = avalia(cn) < 0
    const mod = neg0 ? prod(MENOS1, cn) : cn
    const coef = igual(mod, UM) ? '' : `${tex(mod)}\\,`
    return `${i ? (neg0 ? ' - ' : ' + ') : neg0 ? '-' : ''}${coef}${f}`
  }).join('')
  const passos: Passo[] = partes.flatMap(({ r }, i) => [
    { titulo: `Parcela ${i + 1}: ${r.rotulo.toLowerCase()}`, tex: r.exato ? `${r.formula} = ${r.exato}` : `${r.formula} \\approx ${texDecimal(r.valor ?? NaN)}` },
    ...r.passos.map((p) => ({ ...p, titulo: `${i + 1}. ${p.titulo}` })),
  ])
  const base = { rotulo: 'Soma de integrais', formula, passos }
  if (partes.some(({ r }) => r.selo === 'falhou' || r.valor === undefined)) {
    return { ...base, selo: 'falhou', aviso: 'Uma das parcelas não pôde ser calculada.' }
  }
  const valor = partes.reduce((s, { c, r }) => s + avalia(fixa(c, nums), nums) * r.valor!, 0)
  if (partes.every(({ r }) => r.selo === 'exato' && r.expr)) {
    const e = soma(...partes.map(({ c, r }) => prod(fixa(c, nums), r.expr!)))
    return { ...base, exato: tex(e), expr: e, valor: avalia(e), erro: 0, selo: 'exato' }
  }
  const erro = partes.reduce((s, { c, r }) => s + Math.abs(avalia(fixa(c, nums), nums)) * (r.erro ?? 0), 0)
  return { ...base, valor, erro, selo: 'numerico' }
}

export function resultadoGradiente(rotulo: string, formula: string, v: Expr[] | Expr): Resultado {
  return { rotulo, formula, exato: Array.isArray(v) ? texVetor(v) : tex(v), selo: 'simbolico', passos: [] }
}


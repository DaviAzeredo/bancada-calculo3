import type { Expr } from './alg'
import { avaliaTudo, compila } from './lote'

/**
 * Quadratura tanh-sinh (exponencial dupla): os nós se acumulam nas pontas, então a raiz de
 * √(1−x²) na borda do disco, que derruba Gauss-Legendre para 3 ou 4 dígitos, não atrapalha.
 * Cada nível dobra os nós, e a diferença entre dois níveis é a estimativa de erro.
 */
type Regra = { x: Float64Array; w: Float64Array }

const REGRAS = new Map<number, Regra>()

function regra(nivel: number): Regra {
  const pronta = REGRAS.get(nivel)
  if (pronta) return pronta
  const h = 1 / 2 ** nivel
  const xs: number[] = []
  const ws: number[] = []
  for (let k = -Math.ceil(3.4 / h); k <= Math.ceil(3.4 / h); k++) {
    const t = k * h
    const u = (Math.PI / 2) * Math.sinh(t)
    const c = Math.cosh(u)
    const w = (((Math.PI / 2) * Math.cosh(t)) / (c * c)) * h
    if (w < 1e-18) continue
    xs.push(Math.tanh(u))
    ws.push(w)
  }
  const r = { x: Float64Array.from(xs), w: Float64Array.from(ws) }
  REGRAS.set(nivel, r)
  return r
}

export type Limite = { v: string; lo: Expr; hi: Expr }
export type Numerico = { valor: number; erro: number; pontos: number }

/** Nós e pesos de ∫ em `dims` variáveis, com limites que dependem das variáveis de fora. */
function tensor(limites: Limite[], nivel: number, params: Record<string, number>) {
  const R = regra(nivel)
  const nomes = Object.keys(params)
  const vals = nomes.map((k) => params[k])
  let coords: Float64Array[] = []
  let pesos = new Float64Array([1])
  let n = 1
  const fora: string[] = []
  for (const { v, lo, hi } of limites) {
    const prog = compila([lo, hi], [...fora, ...nomes])
    const [a, b] = avaliaTudo(prog, [...coords, ...vals], n)
    const m = R.x.length
    const nn = n * m
    const novas = coords.map(() => new Float64Array(nn))
    const nova = new Float64Array(nn)
    const pes = new Float64Array(nn)
    for (let i = 0; i < n; i++) {
      const meia = (b[i] - a[i]) / 2
      const meio = (b[i] + a[i]) / 2
      for (let j = 0; j < m; j++) {
        const q = i * m + j
        coords.forEach((c, d) => (novas[d][q] = c[i]))
        nova[q] = meio + meia * R.x[j]
        pes[q] = pesos[i] * meia * R.w[j]
      }
    }
    novas.push(nova)
    coords = novas
    pesos = pes
    n = nn
    fora.push(v)
  }
  return { coords, pesos, n, fora, nomes, vals }
}

const NIVEIS: Record<number, [number, number]> = { 1: [3, 8], 2: [2, 6], 3: [1, 5] }

/**
 * ∫ f sobre uma região iterada, da variável de fora para a de dentro. Para quando dois
 * níveis concordam ou quando o próximo passaria de `maxPontos`.
 */
export function integraNumerico(f: Expr, limites: Limite[], params: Record<string, number> = {}, tol = 1e-10, maxPontos = 4e6): Numerico {
  const dims = limites.length
  const [ini, fim] = NIVEIS[dims] ?? [1, 4]
  let ant = NaN
  let erro = Infinity
  let pontos = 0
  let valor = NaN
  for (let nivel = ini; nivel <= fim; nivel++) {
    const m = regra(nivel).x.length
    if (pontos && m ** dims > maxPontos) break
    const t = tensor(limites, nivel, params)
    const p = compila([f], [...t.fora, ...t.nomes])
    const [y] = avaliaTudo(p, [...t.coords, ...t.vals], t.n)
    let s = 0
    let c = 0
    for (let i = 0; i < t.n; i++) {
      const w = t.pesos[i]
      if (w === 0 || !Number.isFinite(y[i])) continue
      // soma de Kahan: com milhões de nós, o arredondamento vira parte do erro
      const dy = w * y[i] - c
      const ns = s + dy
      c = ns - s - dy
      s = ns
    }
    pontos = t.n
    valor = s
    if (!Number.isNaN(ant)) {
      erro = Math.abs(s - ant)
      if (erro <= tol * (1 + Math.abs(s))) break
    }
    ant = s
  }
  return { valor, erro, pontos }
}

/** Reconhece uma fórmula fechada a partir do decimal, quando a primitiva não saiu. */
export function reconhece(v: number, erro: number): { num: number; den: number; base: string; valor: number } | null {
  const tol = Math.max(erro * 4, 1e-11 * (1 + Math.abs(v)))
  if (tol > 1e-6 * (1 + Math.abs(v))) return null
  const bases: [string, number][] = [
    ['1', 1], ['\\pi', Math.PI], ['\\pi^{2}', Math.PI ** 2], ['\\sqrt{2}', Math.SQRT2], ['\\sqrt{3}', Math.sqrt(3)],
    ['\\sqrt{\\pi}', Math.sqrt(Math.PI)], ['e', Math.E], ['\\ln 2', Math.LN2], ['\\pi\\sqrt{2}', Math.PI * Math.SQRT2], ['\\pi\\sqrt{3}', Math.PI * Math.sqrt(3)],
  ]
  for (const [base, b] of bases) {
    const r = v / b
    for (let den = 1; den <= 720; den++) {
      const n = Math.round(r * den)
      if (n !== 0 && Math.abs(n) < 100000 && Math.abs((n / den) * b - v) < tol) return { num: n, den, base, valor: (n / den) * b }
    }
  }
  return null
}


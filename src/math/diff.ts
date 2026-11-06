import { type Expr, type Fn, INDEF, MEIO, MENOS1, UM, ZERO, dep, div, ehZero, fn, neg, pot, prod, quad, raiz, soma, sub } from './alg'

/** d/du de cada função, em função do argumento. */
const TABELA: Partial<Record<Fn, (u: Expr) => Expr>> = {
  sin: (u) => fn('cos', u),
  cos: (u) => neg(fn('sin', u)),
  tan: (u) => quad(fn('sec', u)),
  sec: (u) => prod(fn('sec', u), fn('tan', u)),
  csc: (u) => neg(prod(fn('csc', u), fn('cot', u))),
  cot: (u) => neg(quad(fn('csc', u))),
  asin: (u) => pot(sub(UM, quad(u)), prod(MENOS1, MEIO)),
  acos: (u) => neg(pot(sub(UM, quad(u)), prod(MENOS1, MEIO))),
  atan: (u) => div(UM, soma(UM, quad(u))),
  sinh: (u) => fn('cosh', u),
  cosh: (u) => fn('sinh', u),
  tanh: (u) => sub(UM, quad(fn('tanh', u))),
  asinh: (u) => div(UM, raiz(soma(quad(u), UM))),
  acosh: (u) => div(UM, raiz(sub(quad(u), UM))),
  atanh: (u) => div(UM, sub(UM, quad(u))),
  ln: (u) => pot(u, MENOS1),
  abs: (u) => fn('sign', u),
  sign: () => ZERO,
  floor: () => ZERO,
  ceil: () => ZERO,
}

export function deriva(e: Expr, v: string): Expr {
  switch (e.k) {
    case 'num': return ZERO
    case 'sym': return e.s === v ? UM : ZERO
    case 'add': return soma(...e.a.map((x) => deriva(x, v)))
    case 'mul': {
      const termos: Expr[] = []
      e.a.forEach((f, i) => {
        const d = deriva(f, v)
        if (!ehZero(d)) termos.push(prod(d, ...e.a.filter((_, j) => j !== i)))
      })
      return soma(...termos)
    }
    case 'pow': {
      const db = deriva(e.b, v)
      if (!dep(e.e, v)) return ehZero(db) ? ZERO : prod(e.e, pot(e.b, sub(e.e, UM)), db)
      const de = deriva(e.e, v)
      return prod(e, soma(prod(de, fn('ln', e.b)), prod(e.e, db, pot(e.b, MENOS1))))
    }
    case 'fn': {
      if (e.f === 'atan2') {
        const [y, x] = e.a
        return div(sub(prod(x, deriva(y, v)), prod(y, deriva(x, v))), soma(quad(x), quad(y)))
      }
      if (e.f === 'min' || e.f === 'max') {
        const [a, b] = e.a
        if (e.a.length !== 2) return INDEF
        const da = deriva(a, v)
        const db = deriva(b, v)
        const s = prod(fn('sign', sub(a, b)), sub(da, db))
        return prod(MEIO, e.f === 'max' ? soma(da, db, s) : sub(soma(da, db), s))
      }
      const u = e.a[0]
      const du = deriva(u, v)
      if (ehZero(du)) return ZERO
      const t = TABELA[e.f]
      return t ? prod(t(u), du) : INDEF
    }
  }
}

export const gradiente = (f: Expr, vars: string[]) => vars.map((v) => deriva(f, v))
export const divergente = (F: Expr[], vars: string[]) => soma(...F.map((c, i) => deriva(c, vars[i])))
export const laplaciano = (f: Expr, vars: string[]) => soma(...vars.map((v) => deriva(deriva(f, v), v)))
export const rotacional = ([P, Q, R]: Expr[], [x, y, z]: string[] = ['x', 'y', 'z']) => [
  sub(deriva(R, y), deriva(Q, z)),
  sub(deriva(P, z), deriva(R, x)),
  sub(deriva(Q, x), deriva(P, y)),
]
export const hessiana = (f: Expr, vars: string[]) => vars.map((a) => vars.map((b) => deriva(deriva(f, a), b)))

export const pontoV = (a: Expr[], b: Expr[]) => soma(...a.map((x, i) => prod(x, b[i])))
export const cruz = ([a, b, c]: Expr[], [d, e, f]: Expr[]) => [sub(prod(b, f), prod(c, e)), sub(prod(c, d), prod(a, f)), sub(prod(a, e), prod(b, d))]
export const norma = (a: Expr[]) => raiz(soma(...a.map(quad)))

/** Determinante 2×2 ou 3×3, para jacobianos e o teste da segunda derivada. */
export function det(m: Expr[][]): Expr {
  if (m.length === 2) return sub(prod(m[0][0], m[1][1]), prod(m[0][1], m[1][0]))
  const [a, b, c] = m
  return soma(
    prod(a[0], sub(prod(b[1], c[2]), prod(b[2], c[1]))),
    neg(prod(a[1], sub(prod(b[0], c[2]), prod(b[2], c[0])))),
    prod(a[2], sub(prod(b[0], c[1]), prod(b[1], c[0]))),
  )
}


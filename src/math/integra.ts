import { DOIS, type Expr, type Fn, MEIO, MENOS1, Q, S, UM, ZERO, avalia, dep, div, ehInteiro, ehNum, ehZero, expande, fn, igual, livres, neg, pot, prod, quad, raiz, separa, soma, sub, subst, troca } from './alg'
import { deriva } from './diff'

/**
 * Primitivas por regras, com as outras variáveis tratadas como constantes: é o que resolve
 * as integrais iteradas de Cálculo III. Devolve null quando nenhuma regra serve, e quem
 * chama recai na quadratura numérica; nunca devolve uma primitiva não verificada, porque
 * `primitiva` confere F' = f em pontos sorteados.
 */
export type Regra = string

type Ctx = { v: string; regras: Set<Regra>; prof: number; novo: () => string }

const X = (n: number) => Q(n)

function linear(e: Expr, v: string): { a: Expr; b: Expr } | null {
  if (!dep(e, v)) return null
  const a = deriva(e, v)
  if (dep(a, v)) return null
  return { a, b: subst(e, { [v]: ZERO }) }
}

/** Coeficientes de um polinômio em v, do grau 0 para cima; null se não for polinômio. */
export function coeficientes(e: Expr, v: string, limite = 32): Expr[] | null {
  const ex = expande(e)
  const termos = ex.k === 'add' ? ex.a : [ex]
  const cs: Expr[] = []
  const poe = (g: number, c: Expr) => {
    while (cs.length <= g) cs.push(ZERO)
    cs[g] = soma(cs[g], c)
  }
  for (const t of termos) {
    if (!dep(t, v)) {
      poe(0, t)
      continue
    }
    const fs = t.k === 'mul' ? t.a : [t]
    let g = -1
    const resto: Expr[] = []
    for (const f of fs) {
      if (f.k === 'sym' && f.s === v) g = 1
      else if (f.k === 'pow' && f.b.k === 'sym' && f.b.s === v && ehInteiro(f.e) && (f.e as { n: bigint }).n > 0n) g = Number((f.e as { n: bigint }).n)
      else if (dep(f, v)) return null
      else resto.push(f)
    }
    if (g < 0 || g > limite) return null
    poe(g, prod(...resto))
  }
  return cs
}

const TAB: Partial<Record<Fn, (u: Expr, c: Ctx) => Expr | null>> = {
  sin: (u) => neg(fn('cos', u)),
  cos: (u) => fn('sin', u),
  tan: (u) => neg(fn('ln', fn('abs', fn('cos', u)))),
  cot: (u) => fn('ln', fn('abs', fn('sin', u))),
  sec: (u) => fn('ln', fn('abs', soma(fn('sec', u), fn('tan', u)))),
  csc: (u) => neg(fn('ln', fn('abs', soma(fn('csc', u), fn('cot', u))))),
  sinh: (u) => fn('cosh', u),
  cosh: (u) => fn('sinh', u),
  tanh: (u) => fn('ln', fn('cosh', u)),
  ln: (u) => sub(prod(u, fn('ln', u)), u),
  asin: (u) => soma(prod(u, fn('asin', u)), raiz(sub(UM, quad(u)))),
  acos: (u) => sub(prod(u, fn('acos', u)), raiz(sub(UM, quad(u)))),
  atan: (u) => sub(prod(u, fn('atan', u)), prod(MEIO, fn('ln', soma(UM, quad(u))))),
}

/** ∫ de f(a·v + b), com a tabela acima. */
function deLinear(f: Fn, inner: Expr, c: Ctx): Expr | null {
  const l = linear(inner, c.v)
  const t = TAB[f]
  if (!l || !t) return null
  const r = t(inner, c)
  if (!r) return null
  c.regras.add(f === 'ln' || f === 'atan' || f === 'asin' || f === 'acos' ? 'por partes' : 'tabela')
  return div(r, l.a)
}

/** ∫ sinᵐ cosⁿ de argumento linear: potência ímpar por substituição, par por redução. */
function potenciaTrig(f: Expr, c: Ctx): Expr | null {
  const fs = f.k === 'mul' ? f.a : [f]
  let u: Expr | null = null
  let m = 0
  let n = 0
  for (const x of fs) {
    const b = x.k === 'pow' ? x.b : x
    const ex = x.k === 'pow' ? x.e : UM
    if (b.k !== 'fn' || (b.f !== 'sin' && b.f !== 'cos') || !ehInteiro(ex)) return null
    const k = Number((ex as { n: bigint }).n)
    if (k < 0 || k > 24) return null
    if (u && !igual(u, b.a[0])) return null
    u = b.a[0]
    if (b.f === 'sin') m += k
    else n += k
  }
  if (!u) return null
  const l = linear(u, c.v)
  if (!l) return null
  const w = c.novo()
  const W = S(w)
  // ∫ senᵐ cosⁿ com n ímpar: w = sen u e cos²u = 1 − w²
  if (n % 2 === 1) {
    const p = prod(pot(W, X(m)), pot(sub(UM, quad(W)), X((n - 1) / 2)))
    const F = primPolinomio(expande(p), w)
    if (!F) return null
    c.regras.add('substituição trigonométrica')
    return div(subst(F, { [w]: fn('sin', u) }), l.a)
  }
  if (m % 2 === 1) {
    const p = prod(pot(W, X(n)), pot(sub(UM, quad(W)), X((m - 1) / 2)))
    const F = primPolinomio(expande(p), w)
    if (!F) return null
    c.regras.add('substituição trigonométrica')
    return neg(div(subst(F, { [w]: fn('cos', u) }), l.a))
  }
  // pares: linearização, sen²u = (1 − cos 2u)/2 e cos²u = (1 + cos 2u)/2
  c.regras.add('redução de potência')
  const lin = prod(pot(sub(UM, W), X(m / 2)), pot(soma(UM, W), X(n / 2)), pot(MEIO, X((m + n) / 2)))
  const cs = coeficientes(lin, w)
  if (!cs) return null
  const parc = cs.map((a, k) => {
    if (ehZero(a)) return ZERO
    if (k === 0) return prod(a, c.v === '' ? ZERO : S(c.v))
    const r = potCos2(k, u!, c)
    return r ? prod(a, r) : null
  })
  if (parc.some((x) => x === null)) return null
  return soma(...(parc as Expr[]))
}

/** ∫ cosᵏ(2u) dv, recursivo pelos casos acima. */
function potCos2(k: number, u: Expr, c: Ctx): Expr | null {
  return potenciaTrig(pot(fn('cos', prod(DOIS, u)), X(k)), c)
}

function primPolinomio(e: Expr, v: string): Expr | null {
  const ts = e.k === 'add' ? e.a : [e]
  const out: Expr[] = []
  for (const t of ts) {
    const [c, r] = separa(t)
    if (!dep(r, v)) {
      out.push(prod(c, r, S(v)))
      continue
    }
    const ex = r.k === 'sym' ? UM : r.k === 'pow' && r.b.k === 'sym' ? r.e : null
    if (!ex || !ehNum(ex)) return null
    out.push(prod(c, div(pot(S(v), soma(ex, UM)), soma(ex, UM))))
  }
  return soma(...out)
}

/** Formas com quadrática: 1/(ax²+bx+c), √(a²−x²), 1/√(a²+x²)… */
function quadratica(b: Expr, e: Expr, c: Ctx): Expr | null {
  const cs = coeficientes(b, c.v, 2)
  if (!cs || cs.length !== 3) return null
  const [c0, c1, c2] = cs
  const v = S(c.v)
  if (dep(c2, c.v)) return null
  // completa o quadrado: a(x + h)² + k
  const h = div(c1, prod(DOIS, c2))
  const k = sub(c0, div(quad(c1), prod(X(4), c2)))
  const w = soma(v, h)
  const nE = ehNum(e) ? e : null
  if (!nE) return null
  const sinalNum = (x: Expr) => {
    const val = avalia(x, valoresTeste(x))
    return val > 0 ? 1 : val < 0 ? -1 : 0
  }
  const sa = sinalNum(c2)
  const sk = sinalNum(k)
  if (!sa) return null
  if (nE.n === -1n && nE.d === 1n) {
    if (ehZero(k)) {
      c.regras.add('tabela')
      return neg(div(UM, prod(c2, w)))
    }
    if (sa * sk > 0) {
      c.regras.add('arco tangente')
      const r = raiz(div(k, c2))
      return prod(div(UM, prod(c2, r)), fn('atan', div(w, r)))
    }
    c.regras.add('frações parciais')
    const r = raiz(neg(div(k, c2)))
    return prod(div(UM, prod(c2, DOIS, r)), fn('ln', fn('abs', div(sub(w, r), soma(w, r)))))
  }
  if (nE.n === -1n && nE.d === 2n) {
    if (sa < 0 && sk > 0) {
      c.regras.add('arco seno')
      const r = raiz(neg(div(k, c2)))
      return prod(pot(neg(c2), prod(MENOS1, MEIO)), fn('asin', div(w, r)))
    }
    if (sa > 0) {
      c.regras.add('substituição hiperbólica')
      return prod(pot(c2, prod(MENOS1, MEIO)), fn('ln', fn('abs', soma(w, raiz(soma(quad(w), div(k, c2)))))))
    }
    return null
  }
  if (nE.n === 1n && nE.d === 2n) {
    if (sa < 0 && sk > 0) {
      c.regras.add('substituição trigonométrica')
      const a2 = neg(div(k, c2))
      return prod(raiz(neg(c2)), MEIO, soma(prod(w, raiz(sub(a2, quad(w)))), prod(a2, fn('asin', div(w, raiz(a2))))))
    }
    if (sa > 0) {
      c.regras.add('substituição hiperbólica')
      const a2 = div(k, c2)
      const q = raiz(soma(quad(w), a2))
      return prod(raiz(c2), MEIO, soma(prod(w, q), prod(a2, fn('ln', fn('abs', soma(w, q))))))
    }
    return null
  }
  if (nE.n === -3n && nE.d === 2n) {
    const a2 = div(k, c2)
    c.regras.add('substituição trigonométrica')
    return prod(pot(c2, Q(-3, 2)), div(w, prod(a2, raiz(soma(quad(w), a2)))))
  }
  return null
}

/** Sorteia valores positivos para os parâmetros: basta para decidir o sinal de a² e afins. */
function valoresTeste(e: Expr): Record<string, number> {
  const env: Record<string, number> = {}
  let i = 0
  for (const s of livres(e)) env[s] = 1.37 + 0.41 * i++
  return env
}

function polinomio(e: Expr, v: string) {
  return coeficientes(e, v) !== null
}

/** Por partes em cadeia: p(v)·g(v), derivando p até zerar. */
function porPartes(f: Expr, c: Ctx): Expr | null {
  if (f.k !== 'mul') return null
  const v = c.v
  const polis: Expr[] = []
  const outros: Expr[] = []
  for (const x of f.a) (polinomio(x, v) ? polis : outros).push(x)
  if (outros.length !== 1 || !polis.length) return null
  const g = outros[0]
  const p = prod(...polis)
  const isExp = g.k === 'pow' && !dep(g.b, v) && linear(g.e, v)
  const isTrig = g.k === 'fn' && ['sin', 'cos', 'sinh', 'cosh'].includes(g.f) && linear(g.a[0], v)
  if (isExp || isTrig) {
    let pa: Expr = p
    let ga: Expr = g
    let s = 1
    const termos: Expr[] = []
    for (let i = 0; i < 40 && !ehZero(pa); i++) {
      const G = prim(ga, { ...c, prof: c.prof + 1 })
      if (!G) return null
      termos.push(prod(X(s), pa, G))
      pa = deriva(pa, v)
      ga = G
      s = -s
    }
    c.regras.add('por partes')
    return soma(...termos)
  }
  // ∫ p·ln(v) e ∫ p·arctg(v): integra p e deriva o resto
  if (g.k === 'fn' && ['ln', 'atan', 'asin', 'acos'].includes(g.f)) {
    const P = prim(p, { ...c, prof: c.prof + 1 })
    if (!P) return null
    const R = prim(expandeTudo(prod(P, deriva(g, v))), { ...c, prof: c.prof + 1 })
    if (!R) return null
    c.regras.add('por partes')
    return sub(prod(P, g), R)
  }
  return null
}

const expandeTudo = (e: Expr) => expande(e)

/** ∫ e^(au)·sen(bu) e ·cos(bu), a fórmula fechada que a dupla integração por partes dá. */
function expTrig(f: Expr, c: Ctx): Expr | null {
  if (f.k !== 'mul' || f.a.length !== 2) return null
  const ex = f.a.find((x) => x.k === 'pow' && x.b.k === 'sym' && x.b.s === 'e')
  const tr = f.a.find((x) => x.k === 'fn' && (x.f === 'sin' || x.f === 'cos'))
  if (!ex || !tr || ex.k !== 'pow' || tr.k !== 'fn') return null
  const le = linear(ex.e, c.v)
  const lt = linear(tr.a[0], c.v)
  if (!le || !lt) return null
  const [a, b] = [le.a, lt.a]
  const D = soma(quad(a), quad(b))
  const n = tr.f === 'sin' ? sub(prod(a, fn('sin', tr.a[0])), prod(b, fn('cos', tr.a[0]))) : soma(prod(a, fn('cos', tr.a[0])), prod(b, fn('sin', tr.a[0])))
  c.regras.add('por partes')
  return prod(ex, div(n, D))
}

function subexpressoes(e: Expr, v: string, out: Expr[] = []): Expr[] {
  if (!dep(e, v)) return out
  switch (e.k) {
    case 'add': out.push(e); e.a.forEach((x) => subexpressoes(x, v, out)); break
    case 'mul': e.a.forEach((x) => subexpressoes(x, v, out)); break
    case 'pow':
      if (e.b.k !== 'sym') out.push(e.b)
      if (dep(e.e, v)) out.push(e.e)
      subexpressoes(e.b, v, out)
      subexpressoes(e.e, v, out)
      break
    case 'fn':
      out.push(e)
      for (const a of e.a) {
        if (a.k !== 'sym') out.push(a)
        subexpressoes(a, v, out)
      }
      break
  }
  return out
}

/** Reescreve vᵏ em função de w quando u = a·vⁿ + b: é o r³√(1+r²) das integrais polares. */
function reescreveEmW(q: Expr, u: Expr, w: Expr, v: string): Expr {
  const cs = coeficientes(u, v, 6)
  if (!cs) return q
  const nz = cs.map((c, i) => (ehZero(c) ? -1 : i)).filter((i) => i > 0)
  if (nz.length !== 1) return q
  const n = nz[0]
  const a = cs[n]
  const b = cs[0]
  const vn = div(sub(w, b), a)
  const anda = (e: Expr): Expr => {
    if (e.k === 'pow' && e.b.k === 'sym' && e.b.s === v && ehInteiro(e.e)) {
      const k = Number((e.e as { n: bigint }).n)
      if (k % n === 0) return pot(vn, X(k / n))
    }
    if (e.k === 'num' || e.k === 'sym') return e
    if (e.k === 'add') return soma(...e.a.map(anda))
    if (e.k === 'mul') return prod(...e.a.map(anda))
    if (e.k === 'pow') return pot(anda(e.b), anda(e.e))
    return fn(e.f, ...e.a.map(anda))
  }
  return anda(q)
}

function substituicao(f: Expr, c: Ctx): Expr | null {
  const vistos = new Set<string>()
  const cand = subexpressoes(f, c.v).sort((a, b) => tamanho(b) - tamanho(a))
  for (const u of cand) {
    const k = JSON.stringify(u, (_, x) => (typeof x === 'bigint' ? String(x) : x))
    if (vistos.has(k)) continue
    vistos.add(k)
    const du = deriva(u, c.v)
    if (ehZero(du)) continue
    const w = c.novo()
    const W = S(w)
    let q = troca(div(f, du), u, W)
    if (dep(q, c.v)) q = reescreveEmW(q, u, W, c.v)
    if (dep(q, c.v)) continue
    const G = prim(expande(q), { ...c, v: w, prof: c.prof + 1 })
    if (!G) continue
    c.regras.add('substituição')
    return subst(G, { [w]: u })
  }
  return null
}

function tamanho(e: Expr): number {
  switch (e.k) {
    case 'num': case 'sym': return 1
    case 'add': case 'mul': case 'fn': return 1 + e.a.reduce((s, x) => s + tamanho(x), 0)
    case 'pow': return 1 + tamanho(e.b) + tamanho(e.e)
  }
}

/** Produtos de seno e cosseno com frequências diferentes viram somas. */
function produtoParaSoma(f: Expr, c: Ctx): Expr | null {
  if (f.k !== 'mul') return null
  const tr = f.a.filter((x) => x.k === 'fn' && (x.f === 'sin' || x.f === 'cos') && linear(x.a[0], c.v)) as Extract<Expr, { k: 'fn' }>[]
  if (tr.length !== 2 || f.a.length !== 2 || igual(tr[0].a[0], tr[1].a[0])) return null
  const [p, q] = tr
  const [a, b] = [p.a[0], q.a[0]]
  let s: Expr
  if (p.f === 'sin' && q.f === 'cos') s = prod(MEIO, soma(fn('sin', soma(a, b)), fn('sin', sub(a, b))))
  else if (p.f === 'cos' && q.f === 'sin') s = prod(MEIO, sub(fn('sin', soma(a, b)), fn('sin', sub(a, b))))
  else if (p.f === 'sin') s = prod(MEIO, sub(fn('cos', sub(a, b)), fn('cos', soma(a, b))))
  else s = prod(MEIO, soma(fn('cos', sub(a, b)), fn('cos', soma(a, b))))
  c.regras.add('produto em soma')
  return prim(s, { ...c, prof: c.prof + 1 })
}

function prim(f: Expr, c: Ctx): Expr | null {
  if (c.prof > 8) return null
  const v = c.v
  const Sv = S(v)
  if (!dep(f, v)) return prod(f, Sv)
  if (f.k === 'sym') {
    c.regras.add('potência')
    return prod(MEIO, quad(Sv))
  }
  if (f.k === 'add') {
    const ps = f.a.map((t) => prim(t, { ...c, prof: c.prof + 1 }))
    if (ps.every((p) => p)) {
      if (f.a.length > 1) c.regras.add('linearidade')
      return soma(...(ps as Expr[]))
    }
    return null
  }
  if (f.k === 'mul') {
    const fora = f.a.filter((x) => !dep(x, v))
    if (fora.length) {
      const dentro = f.a.filter((x) => dep(x, v))
      const p = prim(prod(...dentro), { ...c, prof: c.prof + 1 })
      return p ? prod(...fora, p) : null
    }
  }
  if (f.k === 'pow') {
    const { b, e } = f
    if (!dep(e, v)) {
      const l = linear(b, v)
      if (l) {
        if (e.k === 'num' && e.n === -1n && e.d === 1n) {
          c.regras.add('logaritmo')
          return div(fn('ln', fn('abs', b)), l.a)
        }
        c.regras.add('potência')
        return div(pot(b, soma(e, UM)), prod(l.a, soma(e, UM)))
      }
      const t = quadratica(b, e, c)
      if (t) return t
    } else if (!dep(b, v)) {
      const l = linear(e, v)
      if (l) {
        c.regras.add('exponencial')
        return b.k === 'sym' && b.s === 'e' ? div(f, l.a) : div(f, prod(l.a, fn('ln', b)))
      }
    }
    // tan², cot², sec², csc²
    if (ehNum(e) && e.n === 2n && e.d === 1n && b.k === 'fn') {
      const u = b.a[0]
      const l = linear(u, v)
      if (l) {
        c.regras.add('tabela')
        if (b.f === 'sec') return div(fn('tan', u), l.a)
        if (b.f === 'csc') return neg(div(fn('cot', u), l.a))
        if (b.f === 'tan') return sub(div(fn('tan', u), l.a), Sv)
        if (b.f === 'cot') return sub(neg(div(fn('cot', u), l.a)), Sv)
      }
    }
  }
  if (f.k === 'fn' && f.a.length === 1) {
    const r = deLinear(f.f, f.a[0], c)
    if (r) return r
  }
  const trig = potenciaTrig(f, c) ?? produtoParaSoma(f, c) ?? expTrig(f, c)
  if (trig) return trig
  if (f.k === 'mul' && polinomioComSoma(f)) {
    const ex = expande(f)
    if (ex.k === 'add') return prim(ex, { ...c, prof: c.prof + 1 })
  }
  const racional = divisaoRacional(f, c)
  if (racional) return racional
  const partes = porPartes(f, c)
  if (partes) return partes
  const sb = substituicao(f, c)
  if (sb) return sb
  const ex = expande(f)
  if (!igual(ex, f) && ex.k === 'add') return prim(ex, { ...c, prof: c.prof + 1 })
  return null
}

/** N/D com grau de N ≥ grau de D: divide antes de integrar. */
function divisaoRacional(f: Expr, c: Ctx): Expr | null {
  if (f.k !== 'mul') return null
  const den = f.a.find((x) => x.k === 'pow' && ehNum(x.e) && x.e.n === -1n && x.e.d === 1n && polinomio(x.b, c.v)) as Extract<Expr, { k: 'pow' }> | undefined
  if (!den) return null
  const N = coeficientes(prod(...f.a.filter((x) => x !== den)), c.v)
  const D = coeficientes(den.b, c.v)
  if (!N || !D || N.length < D.length) return null
  const v = S(c.v)
  const resto = [...N]
  const q: Expr[] = []
  for (let g = N.length - D.length; g >= 0; g--) {
    const k = div(resto[g + D.length - 1], D[D.length - 1])
    q.push(prod(k, pot(v, X(g))))
    D.forEach((d, i) => (resto[g + i] = sub(resto[g + i], prod(k, d))))
  }
  const r = soma(...resto.map((a, i) => prod(a, pot(v, X(i)))))
  c.regras.add('divisão de polinômios')
  return prim(expande(soma(...q, prod(r, den))), { ...c, prof: c.prof + 1 })
}

function polinomioComSoma(f: Extract<Expr, { k: 'mul' }>) {
  return f.a.some((x) => x.k === 'add' || (x.k === 'pow' && x.b.k === 'add' && ehInteiro(x.e) && (x.e as { n: bigint }).n > 0n))
}

let contador = 0

export type Primitiva = { F: Expr; regras: Regra[] }

/** Primitiva de `f` em `v`, conferida por derivada numérica em pontos sorteados. */
export function primitiva(f: Expr, v: string): Primitiva | null {
  const regras = new Set<Regra>()
  const novo = () => `w${++contador}`
  let F: Expr | null = null
  try {
    F = prim(f, { v, regras, prof: 0, novo })
  } catch {
    return null
  }
  if (!F || !confere(F, f, v)) return null
  return { F, regras: [...regras] }
}

/** F' = f em cinco pontos: a última barreira contra uma regra aplicada fora do domínio. */
function confere(F: Expr, f: Expr, v: string): boolean {
  const dF = deriva(F, v)
  const nomes = [...livres(f), ...livres(F)]
  let validos = 0
  for (let i = 0; i < 24 && validos < 5; i++) {
    const env: Record<string, number> = {}
    nomes.forEach((s, j) => {
      env[s] = 0.13 + ((i * 0.37 + j * 0.61 + 0.2) % 1) * (i % 2 ? 1.1 : 0.7)
    })
    const a = avalia(f, env)
    const b = avalia(dF, env)
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue
    validos++
    if (Math.abs(a - b) > 1e-7 * (1 + Math.abs(a))) return false
  }
  return validos > 0
}

/**
 * Núcleo algébrico. Os construtores (`soma`, `prod`, `pot`, `fn`) já devolvem a forma
 * canônica: derivar, substituir e integrar usam só eles e saem simplificados, sem uma
 * etapa separada de "simplify". Os números são racionais exatos em BigInt: 1/3 continua
 * 1/3 até o fim de uma integral tripla.
 */
export type Fn =
  | 'sin' | 'cos' | 'tan' | 'sec' | 'csc' | 'cot'
  | 'asin' | 'acos' | 'atan' | 'atan2'
  | 'sinh' | 'cosh' | 'tanh' | 'asinh' | 'acosh' | 'atanh'
  | 'ln' | 'abs' | 'sign' | 'floor' | 'ceil' | 'min' | 'max'

export type Expr =
  | { k: 'num'; n: bigint; d: bigint }
  | { k: 'sym'; s: string }
  | { k: 'add'; a: Expr[] }
  | { k: 'mul'; a: Expr[] }
  | { k: 'pow'; b: Expr; e: Expr }
  | { k: 'fn'; f: Fn; a: Expr[] }

const absB = (a: bigint) => (a < 0n ? -a : a)
function mdc(a: bigint, b: bigint): bigint {
  a = absB(a)
  b = absB(b)
  while (b) [a, b] = [b, a % b]
  return a
}

export function Q(n: bigint | number, d: bigint | number = 1n): Expr {
  let nb = BigInt(n)
  let db = BigInt(d)
  if (db === 0n) return INDEF
  if (db < 0n) {
    nb = -nb
    db = -db
  }
  const g = mdc(nb, db)
  return g > 1n ? { k: 'num', n: nb / g, d: db / g } : { k: 'num', n: nb, d: db }
}

/** Decimal escrito ("3.14", "1e-3") para racional exato. */
export function deDecimal(txt: string): Expr {
  const m = /^([+-]?)(\d*)\.?(\d*)(?:[eE]([+-]?\d+))?$/.exec(txt.trim())
  if (!m || (!m[2] && !m[3])) return INDEF
  const dig = (m[2] + m[3]) || '0'
  const exp = Number(m[4] ?? 0) - m[3].length
  if (Math.abs(exp) > 400) return INDEF
  const n = BigInt(dig) * (m[1] === '-' ? -1n : 1n)
  return exp >= 0 ? Q(n * 10n ** BigInt(exp)) : Q(n, 10n ** BigInt(-exp))
}

/** Número de ponto flutuante para racional, pelo decimal mais curto que o representa. */
export const deNumero = (v: number): Expr => (Number.isFinite(v) ? deDecimal(String(v)) : INDEF)

export const S = (s: string): Expr => ({ k: 'sym', s })
export const INDEF = S('indefinido')
export const INF = S('inf')
export const ZERO = Q(0)
export const UM = Q(1)
export const DOIS = Q(2)
export const MEIO = Q(1, 2)
export const MENOS1 = Q(-1)
export const PI = S('pi')
export const E = S('e')

export const ehNum = (e: Expr): e is Extract<Expr, { k: 'num' }> => e.k === 'num'
export const ehZero = (e: Expr) => e.k === 'num' && e.n === 0n
export const ehUm = (e: Expr) => e.k === 'num' && e.n === 1n && e.d === 1n
export const ehInteiro = (e: Expr) => e.k === 'num' && e.d === 1n
export const ehConstSim = (s: string) => s === 'pi' || s === 'e'

const chaves = new WeakMap<object, string>()
/** Texto canônico: duas expressões iguais têm a mesma chave. */
export function chave(e: Expr): string {
  const c = chaves.get(e)
  if (c !== undefined) return c
  let r: string
  switch (e.k) {
    case 'num': r = e.d === 1n ? `${e.n}` : `${e.n}/${e.d}`; break
    case 'sym': r = e.s; break
    case 'add': r = `(+ ${e.a.map(chave).join(' ')})`; break
    case 'mul': r = `(* ${e.a.map(chave).join(' ')})`; break
    case 'pow': r = `(^ ${chave(e.b)} ${chave(e.e)})`; break
    case 'fn': r = `(${e.f} ${e.a.map(chave).join(' ')})`; break
  }
  chaves.set(e, r)
  return r
}
export const igual = (a: Expr, b: Expr) => chave(a) === chave(b)

/** O sinal do coeficiente, para reconhecer sin(-x) e imprimir subtrações. */
export function negativo(e: Expr): boolean {
  if (e.k === 'num') return e.n < 0n
  if (e.k === 'mul') return negativo(e.a[0]) && e.a[0].k === 'num'
  return false
}

export const neg = (e: Expr) => prod(MENOS1, e)
export const sub = (a: Expr, b: Expr) => soma(a, neg(b))
export const div = (a: Expr, b: Expr) => prod(a, pot(b, MENOS1))
export const raiz = (a: Expr) => pot(a, MEIO)
export const quad = (a: Expr) => pot(a, DOIS)

function grau(e: Expr): number {
  switch (e.k) {
    case 'num': return 0
    case 'sym': return ehConstSim(e.s) ? 0 : 1
    case 'add': return Math.max(...e.a.map(grau))
    case 'mul': return e.a.reduce((s, x) => s + grau(x), 0)
    case 'pow': return e.e.k === 'num' ? grau(e.b) * (Number(e.e.n) / Number(e.e.d)) : grau(e.b) + 1
    case 'fn': return 1
  }
}

const compara = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
/** Polinômios saem do grau maior para o menor; o resto, em ordem estável. */
const ordemSoma = (a: Expr, b: Expr) => grau(b) - grau(a) || compara(chave(a), chave(b))

function rankFator(e: Expr): number {
  const b = e.k === 'pow' ? e.b : e
  if (e.k === 'num') return 0
  if (b.k === 'sym' && ehConstSim(b.s)) return 1
  if (b.k === 'num') return 2
  if (b.k === 'sym') return 3
  if (b.k === 'add') return 4
  return 5
}
const baseChave = (e: Expr) => chave(e.k === 'pow' ? e.b : e)
const ordemProd = (a: Expr, b: Expr) => rankFator(a) - rankFator(b) || compara(baseChave(a), baseChave(b))

/** Separa o coeficiente racional do resto de um termo. */
export function separa(e: Expr): [Extract<Expr, { k: 'num' }>, Expr] {
  if (e.k === 'num') return [e, UM]
  if (e.k === 'mul' && e.a[0].k === 'num') {
    const resto = e.a.slice(1)
    return [e.a[0], resto.length === 1 ? resto[0] : { k: 'mul', a: resto }]
  }
  return [UM as Extract<Expr, { k: 'num' }>, e]
}

function fatores(e: Expr): Expr[] {
  return e.k === 'mul' ? e.a : ehUm(e) ? [] : [e]
}

type Termo = { c: Extract<Expr, { k: 'num' }>; t: Expr }

function quadradosDe(t: Expr, f: Fn): { resto: Expr; u: Expr }[] {
  const out: { resto: Expr; u: Expr }[] = []
  for (const x of fatores(t)) {
    if (x.k === 'pow' && x.e.k === 'num' && x.e.d === 1n && x.e.n >= 2n && x.b.k === 'fn' && x.b.f === f) {
      // sen⁴ conta como sen²·sen²: é o que fecha sen⁴v + sen²v cos²v = sen²v no normal da esfera
      const outros = fatores(t).filter((y) => y !== x)
      out.push({ resto: prod(pot(x.b, Q(x.e.n - 2n)), ...outros), u: x.b.a[0] })
    }
  }
  return out
}

/** sen²u + cos²u = 1 e cosh²u − senh²u = 1, com fator comum: é o que limpa |∇f| em polares. */
function pitagoras(termos: Termo[]): Termo[] | null {
  const pares: [Fn, Fn, 1n | -1n][] = [['sin', 'cos', 1n], ['cosh', 'sinh', -1n]]
  for (const [fa, fb, sinal] of pares) {
    for (let i = 0; i < termos.length; i++) {
      for (const pa of quadradosDe(termos[i].t, fa)) {
        for (let j = 0; j < termos.length; j++) {
          if (i === j) continue
          for (const pb of quadradosDe(termos[j].t, fb)) {
            if (!igual(pa.u, pb.u) || !igual(pa.resto, pb.resto)) continue
            const ci = termos[i].c
            const cj = termos[j].c
            if (ci.n * cj.d === sinal * cj.n * ci.d) {
              const [c, t] = separa(prod(ci, pa.resto))
              return [...termos.filter((_, k) => k !== i && k !== j), { c, t }]
            }
          }
        }
      }
    }
  }
  return null
}

function junta(termos: Map<string, Termo>, c: Extract<Expr, { k: 'num' }>, t: Expr) {
  const k = chave(t)
  const ant = termos.get(k)
  if (!ant) {
    termos.set(k, { c, t })
    return
  }
  const novo = Q(ant.c.n * c.d + c.n * ant.c.d, ant.c.d * c.d) as Extract<Expr, { k: 'num' }>
  if (novo.n === 0n) termos.delete(k)
  else termos.set(k, { c: novo, t })
}

export function soma(...xs: Expr[]): Expr {
  const termos = new Map<string, Termo>()
  let cn = 0n
  let cd = 1n
  const empilha = (e: Expr) => {
    if (e === INDEF || (e.k === 'sym' && e.s === 'indefinido')) throw INDEFINIDO
    if (e.k === 'add') e.a.forEach(empilha)
    else if (e.k === 'num') {
      cn = cn * e.d + e.n * cd
      cd *= e.d
    } else {
      const [c, t] = separa(e)
      junta(termos, c, t)
    }
  }
  try {
    xs.forEach(empilha)
  } catch (err) {
    if (err === INDEFINIDO) return INDEF
    throw err
  }
  let lista = [...termos.values()]
  for (;;) {
    const r = pitagoras(lista)
    if (!r) break
    const m = new Map<string, Termo>()
    for (const t of r) {
      if (ehUm(t.t)) {
        cn = cn * t.c.d + t.c.n * cd
        cd *= t.c.d
      } else if (t.t.k === 'num') {
        const v = prod(t.c, t.t) as Extract<Expr, { k: 'num' }>
        cn = cn * v.d + v.n * cd
        cd *= v.d
      } else junta(m, t.c, t.t)
    }
    lista = [...m.values()]
  }
  const constante = Q(cn, cd)
  const saida = lista.map(({ c, t }) => (ehUm(c) ? t : aplicaCoef(c, t)))
  if (!ehZero(constante)) saida.push(constante)
  if (saida.length === 0) return ZERO
  if (saida.length === 1) return saida[0]
  return { k: 'add', a: saida.sort(ordemSoma) }
}

function aplicaCoef(c: Expr, t: Expr): Expr {
  return { k: 'mul', a: t.k === 'mul' ? [c, ...t.a] : [c, t] }
}

const INDEFINIDO = Symbol('indefinido')

export function prod(...xs: Expr[]): Expr {
  let cn = 1n
  let cd = 1n
  const bases = new Map<string, { b: Expr; e: Expr }>()
  let indef = false
  const empilha = (e: Expr) => {
    if (e.k === 'sym' && e.s === 'indefinido') indef = true
    else if (e.k === 'mul') e.a.forEach(empilha)
    else if (e.k === 'num') {
      cn *= e.n
      cd *= e.d
    } else {
      const b = e.k === 'pow' ? e.b : e
      const x = e.k === 'pow' ? e.e : UM
      const k = chave(b)
      const ant = bases.get(k)
      bases.set(k, ant ? { b, e: soma(ant.e, x) } : { b, e: x })
    }
  }
  xs.forEach(empilha)
  if (indef) return INDEF
  if (cn === 0n) return ZERO
  const fat: Expr[] = []
  for (const { b, e } of bases.values()) {
    const p = pot(b, e)
    if (p.k === 'num') {
      cn *= p.n
      cd *= p.d
    } else if (p.k === 'mul') {
      for (const x of p.a) {
        if (x.k === 'num') {
          cn *= x.n
          cd *= x.d
        } else fat.push(x)
      }
    } else if (!(p.k === 'sym' && p.s === 'indefinido')) fat.push(p)
    else return INDEF
  }
  const c = Q(cn, cd) as Extract<Expr, { k: 'num' }>
  if (c.n === 0n) return ZERO
  if (fat.length === 0) return c
  if (fat.length === 1 && fat[0].k === 'add' && !ehUm(c)) {
    // 2(x+1) distribui: é assim que termos semelhantes se encontram na soma
    return soma(...fat[0].a.map((t) => prod(c, t)))
  }
  fat.sort(ordemProd)
  if (ehUm(c)) return fat.length === 1 ? fat[0] : { k: 'mul', a: fat }
  return { k: 'mul', a: [c, ...fat] }
}

const PRIMOS = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n, 41n, 43n, 47n, 53n, 59n, 61n, 67n, 71n, 73n, 79n, 83n, 89n, 97n, 101n, 103n, 107n, 109n, 113n, 127n, 131n, 137n, 139n, 149n, 151n, 157n, 163n, 167n, 173n, 179n, 181n, 191n, 193n, 197n, 199n]

/** n^(1/q) inteiro: devolve [fora, dentro], com n = fora^q · dentro. */
function extraiRaiz(n: bigint, q: bigint): [bigint, bigint] {
  let fora = 1n
  let dentro = n
  for (const p of PRIMOS) {
    if (p * p > dentro) break
    let m = 0n
    while (dentro % p === 0n) {
      dentro /= p
      m++
    }
    fora *= p ** (m / q)
    dentro *= p ** (m % q)
  }
  // resto primo grande ou quadrado perfeito grande
  if (q === 2n && dentro > 1n) {
    const r = raizInteira(dentro)
    if (r * r === dentro) {
      fora *= r
      dentro = 1n
    }
  }
  return [fora, dentro]
}

function raizInteira(n: bigint): bigint {
  if (n < 2n) return n
  let x = BigInt(Math.floor(Math.sqrt(Number(n))))
  for (let i = 0; i < 64; i++) {
    const y = (x + n / x) / 2n
    if (y === x || y === x + 1n || y === x - 1n) {
      x = y
      break
    }
    x = y
  }
  while (x * x > n) x--
  while ((x + 1n) * (x + 1n) <= n) x++
  return x
}

/** a^(p/q) com a > 0 inteiro. O expoente fracionário canônico fica entre 0 e 1. */
function potInteiro(a: bigint, p: bigint, q: bigint): Expr {
  if (a === 1n) return UM
  let k = p / q
  let r = p % q
  if (r < 0n) {
    r += q
    k -= 1n
  }
  const inteira = k >= 0n ? Q(a ** k) : Q(1n, a ** -k)
  if (r === 0n) return inteira
  const g = mdc(r, q)
  const [rr, qq] = [r / g, q / g]
  const [fora, dentro] = extraiRaiz(a ** rr, qq)
  const c = Q((inteira as Extract<Expr, { k: 'num' }>).n * fora, (inteira as Extract<Expr, { k: 'num' }>).d)
  if (dentro === 1n) return c
  const radical: Expr = { k: 'pow', b: Q(dentro), e: Q(1n, qq) }
  return ehUm(c) ? radical : { k: 'mul', a: [c, radical] }
}

function potNumero(b: Extract<Expr, { k: 'num' }>, e: Extract<Expr, { k: 'num' }>): Expr {
  if (b.n === 0n) return e.n > 0n ? ZERO : e.n === 0n ? UM : INDEF
  if (e.d === 1n) {
    if (absB(e.n) > 4096n) return { k: 'pow', b, e }
    return e.n >= 0n ? Q(b.n ** e.n, b.d ** e.n) : Q(b.d ** -e.n, b.n ** -e.n)
  }
  if (e.d > 64n || absB(e.n) > 64n) return { k: 'pow', b, e }
  if (b.n < 0n) {
    if (e.d % 2n === 0n) return INDEF
    const m = potNumero(Q(-b.n, b.d) as Extract<Expr, { k: 'num' }>, e)
    return e.n % 2n === 0n ? m : neg(m)
  }
  // base inteira não passa por prod: prod volta a chamar pot para juntar expoentes
  if (b.d === 1n) return potInteiro(b.n, e.n, e.d)
  return prod(potInteiro(b.n, e.n, e.d), potInteiro(b.d, -e.n, e.d))
}

function logDe(e: Expr): Expr | null {
  if (e.k === 'fn' && e.f === 'ln') return e.a[0]
  return null
}

export function pot(b: Expr, e: Expr): Expr {
  if ((b.k === 'sym' && b.s === 'indefinido') || (e.k === 'sym' && e.s === 'indefinido')) return INDEF
  if (ehZero(e)) return UM
  if (ehUm(e)) return b
  if (ehUm(b)) return UM
  if (b.k === 'num' && e.k === 'num') return potNumero(b, e)
  if (b.k === 'num' && b.n === 0n) return { k: 'pow', b, e }
  if (b.k === 'pow') {
    if (e.k === 'num' && e.d === 1n) return pot(b.b, prod(b.e, e))
    if (b.e.k === 'num' && e.k === 'num') {
      const novo = prod(b.e, e)
      const par = b.e.d === 1n && b.e.n % 2n === 0n
      if (par) {
        // √(u²) = |u|, mas √(u⁴) = u²: o módulo só some em potência par
        if (novo.k === 'num' && novo.d === 1n && novo.n % 2n === 0n) return pot(b.b, novo)
        return pot(fn('abs', b.b), novo)
      }
      return pot(b.b, novo)
    }
  }
  if (b.k === 'mul') {
    if (e.k === 'num' && e.d === 1n) return prod(...b.a.map((f) => pot(f, e)))
    if (e.k === 'num') {
      const fora: Expr[] = []
      const dentro: Expr[] = []
      for (const f of b.a) {
        const seguro =
          (f.k === 'num' && f.n > 0n) ||
          (f.k === 'sym' && ehConstSim(f.s)) ||
          (f.k === 'pow' && f.e.k === 'num' && f.e.d === 1n && f.e.n % 2n === 0n)
        ;(seguro ? fora : dentro).push(f)
      }
      if (fora.length) {
        const r = fora.map((f) => pot(f, e))
        return dentro.length ? prod(...r, { k: 'pow', b: prod(...dentro), e }) : prod(...r)
      }
    }
  }
  if (b.k === 'sym' && b.s === 'e') {
    const l = logDe(e)
    if (l) return l
    if (e.k === 'mul') {
      const i = e.a.findIndex((f) => logDe(f))
      if (i >= 0) {
        const resto = e.a.filter((_, j) => j !== i)
        return pot(logDe(e.a[i])!, prod(...resto))
      }
    }
  }
  if (b.k === 'fn' && b.f === 'abs' && e.k === 'num' && e.d === 1n && e.n % 2n === 0n) return pot(b.a[0], e)
  if (b.k === 'fn' && b.f === 'sign' && e.k === 'num' && e.d === 1n && e.n % 2n === 0n) return UM
  return { k: 'pow', b, e }
}

/** r·π, se a expressão for um múltiplo racional de π. */
export function multiploDePi(e: Expr): Extract<Expr, { k: 'num' }> | null {
  if (ehZero(e)) return e as Extract<Expr, { k: 'num' }>
  if (e.k === 'sym' && e.s === 'pi') return UM as Extract<Expr, { k: 'num' }>
  if (e.k === 'mul' && e.a.length === 2 && e.a[0].k === 'num' && e.a[1].k === 'sym' && e.a[1].s === 'pi') return e.a[0]
  return null
}

const R2 = (): Expr => pot(DOIS, MEIO)
const R3 = (): Expr => pot(Q(3), MEIO)

/** sen(π·n/d) exato nos ângulos notáveis. */
function senoNotavel(n: bigint, d: bigint): Expr | null {
  const per = 2n * d
  let r = ((n % per) + per) % per // em [0, 2) vezes d
  let sinal = 1
  if (r >= d) {
    r -= d
    sinal = -1
  }
  if (2n * r > d) r = d - r
  const f = Q(r, d) as Extract<Expr, { k: 'num' }>
  const k = `${f.n}/${f.d}`
  const tab: Record<string, () => Expr> = {
    '0/1': () => ZERO,
    '1/6': () => MEIO,
    '1/4': () => prod(MEIO, R2()),
    '1/3': () => prod(MEIO, R3()),
    '1/2': () => UM,
  }
  const v = tab[k]?.()
  if (!v) return null
  return sinal > 0 ? v : neg(v)
}

function trigExata(f: Fn, r: Extract<Expr, { k: 'num' }>): Expr | null {
  const s = senoNotavel(r.n, r.d)
  const c = senoNotavel(r.d - 2n * r.n, 2n * r.d)
  if (!s || !c) return null
  switch (f) {
    case 'sin': return s
    case 'cos': return c
    case 'tan': return ehZero(c) ? INDEF : div(s, c)
    case 'cot': return ehZero(s) ? INDEF : div(c, s)
    case 'sec': return ehZero(c) ? INDEF : div(UM, c)
    case 'csc': return ehZero(s) ? INDEF : div(UM, s)
    default: return null
  }
}

function arcoExato(f: Fn, x: Expr): Expr | null {
  const tab: [Expr, Expr, Expr][] = [
    [ZERO, ZERO, prod(MEIO, PI)],
    [MEIO, prod(Q(1, 6), PI), prod(Q(1, 3), PI)],
    [prod(MEIO, R2()), prod(Q(1, 4), PI), prod(Q(1, 4), PI)],
    [prod(MEIO, R3()), prod(Q(1, 3), PI), prod(Q(1, 6), PI)],
    [UM, prod(MEIO, PI), ZERO],
  ]
  const abs = negativo(x) ? neg(x) : x
  if (f === 'atan') {
    const t: [Expr, Expr][] = [
      [ZERO, ZERO],
      [prod(Q(1, 3), R3()), prod(Q(1, 6), PI)],
      [UM, prod(Q(1, 4), PI)],
      [R3(), prod(Q(1, 3), PI)],
    ]
    const hit = t.find(([v]) => igual(v, abs))
    if (!hit) return null
    return negativo(x) ? neg(hit[1]) : hit[1]
  }
  const hit = tab.find(([v]) => igual(v, abs))
  if (!hit) return null
  if (f === 'asin') return negativo(x) ? neg(hit[1]) : hit[1]
  return negativo(x) ? sub(PI, hit[2]) : hit[2]
}

const IMPARES: Partial<Record<Fn, true>> = { sin: true, tan: true, csc: true, cot: true, asin: true, atan: true, sinh: true, tanh: true, asinh: true, atanh: true }
const PARES: Partial<Record<Fn, true>> = { cos: true, sec: true, cosh: true }

function comparaNum(a: Extract<Expr, { k: 'num' }>, b: Extract<Expr, { k: 'num' }>) {
  const d = a.n * b.d - b.n * a.d
  return d < 0n ? -1 : d > 0n ? 1 : 0
}

export function fn(f: Fn, ...a: Expr[]): Expr {
  if (a.some((x) => x.k === 'sym' && x.s === 'indefinido')) return INDEF
  const x = a[0]
  if (a.length === 1) {
    if ((f === 'sin' || f === 'cos' || f === 'tan' || f === 'sec' || f === 'csc' || f === 'cot')) {
      const m = multiploDePi(x)
      if (m) {
        const v = trigExata(f, m)
        if (v) return v
      }
    }
    if (f === 'asin' || f === 'acos' || f === 'atan') {
      const v = arcoExato(f, x)
      if (v) return v
    }
    if (negativo(x)) {
      if (IMPARES[f]) return neg(fn(f, neg(x)))
      if (PARES[f]) return fn(f, neg(x))
    }
    if (ehZero(x)) {
      if (f === 'sinh' || f === 'tanh' || f === 'asinh' || f === 'atanh') return ZERO
      if (f === 'cosh') return UM
      if (f === 'ln') return INDEF
    }
    if (f === 'ln') {
      if (ehUm(x)) return ZERO
      if (x.k === 'sym' && x.s === 'e') return UM
      if (x.k === 'pow' && x.b.k === 'sym' && x.b.s === 'e') return x.e
    }
    if (f === 'abs') {
      if (x.k === 'num') return Q(absB(x.n), x.d)
      if (x.k === 'sym' && ehConstSim(x.s)) return x
      if (x.k === 'pow' && x.e.k === 'num' && x.e.d === 1n && x.e.n % 2n === 0n) return x
      if (x.k === 'pow' && x.b.k === 'sym' && x.b.s === 'e') return x
      if (x.k === 'fn' && (x.f === 'abs' || x.f === 'cosh')) return x
      if (x.k === 'pow' && x.b.k === 'num' && x.b.n > 0n) return x
      if (x.k === 'mul') return prod(...x.a.map((t) => fn('abs', t)))
      if (negativo(x)) return fn('abs', neg(x))
    }
    if (f === 'sign' && x.k === 'num') return Q(x.n > 0n ? 1 : x.n < 0n ? -1 : 0)
    if (f === 'floor' && x.k === 'num') return Q(pisoB(x.n, x.d))
    if (f === 'ceil' && x.k === 'num') return Q(-pisoB(-x.n, x.d))
  } else if ((f === 'min' || f === 'max') && a.every(ehNum)) {
    const ns = a as Extract<Expr, { k: 'num' }>[]
    return ns.reduce((m, y) => ((f === 'min' ? comparaNum(y, m) < 0 : comparaNum(y, m) > 0) ? y : m))
  }
  return { k: 'fn', f, a }
}

function pisoB(n: bigint, d: bigint) {
  const q = n / d
  return n % d !== 0n && n < 0n ? q - 1n : q
}

export function dep(e: Expr, v: string): boolean {
  switch (e.k) {
    case 'num': return false
    case 'sym': return e.s === v
    case 'add': case 'mul': return e.a.some((x) => dep(x, v))
    case 'pow': return dep(e.b, v) || dep(e.e, v)
    case 'fn': return e.a.some((x) => dep(x, v))
  }
}

export function livres(e: Expr, s = new Set<string>()): Set<string> {
  switch (e.k) {
    case 'sym': if (!ehConstSim(e.s) && e.s !== 'inf' && e.s !== 'indefinido') s.add(e.s); break
    case 'add': case 'mul': case 'fn': e.a.forEach((x) => livres(x, s)); break
    case 'pow': livres(e.b, s); livres(e.e, s); break
  }
  return s
}

export function mapeia(e: Expr, g: (x: Expr) => Expr): Expr {
  switch (e.k) {
    case 'num': case 'sym': return e
    case 'add': return soma(...e.a.map(g))
    case 'mul': return prod(...e.a.map(g))
    case 'pow': return pot(g(e.b), g(e.e))
    case 'fn': return fn(e.f, ...e.a.map(g))
  }
}

/** Troca símbolos, reconstruindo pelos construtores: o resultado já sai canônico. */
export function subst(e: Expr, m: Record<string, Expr>): Expr {
  if (e.k === 'sym') return Object.hasOwn(m, e.s) ? m[e.s] : e
  return mapeia(e, (x) => subst(x, m))
}

/** Troca uma subexpressão inteira por outra. */
export function troca(e: Expr, alvo: Expr, por: Expr): Expr {
  if (igual(e, alvo)) return por
  if (e.k === 'num' || e.k === 'sym') return e
  return mapeia(e, (x) => troca(x, alvo, por))
}

/** Distribui produtos e potências inteiras de somas. */
export function expande(e: Expr, limite = 6000): Expr {
  switch (e.k) {
    case 'num': case 'sym': return e
    case 'add': return soma(...e.a.map((x) => expande(x, limite)))
    case 'fn': return fn(e.f, ...e.a.map((x) => expande(x, limite)))
    case 'mul': {
      let termos: Expr[] = [UM]
      for (const f of e.a) {
        const g = expande(f, limite)
        const ts = g.k === 'add' ? g.a : [g]
        if (termos.length * ts.length > limite) return e
        const novo: Expr[] = []
        for (const a of termos) for (const b of ts) novo.push(prod(a, b))
        termos = novo
      }
      return soma(...termos)
    }
    case 'pow': {
      const b = expande(e.b, limite)
      if (e.e.k === 'num' && e.e.d === 1n && e.e.n > 1n && e.e.n <= 12n && b.k === 'add') {
        let r: Expr = UM
        for (let i = 0n; i < e.e.n; i++) r = expande({ k: 'mul', a: [r, b] }, limite)
        return r
      }
      return pot(b, expande(e.e, limite))
    }
  }
}

function racParaNumero(n: bigint, d: bigint): number {
  const a = Number(n)
  const b = Number(d)
  if (Number.isFinite(a) && Number.isFinite(b)) return a / b
  const corte = BigInt(Math.max(n.toString(2).length, d.toString(2).length) - 1000)
  return Number(n >> corte) / Number(d >> corte)
}

export const numero = (e: Extract<Expr, { k: 'num' }>) => racParaNumero(e.n, e.d)

/** Valor em ponto flutuante; símbolo sem valor em `env` dá NaN. */
export function avalia(e: Expr, env: Record<string, number> = {}): number {
  switch (e.k) {
    case 'num': return racParaNumero(e.n, e.d)
    case 'sym':
      if (e.s === 'pi') return Math.PI
      if (e.s === 'e') return Math.E
      if (e.s === 'inf') return Infinity
      return Object.hasOwn(env, e.s) ? env[e.s] : NaN
    case 'add': return e.a.reduce((s, x) => s + avalia(x, env), 0)
    case 'mul': return e.a.reduce((s, x) => s * avalia(x, env), 1)
    case 'pow': return Math.pow(avalia(e.b, env), avalia(e.e, env))
    case 'fn': return aplicaFn(e.f, e.a.map((x) => avalia(x, env)))
  }
}

export function aplicaFn(f: Fn, a: number[]): number {
  const x = a[0]
  switch (f) {
    case 'sin': return Math.sin(x)
    case 'cos': return Math.cos(x)
    case 'tan': return Math.tan(x)
    case 'sec': return 1 / Math.cos(x)
    case 'csc': return 1 / Math.sin(x)
    case 'cot': return 1 / Math.tan(x)
    case 'asin': return Math.asin(x)
    case 'acos': return Math.acos(x)
    case 'atan': return Math.atan(x)
    case 'atan2': return Math.atan2(a[0], a[1])
    case 'sinh': return Math.sinh(x)
    case 'cosh': return Math.cosh(x)
    case 'tanh': return Math.tanh(x)
    case 'asinh': return Math.asinh(x)
    case 'acosh': return Math.acosh(x)
    case 'atanh': return Math.atanh(x)
    case 'ln': return Math.log(x)
    case 'abs': return Math.abs(x)
    case 'sign': return Math.sign(x)
    case 'floor': return Math.floor(x)
    case 'ceil': return Math.ceil(x)
    case 'min': return Math.min(...a)
    case 'max': return Math.max(...a)
  }
}

import { type Expr, Q, UM, ehInteiro, ehUm, negativo, prod, separa, neg } from './alg'

const GREGOS: Record<string, string> = {
  pi: '\\pi', theta: '\\theta', rho: '\\rho', phi: '\\varphi', alpha: '\\alpha', beta: '\\beta', gamma: '\\gamma',
  delta: '\\delta', epsilon: '\\varepsilon', lambda: '\\lambda', mu: '\\mu', nu: '\\nu', xi: '\\xi', sigma: '\\sigma',
  tau: '\\tau', psi: '\\psi', omega: '\\omega', inf: '\\infty',
}

export function texSimbolo(s: string): string {
  if (GREGOS[s]) return GREGOS[s]
  const m = /^(.+?)_(.+)$/.exec(s)
  if (m) return `${texSimbolo(m[1])}_{${m[2]}}`
  return s.length > 1 ? `\\mathrm{${s}}` : s
}

const NOMES: Record<string, string> = {
  sin: '\\sin', cos: '\\cos', tan: '\\tan', sec: '\\sec', csc: '\\csc', cot: '\\cot',
  asin: '\\arcsin', acos: '\\arccos', atan: '\\arctan', sinh: '\\sinh', cosh: '\\cosh', tanh: '\\tanh',
  asinh: '\\operatorname{arcsenh}', acosh: '\\operatorname{arccosh}', atanh: '\\operatorname{arctgh}',
  ln: '\\ln', sign: '\\operatorname{sgn}', min: '\\min', max: '\\max', atan2: '\\operatorname{atan2}',
}

const simples = (e: Expr) => e.k === 'sym' || (e.k === 'num' && e.d === 1n && e.n >= 0n)

function argumento(a: Expr): string {
  return simples(a) ? `\\,${tex(a)}` : `\\left(${tex(a)}\\right)`
}

function texFn(e: Extract<Expr, { k: 'fn' }>, potencia?: string): string {
  if (e.f === 'abs') return `\\left|${tex(e.a[0])}\\right|${potencia ? `^{${potencia}}` : ''}`
  if (e.f === 'floor') return `\\lfloor ${tex(e.a[0])}\\rfloor`
  if (e.f === 'ceil') return `\\lceil ${tex(e.a[0])}\\rceil`
  const nome = NOMES[e.f] ?? `\\operatorname{${e.f}}`
  const p = potencia ? `^{${potencia}}` : ''
  if (e.a.length > 1) return `${nome}${p}\\left(${e.a.map(tex).join(',\\ ')}\\right)`
  return `${nome}${p}${argumento(e.a[0])}`
}

function basePot(b: Expr): string {
  if (b.k === 'sym') return tex(b)
  if (b.k === 'num' && b.d === 1n && b.n >= 0n) return tex(b)
  if (b.k === 'fn' && b.f === 'abs') return tex(b)
  return `\\left(${tex(b)}\\right)`
}

function texPot(e: Extract<Expr, { k: 'pow' }>): string {
  const x = e.e
  if (x.k === 'num' && x.n === 1n && x.d > 1n) return x.d === 2n ? `\\sqrt{${tex(e.b)}}` : `\\sqrt[${x.d}]{${tex(e.b)}}`
  if (x.k === 'num' && x.d === 2n && x.n > 0n && x.n <= 7n && e.b.k !== 'num') {
    // u^(3/2) lê melhor como raiz quando o aluno vai conferir com o caderno
    return `${basePot(e.b)}^{${tex(x)}}`
  }
  if (e.b.k === 'fn' && ehInteiro(x) && (x as { n: bigint }).n > 0n) return texFn(e.b, tex(x))
  return `${basePot(e.b)}^{${tex(x)}}`
}

function precisaParen(f: Expr) {
  return f.k === 'add'
}

function fator(f: Expr): string {
  if (f.k === 'pow') return texPot(f)
  return precisaParen(f) ? `\\left(${tex(f)}\\right)` : tex(f)
}

function junta(fs: Expr[]): string {
  let s = ''
  fs.forEach((f, i) => {
    const t = fator(f)
    if (i > 0) {
      const ant = fs[i - 1]
      const colado = /^[0-9]/.test(t) || (ant.k === 'num' && t.startsWith('\\frac'))
      s += colado ? ' \\cdot ' : ' '
    }
    s += t
  })
  return s
}

function texMul(e: Expr): string {
  const [c, resto] = separa(e)
  const fs = resto.k === 'mul' ? resto.a : ehUm(resto) ? [] : [resto]
  const cima: Expr[] = []
  const baixo: Expr[] = []
  for (const f of fs) {
    if (f.k === 'pow' && negativo(f.e)) baixo.push(f.e.k === 'num' && f.e.n === -1n && f.e.d === 1n ? f.b : { k: 'pow', b: f.b, e: neg(f.e) })
    else cima.push(f)
  }
  const n = c.n < 0n ? -c.n : c.n
  const sinal = c.n < 0n ? '-' : ''
  const nCima = n !== 1n ? [Q(n), ...cima] : cima
  const nBaixo = c.d !== 1n ? [Q(c.d), ...baixo] : baixo
  const topo = nCima.length ? junta(nCima) : '1'
  if (!nBaixo.length) return sinal + topo
  // fração já agrupa: x + 1 sozinho num andar dispensa parênteses
  const solto = (l: Expr[]) => (l.length === 1 && l[0].k === 'add' ? tex(l[0]) : junta(l))
  return `${sinal}\\frac{${nCima.length ? solto(nCima) : '1'}}{${solto(nBaixo)}}`
}

/** Expressão para LaTeX, com a forma que se escreve no caderno. */
export function tex(e: Expr): string {
  switch (e.k) {
    case 'num': {
      if (e.d === 1n) return `${e.n}`
      const s = e.n < 0n ? '-' : ''
      return `${s}\\frac{${e.n < 0n ? -e.n : e.n}}{${e.d}}`
    }
    case 'sym': return texSimbolo(e.s)
    case 'pow':
      if (negativo(e.e)) return texMul({ k: 'mul', a: [UM, e] })
      return texPot(e)
    case 'fn': return texFn(e)
    case 'mul': return texMul(e)
    case 'add': {
      // começa por um termo positivo: "1 − x²", não "−x² + 1"
      const i = e.a.findIndex((t) => !negativo(t))
      const lista = i > 0 ? [e.a[i], ...e.a.slice(0, i), ...e.a.slice(i + 1)] : e.a
      let s = ''
      lista.forEach((t, j) => {
        if (j === 0) s += tex(t)
        else if (negativo(t)) s += ` - ${tex(prod(Q(-1), t))}`
        else s += ` + ${tex(t)}`
      })
      return s
    }
  }
}

export const texVetor = (v: Expr[]) => `\\left(${v.map(tex).join(',\\ ')}\\right)`

import { E, type Expr, INDEF, INF, PI, Q, S, UM, ZERO, deDecimal, dep, div, fn, neg, pot, prod, raiz, soma, sub, subst } from '../math/alg'
import { cruz, deriva, divergente, gradiente, laplaciano, norma, pontoV, rotacional } from '../math/diff'
import { primitiva } from '../math/integra'
import type { Fn } from '../math/alg'
import type { No } from './parser'

export type Valor = Expr | Expr[]
export const ehVetor = (v: Valor): v is Expr[] => Array.isArray(v)

export type Funcao = { params: string[]; corpo: Valor }

export type Escopo = {
  funcoes: Map<string, Funcao>
  /** Controles deslizantes e constantes: continuam símbolos até a hora de avaliar. */
  numeros: Map<string, number>
  unitarios: boolean
}

export const escopoVazio = (): Escopo => ({ funcoes: new Map(), numeros: new Map(), unitarios: false })

export class ErroCalculo extends Error {}

const SIMPLES: Record<string, Fn> = {
  sin: 'sin', cos: 'cos', tan: 'tan', sec: 'sec', csc: 'csc', cot: 'cot', asin: 'asin', acos: 'acos', atan: 'atan',
  sinh: 'sinh', cosh: 'cosh', tanh: 'tanh', asinh: 'asinh', acosh: 'acosh', atanh: 'atanh', ln: 'ln', sign: 'sign', floor: 'floor', ceil: 'ceil',
}

const escalar = (v: Valor, onde: string): Expr => {
  if (ehVetor(v)) throw new ErroCalculo(`${onde} pede um número, não um vetor`)
  return v
}

/** Reconhece as variáveis de um campo ou função sem nome: grad(x² + y²) usa (x, y). */
export function coordenadasDe(v: Valor): string[] {
  const usa = (s: string) => (ehVetor(v) ? v.some((c) => dep(c, s)) : dep(v, s))
  if (usa('z') || (ehVetor(v) && v.length === 3)) return ['x', 'y', 'z']
  return ['x', 'y']
}

function aplica(f: Funcao, args: Valor[], nome: string): Valor {
  let lista = args
  if (lista.length === 1 && ehVetor(lista[0])) lista = lista[0]
  if (lista.length !== f.params.length) throw new ErroCalculo(`${nome} pede ${f.params.length} argumento(s)`)
  const m: Record<string, Expr> = {}
  f.params.forEach((p, i) => (m[p] = escalar(lista[i], 'Argumento de função')))
  return ehVetor(f.corpo) ? f.corpo.map((c) => subst(c, m)) : subst(f.corpo, m)
}

function argFuncao(no: No, esc: Escopo): { v: Valor; vars: string[] } {
  if (no.t === 'id') {
    const f = esc.funcoes.get(no.v)
    if (f && f.params.length) return { v: f.corpo, vars: f.params }
  }
  const v = paraValor(no, esc)
  return { v, vars: coordenadasDe(v) }
}

const NOMES: Record<string, string> = { gradiente: 'grad', divergente: 'div', rotacional: 'rot', curl: 'rot', laplaciano: 'lap' }

function operador(nome: string, a: No[], esc: Escopo): Valor {
  const op = NOMES[nome] ?? nome
  if (!['grad', 'div', 'rot', 'lap'].includes(op)) throw new ErroCalculo(`${nome}(…) precisa de uma expressão só para ele`)
  const { v, vars } = argFuncao(a[0], esc)
  if (op === 'grad') return gradiente(escalar(v, 'grad'), vars)
  if (op === 'lap') return laplaciano(escalar(v, 'lap'), vars)
  if (!ehVetor(v)) throw new ErroCalculo(`${op} pede um campo vetorial`)
  if (op === 'div') return divergente(v, vars.length === v.length ? vars : ['x', 'y', 'z'].slice(0, v.length))
  if (v.length === 2) return sub(deriva(v[1], 'x'), deriva(v[0], 'y'))
  return rotacional(v, ['x', 'y', 'z'])
}

const ehNomeDeFuncao = (no: No, esc: Escopo) => no.t === 'id' && esc.funcoes.has(no.v)

function binario(no: Extract<No, { t: 'bin' }>, esc: Escopo): Valor {
  const a = paraValor(no.a, esc)
  const b = paraValor(no.b, esc)
  const va = ehVetor(a)
  const vb = ehVetor(b)
  switch (no.op) {
    case '+': case '-': {
      if (va !== vb) throw new ErroCalculo('Não dá para somar número com vetor')
      const f = no.op === '+' ? soma : sub
      if (va && vb) {
        if (a.length !== b.length) throw new ErroCalculo('Vetores de tamanhos diferentes')
        return a.map((c, i) => f(c, b[i]))
      }
      return f(a as Expr, b as Expr)
    }
    case '*':
      if (va && vb) throw new ErroCalculo('Entre dois vetores, use · (escalar) ou × (vetorial)')
      if (va) return a.map((c) => prod(c, b as Expr))
      if (vb) return b.map((c) => prod(a as Expr, c))
      return prod(a as Expr, b as Expr)
    case '/':
      if (vb) throw new ErroCalculo('Não dá para dividir por um vetor')
      if (va) return a.map((c) => div(c, b as Expr))
      return div(a as Expr, b as Expr)
    case '^':
      if (va && !vb && (b as Expr).k === 'num') {
        // ||v||² escrito como v^2 é o produto escalar
        return pontoV(a, a)
      }
      if (va || vb) throw new ErroCalculo('Potência de vetor não existe')
      return pot(a as Expr, b as Expr)
    case '·':
      if (va && vb) {
        if (a.length !== b.length) throw new ErroCalculo('Vetores de tamanhos diferentes')
        return pontoV(a, b)
      }
      if (va) return a.map((c) => prod(c, b as Expr))
      if (vb) return b.map((c) => prod(a as Expr, c))
      return prod(a as Expr, b as Expr)
    case '×':
      if (va && vb) {
        const p = (u: Expr[]) => (u.length === 2 ? [...u, ZERO] : u)
        return cruz(p(a), p(b))
      }
      if (va) return a.map((c) => prod(c, b as Expr))
      if (vb) return b.map((c) => prod(a as Expr, c))
      return prod(a as Expr, b as Expr)
  }
}

function chamaFuncao(no: Extract<No, { t: 'fn' }>, esc: Escopo): Valor {
  const a = no.a.map((x) => paraValor(x, esc))
  const x = a[0]
  if (no.f === 'abs') return ehVetor(x) ? norma(x) : fn('abs', x)
  const u = escalar(x, no.f)
  switch (no.f) {
    case 'sqrt': return raiz(u)
    case 'exp': return pot(E, u)
    case 'log': {
      const base = no.base ? escalar(paraValor(no.base, esc), 'base do logaritmo') : Q(10)
      return div(fn('ln', u), fn('ln', base))
    }
    case 'min': case 'max': case 'atan2': return fn(no.f, ...a.map((c) => escalar(c, no.f)))
  }
  const f = SIMPLES[no.f]
  if (!f) throw new ErroCalculo(`Função desconhecida: ${no.f}`)
  return fn(f, u)
}

export function paraValor(no: No, esc: Escopo): Valor {
  switch (no.t) {
    case 'num': return deDecimal(no.v)
    case 'neg': {
      const v = paraValor(no.a, esc)
      return ehVetor(v) ? v.map(neg) : neg(v)
    }
    case 'id': return identificador(no.v, esc)
    case 'bin': return binario(no, esc)
    case 'fn': return chamaFuncao(no, esc)
    case 'tup': return no.a.map((x) => escalar(paraValor(x, esc), 'Coordenada'))
    case 'abs': {
      const v = paraValor(no.a, esc)
      return ehVetor(v) ? norma(v) : fn('abs', v)
    }
    case 'call': {
      const f = esc.funcoes.get(no.f)
      if (f) return aplica(f, no.a.map((x) => paraValor(x, esc)), no.f)
      const parcial = derivadaIndice(no.f, esc)
      if (parcial) return aplica(parcial, no.a.map((x) => paraValor(x, esc)), no.f)
      return operador(no.f, no.a, esc)
    }
    case 'dif': {
      let v: Valor = no.f.t === 'id' && esc.funcoes.has(no.f.v) ? esc.funcoes.get(no.f.v)!.corpo : paraValor(no.f, esc)
      for (const x of no.vs) v = ehVetor(v) ? v.map((c) => deriva(c, x)) : deriva(v, x)
      return v
    }
    case 'linhaD': {
      if (!ehNomeDeFuncao(no.f, esc)) throw new ErroCalculo('A derivada com apóstrofo pede uma função definida')
      const nome = (no.f as { v: string }).v
      const f = esc.funcoes.get(nome)!
      const p = f.params[0]
      if (p === undefined || f.params.length > 1) throw new ErroCalculo(`${nome}' só vale para funções de uma variável`)
      let c = f.corpo
      for (let i = 0; i < no.ordem; i++) c = ehVetor(c) ? c.map((x) => deriva(x, p)) : deriva(c, p)
      return no.args ? aplica({ params: f.params, corpo: c }, no.args.map((x) => paraValor(x, esc)), nome) : c
    }
    case 'int': return integralComoValor(no, esc)
  }
}

function derivadaIndice(id: string, esc: Escopo): Funcao | null {
  const m = /^(.+?)_([a-z]+)$/.exec(id)
  if (!m) return null
  const f = esc.funcoes.get(m[1])
  if (!f || ![...m[2]].every((c) => f.params.includes(c))) return null
  let c = f.corpo
  for (const x of m[2]) c = ehVetor(c) ? c.map((y) => deriva(y, x)) : deriva(c, x)
  return { params: f.params, corpo: c }
}

function identificador(id: string, esc: Escopo): Valor {
  const f = esc.funcoes.get(id)
  if (f) return f.corpo
  if (esc.numeros.has(id)) return S(id)
  if (id === 'pi') return PI
  if (id === 'e') return E
  if (id === 'inf') return INF
  if (esc.unitarios) {
    if (id === 'i') return [UM, ZERO, ZERO]
    if (id === 'j') return [ZERO, UM, ZERO]
    if (id === 'k') return [ZERO, ZERO, UM]
  }
  const parcial = derivadaIndice(id, esc)
  if (parcial) return parcial.corpo
  return S(id)
}

/** Integral dentro de uma fórmula maior: só a forma simbólica cabe aqui. */
function integralComoValor(no: Extract<No, { t: 'int' }>, esc: Escopo): Valor {
  if (no.sub) throw new ErroCalculo('Integral sobre curva, superfície ou região só entra em somas e múltiplos, como ∫_A F·dr + ∫_B F·dr')
  if (no.n !== 1 || no.ds.length !== 1) throw new ErroCalculo('Integral dupla ou tripla dentro de outra conta: escreva-a sozinha ou como parcela de uma soma')
  const f = escalar(paraValor(no.corpo, esc), 'Integrando')
  const v = no.ds[0]
  const p = primitiva(f, v)
  if (!p) throw new ErroCalculo('Não achei primitiva fechada para esta integral')
  if (!no.lo || !no.hi) return p.F
  const lo = escalar(paraValor(no.lo, esc), 'Limite')
  const hi = escalar(paraValor(no.hi, esc), 'Limite')
  const r = sub(subst(p.F, { [v]: hi }), subst(p.F, { [v]: lo }))
  return r === INDEF ? INDEF : r
}

import { type Expr, Q, S, UM, ZERO, dep, fn, pot, prod, subst } from '../math/alg'
import type { Limite } from '../math/quad'
import { tex, texSimbolo } from '../math/tex'
import { ErroCalculo, type Escopo, ehVetor, paraValor } from './valor'
import type { Item, No } from './parser'

export type Coord = 'cart' | 'pol' | 'cil' | 'esf'

/** Região iterada, da variável de fora para a de dentro. */
export type Regiao = { coords: Coord; lim: Limite[] }

const x = S('x')
const y = S('y')
const z = S('z')
const r = S('r')
const t = S('theta')
const p = S('rho')
const f = S('phi')

/** Coordenadas cartesianas de um ponto da região. */
export function posicao(c: Coord, dim: number): [Expr, Expr, Expr] {
  switch (c) {
    case 'cart': return [x, y, dim === 3 ? z : ZERO]
    case 'pol': return [prod(r, fn('cos', t)), prod(r, fn('sin', t)), ZERO]
    case 'cil': return [prod(r, fn('cos', t)), prod(r, fn('sin', t)), z]
    case 'esf': return [prod(p, fn('sin', f), fn('cos', t)), prod(p, fn('sin', f), fn('sin', t)), prod(p, fn('cos', f))]
  }
}

export function jacobiano(c: Coord): Expr {
  switch (c) {
    case 'cart': return UM
    case 'pol': case 'cil': return r
    case 'esf': return prod(pot(p, Q(2)), fn('sin', f))
  }
}

export const TEX_DIF: Record<Coord, string> = { cart: '', pol: 'r', cil: 'r', esf: '\\rho^{2}\\sin\\varphi' }

/** Reescreve uma função de x, y, z nas coordenadas da região. */
export function pullback(e: Expr, reg: Regiao): Expr {
  const [a, b, c] = posicao(reg.coords, reg.lim.length)
  return subst(e, { x: a, y: b, z: c })
}

export function coordsDasVariaveis(vs: string[]): Coord | null {
  const s = new Set(vs)
  if (s.has('rho')) return s.size === 3 && s.has('theta') && s.has('phi') ? 'esf' : null
  if (s.has('r') || s.has('theta')) {
    if (s.size === 2 && s.has('r') && s.has('theta')) return 'pol'
    if (s.size === 3 && s.has('r') && s.has('theta') && s.has('z')) return 'cil'
    return null
  }
  if ((s.size === 2 && s.has('x') && s.has('y')) || (s.size === 3 && s.has('x') && s.has('y') && s.has('z'))) return 'cart'
  // R: 0≤x≤1, 0≤z≤2 é um retângulo no plano xz; fica para os paramétricos
  return null
}

/** a ≤ v ≤ b escrito em cadeia; aceita ≥ e a forma b ≥ v ≥ a. */
export function cadeia(item: Item): { id: string; lo: No; hi: No } | null {
  if (item.partes.length !== 3) return null
  const m = item.partes[1]
  if (m.t !== 'id') return null
  const menor = item.ops.every((o) => o === '<' || o === '<=')
  const maior = item.ops.every((o) => o === '>' || o === '>=')
  if (!menor && !maior) return null
  return menor ? { id: m.v, lo: item.partes[0], hi: item.partes[2] } : { id: m.v, lo: item.partes[2], hi: item.partes[0] }
}

/** Ordena para que cada limite só dependa de variáveis mais externas. */
export function ordena(lims: Limite[]): Limite[] {
  const fora: Limite[] = []
  const resto = [...lims]
  while (resto.length) {
    const i = resto.findIndex((l) => !resto.some((o) => o !== l && (dep(l.lo, o.v) || dep(l.hi, o.v))))
    if (i < 0) throw new ErroCalculo('Os limites dependem uns dos outros em círculo')
    fora.push(resto[i])
    resto.splice(i, 1)
  }
  return fora
}

const esc1 = (n: No, esc: Escopo): Expr => {
  const v = paraValor(n, esc)
  if (ehVetor(v)) throw new ErroCalculo('Limite precisa ser um número')
  return v
}

export function regiaoDeItens(itens: Item[], esc: Escopo): Regiao | null {
  const lims: Limite[] = []
  for (const it of itens) {
    const c = cadeia(it)
    if (!c) return null
    lims.push({ v: c.id, lo: esc1(c.lo, esc), hi: esc1(c.hi, esc) })
  }
  const coords = coordsDasVariaveis(lims.map((l) => l.v))
  if (!coords) return null
  return { coords, lim: ordena(lims) }
}

export function texDiferenciais(lim: Limite[]): string {
  return [...lim].reverse().map((l) => `d${texSimbolo(l.v)}`).join('\\,')
}

/** ∫∫∫ escrito com limites, de fora para dentro. */
export function texIterada(corpo: string, lim: Limite[]): string {
  const ints = lim.map((l) => `\\int_{${tex(l.lo)}}^{${tex(l.hi)}}`).join('')
  return `${ints} ${corpo}\\,${texDiferenciais(lim)}`
}


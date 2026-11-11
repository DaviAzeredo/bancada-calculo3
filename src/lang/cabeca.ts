import { tokeniza } from './lexer'
import { nomeDefinido, parseLinha } from './parser'

/**
 * O cabeçalho de uma função ("f(x,y) =") não se edita: o nome fica e as variáveis saem do
 * corpo. Antes, trocar o cabeçalho à mão levava a combinações que o site não esperava, como
 * f(u, v) sem domínio ou f(x, x).
 */
export type Cabeca = { nome: string; params: string[]; corpo: string }

/** Nomes que já são variável ou constante: x(x, y) = … não é uma função com cabeçalho. */
const NAO_NOME = new Set(['x', 'y', 'z', 'e', 'i'])
const VARIAVEIS = new Set(['x', 'y', 'z', 't', 'u', 'v', 'r', 'theta', 'rho', 'phi'])
/** As coordenadas não viram número com "r = 2": essa linha é o cilindro. */
const COORD = new Set(['x', 'y', 'z', 'r', 'theta', 'rho', 'phi'])
const TEX: Record<string, string> = { theta: '\\theta', rho: '\\rho', phi: '\\varphi' }

const RE = /^\s*([A-Za-z](?:_\{?[A-Za-z0-9]+\}?)?)\s*(?:\\left|\\mleft)?\(([^()=]*?)(?:\\right|\\mright)?\)\s*=(?!=)([\s\S]*)$/

export function separaCabeca(fonte: string): Cabeca | null {
  const c = cabecaSolta(fonte)
  if (!c || !c.params.every((p) => VARIAVEIS.has(p)) || new Set(c.params).size !== c.params.length) return null
  return c
}

/**
 * Cabeçalho escrito à mão, com quaisquer nomes nas variáveis, como g(x, x) ou h(a, b), ou até um
 * número no lugar de uma delas, como f(570, y): o site o refaz com as variáveis do corpo.
 */
export function cabecaSolta(fonte: string): Cabeca | null {
  const m = RE.exec(fonte)
  if (!m) return null
  const nome = m[1].replace(/[{}]/g, '')
  if (NAO_NOME.has(nome)) return null
  let toks
  try {
    toks = tokeniza(m[2])
  } catch {
    return null
  }
  const params: string[] = []
  let esperaId = true
  for (const t of toks) {
    if (t.t === 'fim') break
    if (esperaId && (t.t === 'id' || t.t === 'num')) params.push(t.v)
    else if (esperaId && t.t === 'op' && t.v === '-') continue
    else if (esperaId || t.t !== 'op' || t.v !== ',') return null
    esperaId = !esperaId
  }
  if (!params.length || esperaId) return null
  return { nome, params, corpo: m[3] }
}

export function cabecaTex(nome: string, params: string[]) {
  return `${nome}(${params.map((p) => TEX[p] ?? p).join(',')})=`
}

export const comCabeca = (nome: string, params: string[], corpo: string) => cabecaTex(nome, params) + corpo

export type Contexto = { nomes: string[]; funcoes: Set<string>; numeros: Set<string>; definicoes: Map<string, number> }

/** Nomes definidos nas linhas: um controle "t = 0,8" não é variável da função. */
export function contextoDe(fontes: string[]): Contexto {
  const nomes: string[] = []
  const funcoes = new Set<string>()
  const numeros = new Set<string>()
  const definicoes = new Map<string, number>()
  for (const f of fontes) {
    const d = nomeDefinido(f)
    if (!d) continue
    definicoes.set(d.nome, (definicoes.get(d.nome) ?? 0) + 1)
    if (d.nome.length > 1 && !d.nome.includes('_')) nomes.push(d.nome)
    if (d.funcao) funcoes.add(d.nome)
    else if (!COORD.has(d.nome)) numeros.add(d.nome)
  }
  return { nomes, funcoes, numeros, definicoes }
}

/**
 * As variáveis que o corpo usa, na ordem de costume: (x, y) ou (x, y, z), (u, v) para
 * superfície, (t) para curva, (r, θ) e (r, θ, z), (ρ, θ, φ). Corpo sem variável, ou que ainda
 * não se lê, mantém as de antes.
 */
export function variaveisDe(corpo: string, nome: string, antes: string[], ctx: Contexto): string[] {
  let rhs
  let toks
  try {
    rhs = parseLinha(`${nome}=${corpo}`, ctx).itens[0]?.partes[1]
    toks = tokeniza(corpo, ctx.nomes)
  } catch {
    return antes
  }
  if (!rhs) return antes
  const usa = new Set(toks.flatMap((t) => (t.t === 'id' && VARIAVEIS.has(t.v) && t.v !== nome && !ctx.numeros.has(t.v) ? [t.v] : [])))
  const k = rhs.t === 'tup' ? rhs.a.length : 0
  const tem = (...vs: string[]) => vs.some((v) => usa.has(v))
  if (tem('rho', 'phi') && !tem('x', 'y')) return ['rho', 'theta', 'phi']
  if (tem('r', 'theta') && !tem('x', 'y')) return usa.has('z') ? ['r', 'theta', 'z'] : ['r', 'theta']
  if (tem('x', 'y', 'z')) return k === 3 || (k === 0 && usa.has('z')) ? ['x', 'y', 'z'] : ['x', 'y']
  if (tem('u', 'v')) return ['u', 'v']
  if (usa.has('t')) return ['t']
  // campo constante: o número de componentes diz o espaço
  if (k === 2 || k === 3) return ['x', 'y', 'z'].slice(0, k)
  return antes
}

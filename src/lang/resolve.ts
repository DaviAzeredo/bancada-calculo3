import { type Expr, PI, Q, S, UM, ZERO, avalia, dep, ehZero, expande, fn, livres, neg, pot, prod, quad, raiz, soma, sub, subst, deNumero } from '../math/alg'
import { deriva, gradiente, norma } from '../math/diff'
import { primitiva } from '../math/integra'
import type { Limite } from '../math/quad'
import { tex, texSimbolo } from '../math/tex'
import * as C from './calculos'
import type { Curva, Nums, Resultado, Superficie } from './calculos'
import { ErroSintaxe } from './lexer'
import { type Item, type Linha, type No, nomeDefinido, parseLinha } from './parser'
import { type Regiao, cadeia, coordsDasVariaveis, ordena, posicao, regiaoDeItens } from './regiao'
import { ErroCalculo, type Escopo, type Valor, coordenadasDe, ehVetor, escopoVazio, paraValor } from './valor'

export type Vista = { x: [number, number]; y: [number, number]; z: [number, number] }

export type Desenho =
  | { d: 'grafico'; eixo: 'x' | 'y' | 'z'; f: Expr; restr: Expr[] }
  | { d: 'param'; S: Expr[]; u: Limite; v: Limite; restr: Expr[] }
  | { d: 'implicita'; f: Expr; restr: Expr[] }
  | { d: 'desigualdade'; gs: Expr[] }
  | { d: 'curva'; r: Expr[]; t: Limite }
  | { d: 'campo'; F: Expr[]; dim: 2 | 3 }
  | { d: 'ponto'; p: Expr[]; rotulo?: string }
  | { d: 'seta'; o: Expr[]; v: Expr[]; rotulo?: string; papel?: string }
  | { d: 'solido'; reg: Regiao; topo?: Expr }
  | { d: 'riemann'; reg: Regiao; f: Expr; n: Expr }
  | { d: 'escalar'; f: Expr }
  | { d: 'niveis'; f: Expr }
  | { d: 'sonda'; p: Expr[]; F: Expr[] }

export type TipoLinha = 'vazio' | 'erro' | 'numero' | 'funcao' | 'superficie' | 'curva' | 'campo' | 'ponto' | 'vetor' | 'regiao' | 'escalar' | 'calculo'

export type Analise = {
  id: string
  tipo: TipoLinha
  rotulo: string
  erro?: string
  faltando: string[]
  desenhos: Desenho[]
  nome?: string
  numero?: { valor: number; literal: boolean }
  calcula?: (nums: Nums) => Resultado
}

export type Resolvido = {
  analises: Analise[]
  numeros: Nums
  curvas: Map<string, Curva>
  superficies: Map<string, Superficie>
  regioes: Map<string, Regiao>
  funcoes: Escopo['funcoes']
}

export type Entrada = { id: string; fonte: string }

const COORD = new Set(['x', 'y', 'z', 'r', 'theta', 'rho', 'phi'])
const VIEW_R = (v: Vista) => Math.max(Math.abs(v.x[0]), Math.abs(v.x[1]), Math.abs(v.y[0]), Math.abs(v.y[1]))

function idsDe(n: No, s = new Set<string>()): Set<string> {
  const anda = (x: No | undefined) => x && idsDe(x, s)
  switch (n.t) {
    case 'id': s.add(n.v); break
    case 'neg': anda(n.a); break
    case 'bin': anda(n.a); anda(n.b); break
    case 'fn': n.a.forEach(anda); anda(n.base); break
    case 'call': s.add(n.f); n.a.forEach(anda); break
    case 'tup': n.a.forEach(anda); break
    case 'abs': anda(n.a); break
    case 'dif': anda(n.f); break
    case 'linhaD': anda(n.f); n.args?.forEach(anda); break
    case 'int':
      anda(n.corpo); anda(n.lo); anda(n.hi)
      if (n.sub) s.add(n.sub)
      n.pq?.forEach((p) => anda(p.f))
      break
  }
  return s
}

function idsDaLinha(l: Linha): Set<string> {
  const s = new Set<string>()
  for (const i of [...l.itens, ...l.restr]) i.partes.forEach((p) => idsDe(p, s))
  return s
}

type Def = { nome: string; params: string[]; rhs: No; resto: Item[]; restr: Item[] }

function definicaoDe(l: Linha): Def | null {
  const it = l.itens[0]
  if (l.nome || it.ops.length !== 1 || it.ops[0] !== '=') return null
  const lhs = it.partes[0]
  const resto = l.itens.slice(1)
  if (lhs.t === 'call' && lhs.a.every((a) => a.t === 'id')) return { nome: lhs.f, params: lhs.a.map((a) => (a as { v: string }).v), rhs: it.partes[1], resto, restr: l.restr }
  if (lhs.t === 'id' && !COORD.has(lhs.v)) return { nome: lhs.v, params: [], rhs: it.partes[1], resto, restr: l.restr }
  return null
}

/** g ≤ 0 a partir de cada desigualdade de uma cadeia. */
function restricoes(itens: Item[], esc: Escopo): Expr[] {
  const out: Expr[] = []
  for (const it of itens) {
    for (let i = 0; i < it.ops.length; i++) {
      const a = paraValor(it.partes[i], esc) as Expr
      const b = paraValor(it.partes[i + 1], esc) as Expr
      const op = it.ops[i]
      if (op === '<' || op === '<=') out.push(sub(a, b))
      else if (op === '>' || op === '>=') out.push(sub(b, a))
      else throw new ErroCalculo('Restrição precisa de ≤ ou ≥')
    }
  }
  return out
}

function emCartesianas(e: Expr): Expr {
  const R2 = soma(quad(S('x')), quad(S('y')))
  const rho = raiz(soma(R2, quad(S('z'))))
  return subst(e, { r: raiz(R2), theta: fn('atan2', S('y'), S('x')), rho, phi: fn('acos', prod(S('z'), pot(rho, Q(-1)))) })
}

const usa = (e: Expr, ...vs: string[]) => vs.some((v) => dep(e, v))

const ehLinear = (e: Expr, v: string) => !dep(deriva(e, v), v)

function limiteDe(v: string, itens: Item[], esc: Escopo, padrao: [Expr, Expr]): { lim: Limite; usados: Item[] } {
  for (const it of itens) {
    const c = cadeia(it)
    if (c && c.id === v) return { lim: { v, lo: paraValor(c.lo, esc) as Expr, hi: paraValor(c.hi, esc) as Expr }, usados: [it] }
  }
  return { lim: { v, lo: padrao[0], hi: padrao[1] }, usados: [] }
}

const DOIS_PI = prod(Q(2), PI)

class Analisador {
  esc: Escopo = escopoVazio()
  curvas = new Map<string, Curva>()
  superficies = new Map<string, Superficie>()
  regioes = new Map<string, Regiao>()
  vista: Vista
  ctx: { nomes: string[]; funcoes: Set<string> }
  constructor(vista: Vista, ctx: { nomes: string[]; funcoes: Set<string> }) {
    this.vista = vista
    this.ctx = ctx
  }

  falta(a: Analise, exprs: Expr[], ok: string[]) {
    const permitidos = new Set(ok)
    const s = new Set<string>()
    for (const e of exprs) for (const v of livres(e)) if (!permitidos.has(v) && !this.esc.numeros.has(v)) s.add(v)
    a.faltando = [...s]
  }

  /** Comando que cabe numa linha: `linha(F, C)`, `tangente(f, 1, 2)`… */
  comando(no: Extract<No, { t: 'call' }>, a: Analise) {
    const f = no.f
    const arg = no.a
    const esc = this.esc
    const pede = (n: number, uso: string) => {
      if (arg.length < n) throw new ErroCalculo(`Uso: ${uso}`)
    }
    const nomeFn = (x: No) => {
      if (x.t === 'id' && esc.funcoes.has(x.v)) {
        const d = esc.funcoes.get(x.v)!
        return { nome: x.v, ...d }
      }
      const v = paraValor(x, esc)
      return { nome: 'f', params: coordenadasDe(v), corpo: v }
    }
    const esca = (x: No) => paraValor(x, esc) as Expr
    const campo = (x: No): Expr[] => {
      const d = x.t === 'id' ? esc.funcoes.get(x.v) : undefined
      const v = d ? d.corpo : paraValor(x, esc)
      if (!ehVetor(v)) throw new ErroCalculo('Este comando pede um campo vetorial')
      return v
    }
    const curva = (x: No): Curva => {
      const c = x.t === 'id' ? this.curvas.get(x.v) : undefined
      if (!c) throw new ErroCalculo('Este comando pede o nome de uma curva')
      return c
    }
    const sup = (x: No): Superficie => {
      const s = x.t === 'id' ? this.superficies.get(x.v) : undefined
      if (!s) throw new ErroCalculo('Este comando pede o nome de uma superfície')
      return s
    }
    const regiao = (x: No, dim?: number): Regiao => {
      const r = x.t === 'id' ? this.regioes.get(x.v) : undefined
      if (!r) throw new ErroCalculo('Este comando pede o nome de uma região, como R: 0≤x≤1, 0≤y≤x')
      if (dim && r.lim.length !== dim) throw new ErroCalculo(`Aqui a região precisa ter ${dim} variáveis`)
      return r
    }
    a.tipo = 'calculo'
    switch (f) {
      case 'grad': case 'gradiente': case 'div': case 'divergente': case 'rot': case 'rotacional': case 'curl': case 'lap': case 'laplaciano': {
        const v = paraValor(no, esc)
        const op = f.startsWith('grad') ? '\\nabla f' : f.startsWith('div') ? '\\nabla\\cdot\\mathbf{F}' : f === 'lap' || f === 'laplaciano' ? '\\nabla^{2} f' : '\\nabla\\times\\mathbf{F}'
        a.rotulo = f.startsWith('grad') ? 'Gradiente' : f.startsWith('div') ? 'Divergente' : f === 'lap' || f === 'laplaciano' ? 'Laplaciano' : 'Rotacional'
        if (ehVetor(v)) {
          const dim = v.length === 2 ? 2 : 3
          a.desenhos.push({ d: 'campo', F: [v[0], v[1], v[2] ?? ZERO], dim })
          this.falta(a, v, ['x', 'y', 'z'])
        } else this.falta(a, [v], ['x', 'y', 'z'])
        a.calcula = (n) => C.resultadoGradiente(a.rotulo, op, ehVetor(v) ? v.map((c) => C.fixa(c, n)) : C.fixa(v, n))
        return
      }
      case 'tangente': {
        pede(3, 'tangente(f, a, b) ou tangente(g, a, b, c)')
        const d = nomeFn(arg[0])
        if (ehVetor(d.corpo)) throw new ErroCalculo('O plano tangente pede uma função escalar')
        const corpo = d.corpo
        const pts = arg.slice(1).map(esca)
        a.rotulo = 'Plano tangente'
        if (d.params.length === 2) {
          const m = { [d.params[0]]: pts[0], [d.params[1]]: pts[1] }
          const f0 = subst(corpo, m)
          const [fx, fy] = gradiente(corpo, d.params).map((c) => subst(c, m))
          const [x, y] = d.params.map(S)
          const plano = soma(f0, prod(fx, sub(x, pts[0])), prod(fy, sub(y, pts[1])))
          const R = VIEW_R(this.vista) * 0.5
          a.desenhos.push(
            { d: 'grafico', eixo: 'z', f: plano, restr: [sub(soma(quad(sub(x, pts[0])), quad(sub(y, pts[1]))), deNumero(R * R))] },
            { d: 'ponto', p: [pts[0], pts[1], f0] },
            { d: 'seta', o: [pts[0], pts[1], f0], v: [neg(fx), neg(fy), UM], papel: 'normal', rotulo: 'n' },
          )
          this.falta(a, [corpo, ...pts], d.params)
        } else {
          pede(4, 'tangente(g, a, b, c)')
          const m = { x: pts[0], y: pts[1], z: pts[2] }
          const g = gradiente(corpo, ['x', 'y', 'z']).map((c) => subst(c, m))
          const e = soma(...['x', 'y', 'z'].map((v, i) => prod(g[i], sub(S(v), pts[i]))))
          const R = VIEW_R(this.vista) * 0.5
          a.desenhos.push(
            { d: 'implicita', f: e, restr: [sub(soma(...['x', 'y', 'z'].map((v, i) => quad(sub(S(v), pts[i])))), deNumero(R * R))] },
            { d: 'ponto', p: pts },
            { d: 'seta', o: pts, v: g, papel: 'normal', rotulo: '∇g' },
          )
          this.falta(a, [corpo, ...pts], ['x', 'y', 'z'])
        }
        a.calcula = (n) => C.resultadoTangente(corpo, d.params, pts, n, d.nome)
        return
      }
      case 'direcional': {
        pede(3, 'direcional(f, (a, b), (u₁, u₂))')
        const d = nomeFn(arg[0])
        const P = paraValor(arg[1], esc)
        const u = paraValor(arg[2], esc)
        if (!ehVetor(P) || !ehVetor(u) || ehVetor(d.corpo)) throw new ErroCalculo('Uso: direcional(f, (a, b), (u₁, u₂))')
        const corpo = d.corpo
        a.rotulo = 'Derivada direcional'
        if (d.params.length === 2) {
          const m = { [d.params[0]]: P[0], [d.params[1]]: P[1] }
          a.desenhos.push({ d: 'ponto', p: [P[0], P[1], subst(corpo, m)] }, { d: 'seta', o: [P[0], P[1], subst(corpo, m)], v: [u[0], u[1], ZERO], rotulo: 'u' })
        }
        this.falta(a, [corpo, ...P, ...u], d.params)
        a.calcula = (n) => C.direcional(corpo, d.params, P, u, n, d.nome)
        return
      }
      case 'criticos': {
        pede(1, 'criticos(f)')
        const d = nomeFn(arg[0])
        if (ehVetor(d.corpo)) throw new ErroCalculo('Pontos críticos pedem uma função escalar')
        const corpo = d.corpo
        const caixa = (['x', 'y', 'z'] as const).slice(0, d.params.length).map((k) => this.vista[k])
        a.rotulo = 'Pontos críticos'
        this.falta(a, [corpo], d.params)
        a.calcula = (n) => C.pontosCriticos(corpo, d.params, caixa, n, d.nome)
        return
      }
      case 'lagrange': {
        pede(2, 'lagrange(f, g), com g = 0 como restrição')
        const [p, q] = [nomeFn(arg[0]), nomeFn(arg[1])]
        if (ehVetor(p.corpo) || ehVetor(q.corpo)) throw new ErroCalculo('Lagrange pede funções escalares')
        const [fa, fb] = [p.corpo, q.corpo]
        const vars = p.params.length >= q.params.length ? p.params : q.params
        const caixa = (['x', 'y', 'z'] as const).slice(0, vars.length).map((k) => this.vista[k])
        a.rotulo = 'Multiplicadores de Lagrange'
        this.falta(a, [fa, fb], vars)
        a.calcula = (n) => C.lagrange(fa, fb, vars, caixa, n, [p.nome, q.nome])
        return
      }
      case 'taylor': {
        pede(3, 'taylor(f, a, b)')
        const d = nomeFn(arg[0])
        if (ehVetor(d.corpo) || d.params.length !== 2) throw new ErroCalculo('Taylor pede f(x, y)')
        const corpo = d.corpo
        const pts = [esca(arg[1]), esca(arg[2])]
        a.rotulo = 'Polinômio de Taylor de ordem 2'
        const m = { [d.params[0]]: pts[0], [d.params[1]]: pts[1] }
        const { P } = C.taylor2(subst(corpo, Object.fromEntries(d.params.map((v, i) => [v, S(['x', 'y'][i])]))), pts, {})
        a.desenhos.push({ d: 'grafico', eixo: 'z', f: P, restr: [] }, { d: 'ponto', p: [pts[0], pts[1], subst(corpo, m)] })
        this.falta(a, [corpo, ...pts], d.params)
        a.calcula = (n) => {
          const t = C.taylor2(subst(corpo, Object.fromEntries(d.params.map((v, i) => [v, S(['x', 'y'][i])]))), pts, n)
          return { rotulo: a.rotulo, formula: 'P_{2}(x,y)', exato: tex(expande(t.P)), selo: 'simbolico', passos: t.passos }
        }
        return
      }
      case 'potencial': {
        pede(1, 'potencial(F)')
        const F = campo(arg[0])
        a.rotulo = 'Função potencial'
        this.falta(a, F, ['x', 'y', 'z'])
        a.calcula = (n) => C.potencial(F, n)
        return
      }
      case 'hessiana': {
        pede(1, 'hessiana(f)')
        const d = nomeFn(arg[0])
        if (ehVetor(d.corpo)) throw new ErroCalculo('A hessiana pede uma função escalar')
        const corpo = d.corpo
        a.rotulo = 'Matriz hessiana'
        this.falta(a, [corpo], d.params)
        a.calcula = (n) => {
          const g = C.fixa(corpo, n)
          const H = d.params.map((p) => d.params.map((q) => deriva(deriva(g, p), q)))
          return { rotulo: a.rotulo, formula: `H_{${d.nome}}`, exato: `\\begin{pmatrix}${H.map((l) => l.map(tex).join(' & ')).join(' \\\\ ')}\\end{pmatrix}`, selo: 'simbolico', passos: [] }
        }
        return
      }
      case 'comprimento': {
        pede(1, 'comprimento(C)')
        const c = curva(arg[0])
        a.rotulo = 'Comprimento de arco'
        a.calcula = (n) => C.comprimento(c, n)
        return
      }
      case 'curvatura': case 'torcao': {
        pede(1, `${f}(C) ou ${f}(C, t₀)`)
        const c = curva(arg[0])
        const t0 = arg[1] ? esca(arg[1]) : null
        a.rotulo = f === 'curvatura' ? 'Curvatura' : 'Torção'
        if (t0) a.desenhos.push({ d: 'ponto', p: c.r.map((x) => subst(x, { [c.t.v]: t0 })) })
        a.calcula = (n) => (f === 'curvatura' ? C.curvatura(c, t0, n) : C.torcao(c, t0, n))
        return
      }
      case 'frenet': {
        pede(2, 'frenet(C, t₀)')
        const c = curva(arg[0])
        const t0 = esca(arg[1])
        const v = c.t.v
        const r3 = c.r.length === 2 ? [...c.r, ZERO] : c.r
        const d1 = r3.map((x) => deriva(x, v))
        const d2 = d1.map((x) => deriva(x, v))
        const m = { [v]: t0 }
        const r0 = r3.map((x) => subst(x, m))
        const [a1, a2] = [d1.map((x) => subst(x, m)), d2.map((x) => subst(x, m))]
        const T = a1.map((x) => prod(x, pot(norma(a1), Q(-1))))
        const dot = soma(...a1.map((x, i) => prod(x, a2[i])))
        const nn = a2.map((x, i) => sub(prod(x, soma(...a1.map(quad))), prod(a1[i], dot)))
        const N = nn.map((x) => prod(x, pot(norma(nn), Q(-1))))
        const B = [sub(prod(T[1], N[2]), prod(T[2], N[1])), sub(prod(T[2], N[0]), prod(T[0], N[2])), sub(prod(T[0], N[1]), prod(T[1], N[0]))]
        a.rotulo = 'Triedro de Frenet'
        a.desenhos.push(
          { d: 'ponto', p: r0 },
          { d: 'seta', o: r0, v: T, rotulo: 'T', papel: 'T' },
          { d: 'seta', o: r0, v: N, rotulo: 'N', papel: 'N' },
          { d: 'seta', o: r0, v: B, rotulo: 'B', papel: 'B' },
        )
        a.calcula = (n) => ({ rotulo: a.rotulo, formula: `\\mathbf{T},\\ \\mathbf{N},\\ \\mathbf{B}\\ \\text{em}\\ ${texSimbolo(v)} = ${tex(C.fixa(t0, n))}`, selo: 'numerico', exato: `\\mathbf{T} \\approx ${texNumVet(T, n)}`, passos: [{ titulo: 'Normal', tex: `\\mathbf{N} \\approx ${texNumVet(N, n)}` }, { titulo: 'Binormal', tex: `\\mathbf{B} \\approx ${texNumVet(B, n)}` }] })
        return
      }
      case 'area': {
        pede(1, 'area(S) ou area(R)')
        const nome = arg[0].t === 'id' ? arg[0].v : ''
        a.rotulo = 'Área'
        if (this.superficies.has(nome)) {
          const s = this.superficies.get(nome)!
          a.calcula = (n) => C.integralEscalarDeSuperficie(UM, s, n, 'Área de superfície', `A = \\iint_{${texSimbolo(nome)}} dS`)
          return
        }
        const r = regiao(arg[0], 2)
        a.desenhos.push({ d: 'solido', reg: r })
        a.calcula = (n) => C.integralEmRegiao(UM, r, n, 'Área', 'A')
        return
      }
      case 'volume': {
        pede(1, 'volume(E)')
        const r = regiao(arg[0], 3)
        a.rotulo = 'Volume'
        a.desenhos.push({ d: 'solido', reg: r })
        a.calcula = (n) => C.integralEmRegiao(UM, r, n, 'Volume', 'V')
        return
      }
      case 'massa': {
        pede(2, 'massa(E, δ)')
        const r = regiao(arg[0])
        const d = esca(arg[1])
        a.rotulo = 'Massa'
        a.desenhos.push({ d: 'solido', reg: r })
        this.falta(a, [d], ['x', 'y', 'z'])
        a.calcula = (n) => C.integralEmRegiao(d, r, n, 'Massa', r.lim.length === 3 ? 'V' : 'A')
        return
      }
      case 'centroide': {
        pede(1, 'centroide(E) ou centroide(E, δ)')
        const r = regiao(arg[0])
        const d = arg[1] ? esca(arg[1]) : UM
        a.rotulo = 'Centro de massa'
        a.desenhos.push({ d: 'solido', reg: r })
        this.falta(a, [d], ['x', 'y', 'z'])
        a.calcula = (n) => {
          const dV = r.lim.length === 3 ? 'V' : 'A'
          const M = C.integralEmRegiao(d, r, n, 'Massa', dV)
          const eixos = ['x', 'y', 'z'].slice(0, r.lim.length)
          const coords = eixos.map((e) => (C.integralEmRegiao(prod(S(e), d), r, n, e, dV).valor ?? NaN) / (M.valor ?? NaN))
          return { rotulo: a.rotulo, formula: `\\bar{x} = \\frac{1}{M}\\iint x\\,\\delta\\,d${dV}`, exato: `\\left(${coords.map(C.texDecimal).join(',\\ ')}\\right)`, selo: M.selo === 'exato' ? 'exato' : 'numerico', passos: [{ titulo: 'Massa', tex: `M = ${M.exato ?? C.texDecimal(M.valor ?? NaN)}` }], pontos: [{ p: [coords[0], coords[1], coords[2] ?? 0], rotulo: 'centro de massa' }] }
        }
        return
      }
      case 'linha': {
        pede(2, 'linha(F, C)')
        const F = campo(arg[0])
        const c = curva(arg[1])
        a.rotulo = 'Integral de linha'
        this.falta(a, F, ['x', 'y', 'z'])
        a.calcula = (n) => C.integralDeLinha(F, c, n, false)
        return
      }
      case 'fluxo': {
        pede(2, 'fluxo(F, S)')
        const F = campo(arg[0])
        const s = sup(arg[1])
        a.rotulo = 'Fluxo'
        this.falta(a, F, ['x', 'y', 'z'])
        a.calcula = (n) => C.fluxoPorSuperficie(F, s, n)
        return
      }
      case 'green': {
        pede(2, 'green(F, R)')
        const F = campo(arg[0])
        const r = regiao(arg[1], 2)
        if (F.length !== 2 && !(F.length === 3 && ehZero(F[2]))) throw new ErroCalculo('Green pede um campo plano (P, Q)')
        a.rotulo = 'Teorema de Green'
        a.desenhos.push({ d: 'solido', reg: r })
        this.falta(a, F, ['x', 'y'])
        a.calcula = (n) => C.teoremaGreen(F.slice(0, 2), r, n)
        return
      }
      case 'stokes': {
        pede(2, 'stokes(F, S)')
        const F = campo(arg[0])
        const s = sup(arg[1])
        a.rotulo = 'Teorema de Stokes'
        this.falta(a, F, ['x', 'y', 'z'])
        a.calcula = (n) => C.teoremaStokes(F, s, n)
        return
      }
      case 'gauss': {
        pede(2, 'gauss(F, E)')
        const F = campo(arg[0])
        const r = regiao(arg[1], 3)
        a.rotulo = 'Teorema da divergência'
        a.desenhos.push({ d: 'solido', reg: r })
        this.falta(a, F, ['x', 'y', 'z'])
        a.calcula = (n) => C.teoremaGauss(F, r, n)
        return
      }
      case 'jacobiano': {
        pede(3, 'jacobiano((u cos v, u sen v), u, v)')
        const T = paraValor(arg[0], esc)
        const vars = arg.slice(1).map((x) => (x.t === 'id' ? x.v : ''))
        if (!ehVetor(T) || T.length !== vars.length) throw new ErroCalculo('Dê tantas funções quantas variáveis')
        a.rotulo = 'Jacobiano'
        a.calcula = () => C.resultadoJacobiano(T, vars)
        return
      }
      case 'riemann': {
        pede(3, 'riemann(f, R, n)')
        const d = nomeFn(arg[0])
        const r = regiao(arg[1], 2)
        const nCel = esca(arg[2])
        if (ehVetor(d.corpo)) throw new ErroCalculo('A soma de Riemann pede função escalar')
        const corpo = d.corpo
        a.rotulo = 'Soma de Riemann'
        a.desenhos.push({ d: 'riemann', reg: r, f: corpo, n: nCel })
        a.calcula = (n) => C.somaRiemann(corpo, r, nCel, n)
        return
      }
      case 'sonda': {
        pede(4, 'sonda(F, a, b, c)')
        const F = campo(arg[0])
        const p = arg.slice(1).map(esca)
        a.rotulo = 'Sonda de campo'
        a.desenhos.push({ d: 'sonda', p, F }, { d: 'ponto', p })
        a.calcula = (n) => C.resultadoSonda(F, p, n)
        return
      }
      case 'fatia': {
        pede(2, 'fatia(E, c)')
        const r = regiao(arg[0])
        const c = esca(arg[1])
        const [u, v, w] = r.lim
        const m = { [u.v]: c }
        const T = posicao(r.coords, r.lim.length).map((e) => subst(e, m))
        const fixo = (l: Limite): Limite => ({ v: l.v, lo: subst(l.lo, m), hi: subst(l.hi, m) })
        a.rotulo = 'Fatia da região'
        if (w) a.desenhos.push({ d: 'param', S: T, u: fixo(v), v: fixo(w), restr: [] })
        else a.desenhos.push({ d: 'curva', r: T, t: fixo(v) })
        a.calcula = (n) => C.resultadoFatia(r, c, n)
        return
      }
      case 'curvas': {
        pede(1, 'curvas(f)')
        const d = nomeFn(arg[0])
        if (ehVetor(d.corpo)) throw new ErroCalculo('Curvas de nível pedem uma função escalar')
        a.rotulo = 'Curvas de nível'
        a.tipo = 'funcao'
        a.desenhos.push({ d: 'niveis', f: d.corpo })
        return
      }
    }
    throw new ErroCalculo(`Comando desconhecido: ${f}`)
  }

  /**
   * ∫_A F·dr + ∫_B F·dr, 2∫… − ∫…: contornos por pedaços, como a borda de um triângulo.
   * Cada parcela é uma integral inteira, e os coeficientes não podem conter integral.
   */
  somaDeIntegrais(no: No, a: Analise) {
    const termos: { c: Expr; int: Extract<No, { t: 'int' }> }[] = []
    let constante: Expr = ZERO
    const anda = (n: No, c: Expr) => {
      if (n.t === 'int') termos.push({ c, int: n })
      else if (n.t === 'neg') anda(n.a, neg(c))
      else if (n.t === 'bin' && (n.op === '+' || n.op === '-')) {
        anda(n.a, c)
        anda(n.b, n.op === '-' ? neg(c) : c)
      } else if (n.t === 'bin' && (n.op === '*' || n.op === '·') && temIntegral(n.a) !== temIntegral(n.b)) {
        const [k, resto] = temIntegral(n.a) ? [n.b, n.a] : [n.a, n.b]
        anda(resto, prod(c, this.coeficiente(k)))
      } else if (n.t === 'bin' && n.op === '/' && !temIntegral(n.b)) anda(n.a, prod(c, pot(this.coeficiente(n.b), Q(-1))))
      else if (!temIntegral(n)) constante = soma(constante, prod(c, this.coeficiente(n)))
      else throw new ErroCalculo('Integral sobre curva, superfície ou região só entra em somas e múltiplos, como ∫_A F·dr + ∫_B F·dr')
    }
    anda(no, UM)
    const partes = termos.map(({ c, int }) => {
      const sub0: Analise = { id: a.id, tipo: 'vazio', rotulo: '', faltando: [], desenhos: [] }
      this.integral(int, sub0)
      if (!sub0.calcula) throw new ErroCalculo('Uma parcela não é uma integral que eu saiba calcular')
      return { c, sub: sub0 }
    })
    a.tipo = 'calculo'
    a.rotulo = 'Soma de integrais'
    a.desenhos = partes.flatMap((p) => p.sub.desenhos)
    a.faltando = [...new Set([...partes.flatMap((p) => p.sub.faltando), ...[...livres(constante)].filter((v) => !this.esc.numeros.has(v))])]
    a.calcula = (n) => {
      const rs = partes.map(({ c, sub: s }) => {
        const r = s.calcula!(n)
        return { c, r, formula: r.formula }
      })
      const total = C.combinaResultados(rs, n)
      if (ehZero(constante)) return total
      const k = C.fixa(constante, n)
      const valor = (total.valor ?? NaN) + avalia(k, n)
      const e = total.expr ? soma(total.expr, k) : undefined
      return { ...total, formula: `${total.formula} + ${tex(k)}`, exato: e ? tex(e) : total.exato, expr: e, valor }
    }
  }

  /** Coeficiente de uma parcela: número ou controle deslizante, nunca variável de integração. */
  coeficiente(n: No): Expr {
    const v = paraValor(n, this.esc)
    if (ehVetor(v)) throw new ErroCalculo('O coeficiente de uma integral precisa ser um número')
    const soltas = [...livres(v)].filter((s) => !this.esc.numeros.has(s))
    if (soltas.length) throw new ErroCalculo(`O coeficiente não pode depender de ${soltas.join(', ')}`)
    return v
  }

  integral(no: Extract<No, { t: 'int' }>, a: Analise) {
    const esc = this.esc
    a.tipo = 'calculo'
    if (no.sub) {
      const nome = no.sub
      const d0 = no.ds[0]
      if (no.n === 1) {
        const c = this.curvas.get(nome)
        if (!c) throw new ErroCalculo(`${nome} não é uma curva definida`)
        if (no.pq) {
          const F = ['x', 'y', 'z'].map((v) => {
            const p = no.pq!.find((q) => q.var === v)
            return p ? (paraValor(p.f, esc) as Expr) : ZERO
          })
          a.rotulo = 'Integral de linha'
          this.falta(a, F, ['x', 'y', 'z'])
          a.calcula = (n) => C.integralDeLinha(F, c, n, no.fechada)
          return
        }
        const v = paraValor(no.corpo, esc)
        if (d0 === 'r' || ehVetor(v)) {
          if (!ehVetor(v)) throw new ErroCalculo('F·dr pede um campo vetorial')
          a.rotulo = 'Integral de linha'
          this.falta(a, v, ['x', 'y', 'z'])
          a.calcula = (n) => C.integralDeLinha(v, c, n, no.fechada)
        } else {
          a.rotulo = 'Integral de linha escalar'
          this.falta(a, [v], ['x', 'y', 'z'])
          a.calcula = (n) => C.integralEscalarDeLinha(v, c, n)
        }
        return
      }
      const s = this.superficies.get(nome)
      if (no.n === 2 && s) {
        const v = paraValor(no.corpo, esc)
        if (ehVetor(v)) {
          a.rotulo = 'Fluxo'
          this.falta(a, v, ['x', 'y', 'z'])
          a.calcula = (n) => C.fluxoPorSuperficie(v, s, n)
        } else {
          a.rotulo = 'Integral de superfície'
          this.falta(a, [v], ['x', 'y', 'z'])
          a.calcula = (n) => C.integralEscalarDeSuperficie(v, s, n)
        }
        return
      }
      const r = this.regioes.get(nome)
      if (!r) throw new ErroCalculo(`${nome} não é uma região ou superfície definida`)
      if (r.lim.length !== no.n) throw new ErroCalculo(`${nome} tem ${r.lim.length} variáveis, e a integral tem ${no.n}`)
      const f = paraValor(no.corpo, esc)
      if (ehVetor(f)) throw new ErroCalculo('Aqui o integrando é um número')
      a.rotulo = no.n === 2 ? 'Integral dupla' : 'Integral tripla'
      this.falta(a, [f], ['x', 'y', 'z'])
      a.desenhos.push(no.n === 2 && r.coords !== 'cart' ? { d: 'solido', reg: r } : { d: 'solido', reg: r, topo: no.n === 2 ? f : undefined })
      a.calcula = (n) => C.integralEmRegiao(f, r, n, a.rotulo, no.n === 2 ? 'A' : 'V')
      return
    }
    // limites escritos na própria integral: desce pelas integrais aninhadas
    const lim: Limite[] = []
    let atual: No = no
    let indefinida = false
    while (atual.t === 'int') {
      if (atual.n !== 1 || atual.ds.length !== 1) throw new ErroCalculo('Com ∬ ou ∭ use uma região com nome: ∬_R f dA')
      const v: string = atual.ds[0]
      if (!!atual.lo !== !!atual.hi) throw new ErroCalculo('A integral precisa dos dois limites, ou de nenhum')
      if (!atual.lo || !atual.hi) {
        indefinida = true
        lim.push({ v, lo: ZERO, hi: ZERO })
      } else lim.push({ v, lo: paraValor(atual.lo, esc) as Expr, hi: paraValor(atual.hi, esc) as Expr })
      atual = atual.corpo
    }
    const f = paraValor(atual, esc)
    if (ehVetor(f)) throw new ErroCalculo('O integrando precisa ser escalar')
    this.falta(a, [f, ...lim.flatMap((l) => [l.lo, l.hi])], ['x', 'y', 'z', 'r', 'theta', 'rho', 'phi', ...lim.map((l) => l.v)])
    if (indefinida) {
      if (lim.length !== 1) throw new ErroCalculo('Só integrais simples podem ficar sem limites')
      const v = lim[0].v
      a.rotulo = 'Primitiva'
      a.calcula = (n) => {
        const g = C.fixa(f, n)
        const p = primitiva(g, v)
        const s = texSimbolo(v)
        if (!p) return { rotulo: 'Primitiva', formula: `\\int ${tex(g)}\\,d${s}`, selo: 'falhou', aviso: 'Não achei primitiva fechada com estas regras.', passos: [] }
        return { rotulo: 'Primitiva', formula: `\\int ${tex(g)}\\,d${s}`, exato: `${tex(p.F)} + C`, selo: 'simbolico', passos: p.regras.length ? [{ titulo: 'Regra usada', nota: `${p.regras.join(', ')}.` }] : [] }
      }
      return
    }
    // o limite de dentro pode citar a variável de fora: a ordem escrita já é de fora para dentro
    const ordem = lim
    a.rotulo = ordem.length === 1 ? 'Integral' : ordem.length === 2 ? 'Integral dupla' : 'Integral tripla'
    const coords = ordem.length >= 2 ? coordsDasVariaveis(ordem.map((l) => l.v)) : null
    if (coords) {
      const r: Regiao = { coords, lim: ordena(ordem) }
      a.desenhos.push({ d: 'solido', reg: r, topo: coords === 'cart' && ordem.length === 2 ? f : undefined })
    }
    a.calcula = (n) => C.integralIterada(f, ordem, n)
  }

  /** Superfície ou curva dada por função: decide o desenho e guarda o nome para as integrais. */
  definicao(d: Def, a: Analise) {
    const esc = this.esc
    const sombra = d.params.map((p) => [p, esc.funcoes.get(p)] as const)
    d.params.forEach((p) => esc.funcoes.delete(p))
    const corpo = paraValor(d.rhs, esc)
    sombra.forEach(([p, f]) => f && esc.funcoes.set(p, f))
    a.nome = d.nome
    const itens = [...d.resto, ...d.restr]

    if (!d.params.length) {
      const fontes = ehVetor(corpo) ? corpo : [corpo]
      const soltos = new Set(fontes.flatMap((e) => [...livres(e)]).filter((v) => !esc.numeros.has(v)))
      if (soltos.size === 0) {
        if (ehVetor(corpo)) {
          esc.funcoes.set(d.nome, { params: [], corpo })
          const c = corpo.length === 2 ? [...corpo, ZERO] : corpo
          if (/^[A-Z]/.test(d.nome)) {
            a.tipo = 'ponto'
            a.rotulo = 'Ponto'
            a.desenhos.push({ d: 'ponto', p: c, rotulo: d.nome })
          } else {
            a.tipo = 'vetor'
            a.rotulo = 'Vetor'
            a.desenhos.push({ d: 'seta', o: [ZERO, ZERO, ZERO], v: c, rotulo: d.nome })
          }
          return
        }
        const nums = Object.fromEntries(esc.numeros)
        const valor = avalia(corpo, nums)
        esc.numeros.set(d.nome, valor)
        a.tipo = 'numero'
        a.rotulo = 'Número'
        a.numero = { valor, literal: d.rhs.t === 'num' || (d.rhs.t === 'neg' && d.rhs.a.t === 'num') }
        return
      }
      // sem parâmetros declarados, as variáveis livres fazem esse papel
      const coords = coordenadasDe(corpo)
      const vs = [...soltos]
      const params = vs.every((v) => coords.includes(v) || COORD.has(v)) ? (ehVetor(corpo) ? ['x', 'y', 'z'].slice(0, corpo.length) : coords) : vs.sort()
      d = { ...d, params }
    }

    esc.funcoes.set(d.nome, { params: d.params, corpo })
    this.desenhaFuncao(d, corpo, itens, a)
  }

  desenhaFuncao(d: Pick<Def, 'nome' | 'params'>, corpo: Valor, itens: Item[], a: Analise) {
    const esc = this.esc
    const { nome, params } = d
    const dims = params.length
    const padrao = (p: string): [Expr, Expr] => (['x', 'y', 'z'].includes(p) ? [deNumero(this.vista.x[0]), deNumero(this.vista.x[1])] : p === 'phi' ? [ZERO, PI] : [ZERO, DOIS_PI])
    if (ehVetor(corpo)) {
      if (dims === 1) {
        const r = corpo.length === 2 ? [...corpo, ZERO] : corpo
        if (r.length !== 3) throw new ErroCalculo('Uma curva precisa de 2 ou 3 componentes')
        const reta = r.every((c) => ehLinear(c, params[0]))
        const { lim } = limiteDe(params[0], itens, esc, reta ? [deNumero(this.vista.x[0] * 2), deNumero(this.vista.x[1] * 2)] : padrao(params[0]))
        a.tipo = 'curva'
        a.rotulo = reta ? 'Reta' : 'Curva paramétrica'
        a.desenhos.push({ d: 'curva', r, t: lim })
        this.curvas.set(nome, { r, t: lim, nome })
        this.falta(a, [...r, lim.lo, lim.hi], params)
        return
      }
      if (dims === 2 && corpo.length === 3) {
        const lu = limiteDe(params[0], itens, esc, padrao(params[0]))
        const lv = limiteDe(params[1], itens, esc, padrao(params[1]))
        const resto = itens.filter((i) => !lu.usados.includes(i) && !lv.usados.includes(i))
        a.tipo = 'superficie'
        a.rotulo = 'Superfície paramétrica'
        a.desenhos.push({ d: 'param', S: corpo, u: lu.lim, v: lv.lim, restr: restricoes(resto, esc) })
        this.superficies.set(nome, { S: corpo, u: lu.lim, v: lv.lim, nome })
        this.falta(a, [...corpo, lu.lim.lo, lu.lim.hi, lv.lim.lo, lv.lim.hi], params)
        return
      }
      if ((dims === 2 || dims === 3) && corpo.length === dims) {
        a.tipo = 'campo'
        a.rotulo = dims === 2 ? 'Campo vetorial no plano' : 'Campo vetorial'
        a.desenhos.push({ d: 'campo', F: [corpo[0], corpo[1], corpo[2] ?? ZERO], dim: dims as 2 | 3 })
        this.falta(a, corpo, params)
        return
      }
      throw new ErroCalculo('Número de componentes incompatível com as variáveis')
    }
    if (dims === 1) {
      const { lim } = limiteDe(params[0], itens, esc, [deNumero(this.vista.x[0]), deNumero(this.vista.x[1])])
      const v = S(params[0])
      const r = [v, corpo, ZERO]
      a.tipo = 'curva'
      a.rotulo = 'Gráfico no plano xy'
      a.desenhos.push({ d: 'curva', r, t: lim })
      this.curvas.set(nome, { r, t: lim, nome })
      this.falta(a, [corpo, lim.lo, lim.hi], params)
      return
    }
    if (dims === 2) {
      const [p, q] = params
      const m = { [p]: S('x'), [q]: S('y') }
      a.tipo = 'funcao'
      a.rotulo = `Gráfico de ${nome}`
      const f = subst(corpo, m)
      const restr = restricoes(itens, esc)
      a.desenhos.push({ d: 'grafico', eixo: 'z', f, restr })
      this.falta(a, [f], ['x', 'y'])
      return
    }
    if (dims === 3) {
      a.tipo = 'escalar'
      a.rotulo = 'Campo escalar'
      const m = { [params[0]]: S('x'), [params[1]]: S('y'), [params[2]]: S('z') }
      const f = subst(corpo, m)
      a.desenhos.push({ d: 'escalar', f })
      this.falta(a, [f], ['x', 'y', 'z'])
      return
    }
    throw new ErroCalculo('Função com variáveis demais')
  }

  /** z = …, x² + y² = 1, r = 2, ρ = 1… */
  equacao(it: Item, outros: Item[], a: Analise, nome?: string) {
    const esc = this.esc
    const [ln, rn] = it.partes
    const lhs = paraValor(ln, esc)
    const rhs = paraValor(rn, esc)
    if (ehVetor(lhs) || ehVetor(rhs)) throw new ErroCalculo('Equação entre vetores: separe por componente')
    const id = ln.t === 'id' ? ln.v : null
    a.tipo = 'superficie'
    const R = VIEW_R(this.vista)
    const zLo = deNumero(this.vista.z[0])
    const zHi = deNumero(this.vista.z[1])
    if (id && ['x', 'y', 'z'].includes(id) && !dep(rhs, id)) {
      if (usa(rhs, 'r', 'theta') && id === 'z') {
        const lr = limiteDe('r', outros, esc, [ZERO, deNumero(R * 1.45)])
        const lt = limiteDe('theta', outros, esc, [ZERO, DOIS_PI])
        const Sx = [prod(S('r'), fn('cos', S('theta'))), prod(S('r'), fn('sin', S('theta'))), rhs]
        a.rotulo = 'Superfície em coordenadas cilíndricas'
        a.desenhos.push({ d: 'param', S: Sx, u: lr.lim, v: lt.lim, restr: [] })
        if (nome) this.superficies.set(nome, { S: Sx, u: lr.lim, v: lt.lim, nome })
        this.falta(a, [rhs], ['r', 'theta'])
        return
      }
      const vars = ['x', 'y', 'z'].filter((v) => v !== id)
      if (nome) {
        // S: z = f(x, y), com a região em x, y ou em r, θ: parametriza pelo domínio
        const reg = regiaoDeItens(outros, esc)
        if (!reg || reg.lim.length !== 2) throw new ErroCalculo('Dê a região da superfície, como 0≤x≤1, 0≤y≤2 ou 0≤r≤1, 0≤θ≤2π')
        const [px, py] = posicao(reg.coords, 2)
        const m = { [vars[0]]: px, [vars[1]]: py }
        const alt = subst(rhs, m)
        const Sx = id === 'z' ? [px, py, alt] : id === 'y' ? [px, alt, py] : [alt, px, py]
        const [u, v] = reg.lim
        a.rotulo = 'Superfície'
        a.desenhos.push({ d: 'param', S: Sx, u, v, restr: [] })
        // z = f(x,y): com (x, y) nesta ordem, o normal aponta para cima
        const invertido = reg.lim[0].v !== 'x' && reg.lim[0].v !== 'r'
        this.superficies.set(nome, { S: Sx, u: invertido ? v : u, v: invertido ? u : v, nome })
        this.falta(a, [rhs], vars)
        return
      }
      a.rotulo = `Gráfico ${id} = f(${vars.join(', ')})`
      a.desenhos.push({ d: 'grafico', eixo: id as 'x' | 'y' | 'z', f: rhs, restr: restricoes(outros, esc) })
      this.falta(a, [rhs], vars)
      return
    }
    if (id === 'r' && !usa(rhs, 'r', 'rho', 'phi')) {
      const lt = limiteDe('theta', outros, esc, [ZERO, DOIS_PI])
      const lz = limiteDe('z', outros, esc, [zLo, zHi])
      const [t, z] = [S('theta'), S('z')]
      a.rotulo = 'Superfície r = f(θ, z)'
      a.desenhos.push({ d: 'param', S: [prod(rhs, fn('cos', t)), prod(rhs, fn('sin', t)), z], u: lt.lim, v: lz.lim, restr: [] })
      this.falta(a, [rhs], ['theta', 'z'])
      return
    }
    if (id === 'rho' && !usa(rhs, 'rho', 'r', 'z')) {
      const lt = limiteDe('theta', outros, esc, [ZERO, DOIS_PI])
      const lf = limiteDe('phi', outros, esc, [ZERO, PI])
      const [t, f] = [S('theta'), S('phi')]
      a.rotulo = 'Superfície ρ = f(θ, φ)'
      a.desenhos.push({ d: 'param', S: [prod(rhs, fn('sin', f), fn('cos', t)), prod(rhs, fn('sin', f), fn('sin', t)), prod(rhs, fn('cos', f))], u: lt.lim, v: lf.lim, restr: [] })
      this.falta(a, [rhs], ['theta', 'phi'])
      return
    }
    if (id === 'theta' && livres(rhs).size === [...livres(rhs)].filter((v) => esc.numeros.has(v)).length) {
      const [r, z] = [S('r'), S('z')]
      a.rotulo = 'Semiplano θ = constante'
      a.desenhos.push({ d: 'param', S: [prod(r, fn('cos', rhs)), prod(r, fn('sin', rhs)), z], u: { v: 'r', lo: ZERO, hi: deNumero(R * 1.45) }, v: { v: 'z', lo: zLo, hi: zHi }, restr: [] })
      return
    }
    if (id === 'phi' && livres(rhs).size === [...livres(rhs)].filter((v) => esc.numeros.has(v)).length) {
      const [p, t] = [S('rho'), S('theta')]
      a.rotulo = 'Cone φ = constante'
      a.desenhos.push({ d: 'param', S: [prod(p, fn('sin', rhs), fn('cos', t)), prod(p, fn('sin', rhs), fn('sin', t)), prod(p, fn('cos', rhs))], u: { v: 'rho', lo: ZERO, hi: deNumero(R * 2) }, v: { v: 'theta', lo: ZERO, hi: DOIS_PI }, restr: [] })
      return
    }
    const F = emCartesianas(sub(lhs, rhs))
    if (livres(F).size === 0) throw new ErroCalculo('A equação não tem variáveis')
    a.rotulo = ['x', 'y', 'z'].every((v) => ehLinear(F, v)) ? 'Plano' : 'Superfície implícita'
    a.desenhos.push({ d: 'implicita', f: F, restr: restricoes(outros, esc) })
    this.falta(a, [F], ['x', 'y', 'z'])
  }

  regiaoSem(l: Linha, a: Analise, itens: Item[]): boolean {
    const r = regiaoDeItens(itens, this.esc)
    if (!r) return false
    a.tipo = 'regiao'
    a.rotulo = r.lim.length === 2 ? 'Região plana' : 'Sólido'
    if (l.nome) {
      this.regioes.set(l.nome, r)
      a.nome = l.nome
    }
    a.desenhos.push({ d: 'solido', reg: r })
    this.falta(a, r.lim.flatMap((x) => [x.lo, x.hi]), r.lim.map((x) => x.v))
    return true
  }

  linha(l: Linha, a: Analise) {
    const esc = this.esc
    const prim = l.itens[0]
    const usados = idsDaLinha(l)
    esc.unitarios = (usados.has('i') || usados.has('j')) && !esc.numeros.has('i') && !esc.numeros.has('j') && !esc.funcoes.has('i')

    if (l.nome) {
      if (this.regiaoSem(l, a, l.itens)) return
      if (prim.ops[0] === '=' && prim.ops.length === 1) {
        // C: y = x², 0≤x≤1 é uma curva no plano; S: z = …, com região, uma superfície
        const lhs = prim.partes[0]
        const rhs = paraValor(prim.partes[1], esc)
        if (lhs.t === 'id' && lhs.v === 'y' && !ehVetor(rhs) && !dep(rhs, 'y') && !dep(rhs, 'z') && l.itens.length === 2) {
          const c = cadeia(l.itens[1])
          if (c?.id === 'x') {
            const t: Limite = { v: 'x', lo: paraValor(c.lo, esc) as Expr, hi: paraValor(c.hi, esc) as Expr }
            const r = [S('x'), rhs, ZERO]
            this.curvas.set(l.nome, { r, t, nome: l.nome })
            a.tipo = 'curva'
            a.rotulo = 'Curva plana'
            a.nome = l.nome
            a.desenhos.push({ d: 'curva', r, t })
            return
          }
        }
        a.nome = l.nome
        this.equacao(prim, [...l.itens.slice(1), ...l.restr], a, l.nome)
        return
      }
      throw new ErroCalculo('Região em x e y, r e θ, x, y e z, r, θ e z, ou ρ, φ e θ, como E: 0≤x≤1, 0≤y≤2, 0≤z≤3')
    }

    const def = definicaoDe(l)
    if (def) {
      this.definicao(def, a)
      return
    }

    const outros = [...l.itens.slice(1), ...l.restr]
    if (prim.ops.length === 0) {
      const raiz0 = prim.partes[0]
      if (raiz0.t === 'int') return this.integral(raiz0, a)
      if (temIntegral(raiz0)) return this.somaDeIntegrais(raiz0, a)
      if (raiz0.t === 'call' && !esc.funcoes.has(raiz0.f) && !/^.+_[a-z]+$/.test(raiz0.f)) return this.comando(raiz0, a)
      const v = paraValor(raiz0, esc)
      const exprs = ehVetor(v) ? v : [v]
      const soltas = new Set(exprs.flatMap((e) => [...livres(e)]).filter((s) => !esc.numeros.has(s)))
      if (soltas.size === 0) {
        if (ehVetor(v)) {
          a.tipo = 'ponto'
          a.rotulo = 'Ponto'
          a.desenhos.push({ d: 'ponto', p: v.length === 2 ? [...v, ZERO] : v })
        } else {
          a.tipo = 'calculo'
          a.rotulo = 'Valor'
          a.calcula = (n) => {
            const e = C.fixa(v, n)
            return { rotulo: 'Valor', formula: '', exato: tex(e), valor: avalia(e), selo: 'exato', passos: [] }
          }
        }
        return
      }
      const ordem = [...soltas].sort()
      this.desenhaFuncao({ nome: 'f', params: ['t', 's', 'u', 'v'].some((p) => soltas.has(p)) ? ordem : ehVetor(v) ? ['x', 'y', 'z'].slice(0, v.length) : coordenadasDe(v) }, v, outros, a)
      if (raiz0.t === 'dif') {
        a.calcula = () => C.resultadoGradiente('Derivada', '', ehVetor(v) ? v : v)
      }
      return
    }
    if (prim.ops.length === 1 && prim.ops[0] === '=') {
      this.equacao(prim, outros, a)
      return
    }
    if (this.regiaoSem(l, a, l.itens)) return
    const gs = restricoes([...l.itens, ...l.restr], esc).map(emCartesianas)
    a.tipo = 'regiao'
    a.rotulo = 'Região por desigualdades'
    a.desenhos.push({ d: 'desigualdade', gs })
    this.falta(a, gs, ['x', 'y', 'z'])
  }
}

const texNumVet = (v: Expr[], n: Nums) => `\\left(${v.map((c) => C.texDecimal(Number(avalia(C.fixa(c, n)).toFixed(4)))).join(',\\ ')}\\right)`

function temIntegral(n: No): boolean {
  switch (n.t) {
    case 'int': return true
    case 'neg': case 'abs': return temIntegral(n.a)
    case 'bin': return temIntegral(n.a) || temIntegral(n.b)
    case 'fn': case 'call': case 'tup': return n.a.some(temIntegral)
    default: return false
  }
}

const VISTA_PADRAO: Vista = { x: [-5, 5], y: [-5, 5], z: [-5, 5] }

export function resolve(entradas: Entrada[], vista: Vista = VISTA_PADRAO): Resolvido {
  const nomes: string[] = []
  const funcoes = new Set<string>()
  for (const e of entradas) {
    const d = nomeDefinido(e.fonte)
    if (!d) continue
    if (d.nome.length > 1 && !d.nome.includes('_')) nomes.push(d.nome)
    if (d.funcao) funcoes.add(d.nome)
  }
  const ctx = { nomes, funcoes }
  const az = new Analisador(vista, ctx)
  const vazios = (id: string): Analise => ({ id, tipo: 'vazio', rotulo: '', faltando: [], desenhos: [] })
  const analises = new Map<string, Analise>()
  const linhas: { e: Entrada; l: Linha; define: string | null; usa: Set<string> }[] = []
  for (const e of entradas) {
    const a = vazios(e.id)
    analises.set(e.id, a)
    if (!e.fonte.replace(/\\placeholder\{\}|\s/g, '')) continue
    try {
      const l = parseLinha(e.fonte, ctx)
      const d = definicaoDe(l)
      linhas.push({ e, l, define: d?.nome ?? l.nome ?? null, usa: idsDaLinha(l) })
    } catch (err) {
      a.tipo = 'erro'
      a.erro = err instanceof ErroSintaxe ? err.message : 'Não entendi esta linha'
    }
  }
  // definição antes de uso, em qualquer ordem que as linhas estejam escritas
  const donos = new Map<string, (typeof linhas)[number]>()
  for (const x of linhas) {
    if (!x.define) continue
    if (donos.has(x.define)) {
      const a = analises.get(x.e.id)!
      a.tipo = 'erro'
      a.erro = `${x.define} já foi definido em outra linha`
      x.define = null
      x.usa = new Set()
      continue
    }
    donos.set(x.define, x)
  }
  const pendentes = linhas.filter((x) => analises.get(x.e.id)!.tipo !== 'erro')
  const feitas = new Set<(typeof linhas)[number]>()
  const emCurso = new Set<(typeof linhas)[number]>()
  const processa = (x: (typeof linhas)[number]) => {
    if (feitas.has(x)) return
    if (emCurso.has(x)) throw new ErroCalculo(`Definição circular em ${x.define ?? 'uma linha'}`)
    emCurso.add(x)
    for (const u of x.usa) {
      const dono = donos.get(u)
      if (dono && dono !== x) processa(dono)
    }
    emCurso.delete(x)
    feitas.add(x)
    const a = analises.get(x.e.id)!
    try {
      az.linha(x.l, a)
    } catch (err) {
      if (err instanceof ErroCalculo) {
        a.tipo = 'erro'
        a.erro = err.message
      } else throw err
    }
  }
  for (const x of pendentes) {
    try {
      processa(x)
    } catch (err) {
      const a = analises.get(x.e.id)!
      a.tipo = 'erro'
      a.erro = err instanceof Error ? err.message : 'Erro nesta linha'
      feitas.add(x)
    }
  }
  return {
    analises: entradas.map((e) => analises.get(e.id)!),
    numeros: Object.fromEntries(az.esc.numeros),
    curvas: az.curvas,
    superficies: az.superficies,
    regioes: az.regioes,
    funcoes: az.esc.funcoes,
  }
}


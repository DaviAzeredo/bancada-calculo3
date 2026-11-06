import { ErroSintaxe, type Tok, tokeniza } from './lexer'

export type No =
  | { t: 'num'; v: string }
  | { t: 'id'; v: string }
  | { t: 'neg'; a: No }
  | { t: 'bin'; op: '+' | '-' | '*' | '/' | '^' | '·' | '×'; a: No; b: No }
  | { t: 'fn'; f: string; a: No[]; base?: No }
  | { t: 'call'; f: string; a: No[] }
  | { t: 'tup'; a: No[] }
  | { t: 'abs'; a: No }
  | { t: 'dif'; f: No; vs: string[] }
  | { t: 'linhaD'; f: No; ordem: number; args?: No[] }
  | { t: 'int'; n: 1 | 2 | 3; fechada: boolean; sub?: string; lo?: No; hi?: No; corpo: No; ds: string[]; pq?: { var: string; f: No }[] }

export type Item = { partes: No[]; ops: string[] }
export type Linha = { nome?: string; itens: Item[]; restr: Item[] }

type Contexto = {
  nomes: readonly string[]
  funcoes: ReadonlySet<string>
}

class Parser {
  i = 0
  noInt = 0
  noAbs = 0
  toks: Tok[]
  ctx: Contexto
  constructor(toks: Tok[], ctx: Contexto) {
    this.toks = toks
    this.ctx = ctx
  }
  get tk() {
    return this.toks[this.i]
  }
  ver(k = 0) {
    return this.toks[Math.min(this.i + k, this.toks.length - 1)]
  }
  ehOp(v: string, k = 0) {
    const t = this.ver(k)
    return t.t === 'op' && t.v === v
  }
  pega(v: string) {
    if (this.ehOp(v)) {
      this.i++
      return true
    }
    return false
  }
  exige(v: string, msg: string) {
    if (!this.pega(v)) throw new ErroSintaxe(msg)
  }

  /** "d" seguido de nome, no fim do corpo de uma integral. */
  ehDiferencial(k = 0) {
    const a = this.ver(k)
    const b = this.ver(k + 1)
    return this.noInt > 0 && a.t === 'id' && a.v === 'd' && b.t === 'id'
  }

  expr(): No {
    let a = this.termo()
    for (;;) {
      if (this.ehOp('+') || this.ehOp('-')) {
        // na forma ∮ P dx + Q dy, o "+" antes do próximo pedaço é da integral
        const op = this.tk as { v: '+' | '-' }
        this.i++
        a = { t: 'bin', op: op.v, a, b: this.termo() }
      } else return a
    }
  }

  podeImplicar() {
    const t = this.tk
    if (this.ehDiferencial()) return false
    if (t.t === 'num' || t.t === 'id' || t.t === 'fn' || t.t === 'cmd' || t.t === 'int') return true
    if (t.t !== 'op') return false
    if (t.v === '|') return this.noAbs === 0
    return ['(', 'frac', 'sqrt', '⟨', '∂', '∇', '‖'].includes(t.v)
  }

  termo(): No {
    let a = this.unario()
    for (;;) {
      if (this.ehOp('·') && this.ehDiferencial(1)) {
        this.i++
        return a
      }
      if (this.ehOp('*') || this.ehOp('·') || this.ehOp('×') || this.ehOp('/')) {
        const op = (this.tk as { v: string }).v as '*' | '·' | '×' | '/'
        this.i++
        a = { t: 'bin', op, a, b: this.unario() }
      } else if (this.podeImplicar()) {
        a = { t: 'bin', op: '*', a, b: this.potencia() }
      } else return a
    }
  }

  unario(): No {
    if (this.pega('-')) return { t: 'neg', a: this.unario() }
    if (this.pega('+')) return this.unario()
    return this.potencia()
  }

  potencia(): No {
    const a = this.posfixo()
    if (this.pega('^')) return { t: 'bin', op: '^', a, b: this.expoente() }
    return a
  }

  expoente(): No {
    if (this.pega('-')) return { t: 'neg', a: this.expoente() }
    if (this.pega('+')) return this.expoente()
    if (this.ehOp('{')) return this.grupo()
    return this.potencia()
  }

  grupo(): No {
    this.exige('{', 'Faltou abrir um grupo')
    const e = this.expr()
    this.exige('}', 'Faltou fechar um grupo')
    return e
  }

  posfixo(): No {
    let a = this.atomo()
    let ordem = 0
    while (this.pega("'")) ordem++
    if (ordem) a = { t: 'linhaD', f: a, ordem, args: a.t === 'id' && this.ehOp('(') ? this.args() : undefined }
    return a
  }

  args(): No[] {
    const fecha = this.ehOp('(') ? ')' : null
    if (!fecha) throw new ErroSintaxe('Faltou abrir parênteses')
    this.i++
    if (this.pega(')')) return []
    const l = [this.expr()]
    while (this.pega(',')) l.push(this.expr())
    this.exige(')', 'Faltou fechar um parêntese')
    return l
  }

  /** "sen 2x" e "sen x cos y": o argumento vai até a próxima função ou operador. */
  argImplicito(): No {
    let a = this.potencia()
    for (;;) {
      const t = this.tk
      if (this.ehDiferencial()) return a
      if (t.t === 'num' || t.t === 'id' || (t.t === 'op' && (t.v === 'frac' || t.v === 'sqrt'))) a = { t: 'bin', op: '*', a, b: this.potencia() }
      else return a
    }
  }

  chamaFn(f: string): No {
    let expoente: No | null = null
    let base: No | undefined
    if (this.pega('_')) base = this.ehOp('{') ? this.grupo() : this.atomo()
    if (this.ehOp('^')) {
      this.i++
      expoente = this.expoente()
    }
    const inv = expoente && expoente.t === 'neg' && expoente.a.t === 'num' && expoente.a.v === '1'
    const paren = this.ehOp('(')
    if (this.ehOp('{')) {
      const a = this.grupo()
      return this.fechaFn(f, [a], base, expoente, !!inv)
    }
    if (paren) return this.fechaFn(f, this.args(), base, expoente, !!inv)
    if (this.tk.t === 'fim' || (this.tk.t === 'op' && ![',', ')', '}'].includes(this.tk.v) ? false : this.tk.t === 'op')) {
      throw new ErroSintaxe('Faltou o argumento da função')
    }
    return this.fechaFn(f, [this.argImplicito()], base, expoente, !!inv)
  }

  fechaFn(f: string, a: No[], base: No | undefined, exp: No | null, inv: boolean): No {
    const INV: Record<string, string> = { sin: 'asin', cos: 'acos', tan: 'atan' }
    if (inv && INV[f]) return { t: 'fn', f: INV[f], a }
    const n: No = { t: 'fn', f, a, base }
    return exp ? { t: 'bin', op: '^', a: n, b: exp } : n
  }

  atomo(): No {
    const t = this.tk
    if (t.t === 'num') {
      this.i++
      return { t: 'num', v: t.v }
    }
    if (t.t === 'id') {
      this.i++
      // f_x(1, 2) é derivada parcial de f, então chama como função
      const base = t.v.split('_')[0]
      if ((this.ctx.funcoes.has(t.v) || this.ctx.funcoes.has(base)) && this.ehOp('(')) return { t: 'call', f: t.v, a: this.args() }
      return { t: 'id', v: t.v }
    }
    if (t.t === 'fn') {
      this.i++
      return this.chamaFn(t.v)
    }
    if (t.t === 'cmd') {
      this.i++
      if (this.ehOp('(')) return { t: 'call', f: t.v, a: this.args() }
      return { t: 'call', f: t.v, a: [this.potencia()] }
    }
    if (t.t === 'int') return this.integral(t)
    if (t.t === 'fim') throw new ErroSintaxe('A expressão terminou no meio')
    this.i++
    switch (t.v) {
      case '(': return this.parenteses(')')
      case '[': return this.parenteses(']')
      case '⟨': return this.parenteses('⟩')
      case '{': {
        this.i--
        return this.grupo()
      }
      case '|': {
        this.noAbs++
        const a = this.expr()
        this.noAbs--
        this.exige('|', 'Faltou fechar a barra de módulo')
        return { t: 'abs', a }
      }
      case '‖': {
        const a = this.expr()
        this.exige('‖', 'Faltou fechar a norma')
        return { t: 'abs', a }
      }
      case 'frac': return this.fracao()
      case 'sqrt': return this.raiz()
      case '∂': this.i--; return this.parcialTexto()
      case '∇': return this.nabla()
      default: throw new ErroSintaxe(`Não esperava “${t.v}” aqui`)
    }
  }

  parenteses(fecha: string): No {
    const noAbs = this.noAbs
    const noInt = this.noInt
    this.noAbs = 0
    const l = [this.expr()]
    while (this.pega(',')) l.push(this.expr())
    // dentro de parênteses cabe ∮ (P dx + Q dy): o fechamento é que encerra o corpo
    this.noAbs = noAbs
    this.noInt = noInt
    this.exige(fecha, fecha === ')' ? 'Faltou fechar um parêntese' : 'Faltou fechar um colchete')
    return l.length === 1 ? l[0] : { t: 'tup', a: l }
  }

  fracao(): No {
    if (this.ehDerivadaEmFrac()) return this.derivadaEmFrac()
    const a = this.grupo()
    const b = this.grupo()
    return { t: 'bin', op: '/', a, b }
  }

  /** \frac{∂f}{∂x}, \frac{d}{dt}, \frac{∂²f}{∂x∂y}. */
  ehDerivadaEmFrac() {
    const a = this.ver(1)
    const b = this.ver(2)
    if (!this.ehOp('{')) return false
    if (a.t === 'op' && a.v === '∂') return true
    return a.t === 'id' && a.v === 'd' && ((b.t === 'op' && (b.v === '}' || b.v === '^')) || b.t === 'id') && this.temDEmbaixo()
  }

  temDEmbaixo() {
    let prof = 0
    for (let k = 0; k < 200; k++) {
      const t = this.ver(k)
      if (t.t === 'fim') return false
      if (t.t === 'op' && t.v === '{') prof++
      if (t.t === 'op' && t.v === '}') {
        prof--
        if (prof === 0) {
          const u = this.ver(k + 2)
          return this.ehOp('{', k + 1) && u.t === 'id' && u.v === 'd'
        }
      }
    }
    return false
  }

  /** O 2 de ∂² e de ∇²: quem manda na ordem é a lista de variáveis. */
  ordemDaDerivada() {
    return this.ehOp('{') ? this.grupo() : this.atomo()
  }

  derivadaEmFrac(): No {
    this.exige('{', 'Faltou abrir um grupo')
    this.i++ // ∂ ou d
    if (this.pega('^')) this.ordemDaDerivada()
    let corpo: No | null = null
    if (!this.ehOp('}')) corpo = this.expr()
    this.exige('}', 'Faltou fechar a derivada')
    this.exige('{', 'Faltou o denominador da derivada')
    const vs: string[] = []
    while (!this.ehOp('}')) {
      const t = this.tk
      if ((t.t === 'op' && t.v === '∂') || (t.t === 'id' && t.v === 'd')) {
        this.i++
        const x = this.tk
        if (x.t !== 'id') throw new ErroSintaxe('Faltou a variável da derivada')
        this.i++
        let vezes = 1
        if (this.pega('^')) {
          const n = this.ehOp('{') ? this.grupo() : this.atomo()
          if (n.t === 'num') vezes = Number(n.v)
        }
        for (let k = 0; k < vezes; k++) vs.push(x.v)
      } else throw new ErroSintaxe('Denominador de derivada inválido')
    }
    this.exige('}', 'Faltou fechar a derivada')
    if (!corpo) corpo = this.potencia()
    return { t: 'dif', f: corpo, vs: vs.reverse() }
  }

  /** ∂f/∂x e ∂²f/∂x∂y em texto corrido. */
  parcialTexto(): No {
    this.i++
    if (this.pega('^')) this.ordemDaDerivada()
    let corpo: No | null = null
    if (!this.ehOp('/')) corpo = this.potencia()
    this.exige('/', 'Use ∂f/∂x')
    const vs: string[] = []
    while (this.ehOp('∂')) {
      this.i++
      const x = this.tk
      if (x.t !== 'id') throw new ErroSintaxe('Faltou a variável da derivada')
      this.i++
      let vezes = 1
      if (this.pega('^')) {
        const n = this.ehOp('{') ? this.grupo() : this.atomo()
        if (n.t === 'num') vezes = Number(n.v)
      }
      for (let k = 0; k < vezes; k++) vs.push(x.v)
    }
    if (!corpo) corpo = this.potencia()
    return { t: 'dif', f: corpo, vs: vs.reverse() }
  }

  nabla(): No {
    if (this.pega('·')) return { t: 'call', f: 'div', a: [this.potencia()] }
    if (this.pega('×')) return { t: 'call', f: 'rot', a: [this.potencia()] }
    if (this.pega('^')) {
      this.ordemDaDerivada()
      return { t: 'call', f: 'lap', a: [this.potencia()] }
    }
    return { t: 'call', f: 'grad', a: [this.potencia()] }
  }

  raiz(): No {
    let indice: No | null = null
    if (this.pega('[')) {
      indice = this.expr()
      this.exige(']', 'Faltou fechar o índice da raiz')
    }
    const a = this.ehOp('{') ? this.grupo() : this.ehOp('(') ? this.atomo() : this.potencia()
    if (indice) return { t: 'bin', op: '^', a, b: { t: 'bin', op: '/', a: { t: 'num', v: '1' }, b: indice } }
    return { t: 'fn', f: 'sqrt', a: [a] }
  }

  limiteDeIntegral(): No {
    if (this.ehOp('{')) return this.grupo()
    if (this.pega('-')) return { t: 'neg', a: this.limiteDeIntegral() }
    return this.posfixo()
  }

  integral(t: Extract<Tok, { t: 'int' }>): No {
    this.i++
    let sub: string | undefined
    let lo: No | undefined
    let hi: No | undefined
    const bloco = () => {
      if (this.pega('_')) {
        const inicio = this.tk
        const proximo = this.ver(1)
        // ∫_C, ∬_{S}: nome de curva, superfície ou região, e não limite inferior
        const nomeado = (v: string) => /^[A-Z]/.test(v) || this.ctx.funcoes.has(v)
        const nomeEmGrupo = inicio.t === 'op' && inicio.v === '{' && proximo.t === 'id' && this.ehOp('}', 2) && nomeado(proximo.v)
        if (nomeEmGrupo) {
          sub = (proximo as { v: string }).v
          this.i += 3
        } else if (inicio.t === 'id' && nomeado(inicio.v)) {
          sub = inicio.v
          this.i++
        } else lo = this.limiteDeIntegral()
      }
      if (this.pega('^')) hi = this.limiteDeIntegral()
    }
    bloco()
    if (this.ehOp('_')) bloco()
    this.noInt++
    const corpoAbs = this.noAbs
    this.noAbs = 0
    const pq: { var: string; f: No }[] = []
    const corpo = this.corpoIntegral()
    const ds = this.diferenciais(t.n)
    // ∮ P dx + Q dy + R dz: forma diferencial, cada parcela com a sua variável
    if (sub && ds.length === 1 && /^[xyz]$/.test(ds[0]) && t.n === 1) {
      pq.push({ var: ds[0], f: corpo })
      while ((this.ehOp('+') || this.ehOp('-')) && !this.fimDaForma()) {
        // só é parcela da forma se terminar em dx, dy ou dz; senão o sinal é de uma soma maior
        const volta = this.i
        const menos = this.ehOp('-')
        this.i++
        try {
          const f = this.corpoIntegral()
          const d = this.diferenciais(1)
          if (d.length !== 1 || !/^[xyz]$/.test(d[0])) throw new ErroSintaxe('')
          pq.push({ var: d[0], f: menos ? { t: 'neg', a: f } : f })
        } catch {
          this.i = volta
          break
        }
      }
    }
    this.noInt--
    this.noAbs = corpoAbs
    return { t: 'int', n: t.n, fechada: t.fechada, sub, lo, hi, corpo, ds, pq: pq.length ? pq : undefined }
  }

  fimDaForma() {
    return this.tk.t === 'fim'
  }

  corpoIntegral(): No {
    if (this.ehDiferencial()) return { t: 'num', v: '1' }
    return this.expr()
  }

  diferenciais(max: number): string[] {
    const ds: string[] = []
    while (this.ehDiferencial() && ds.length < max) {
      this.i++
      const v = this.tk as { v: string }
      this.i++
      ds.push(v.v)
    }
    if (!ds.length) throw new ErroSintaxe('Faltou o diferencial: termine com dx, dA, dV, dr ou dS')
    return ds
  }

  relacao(): Item {
    const partes = [this.expr()]
    const ops: string[] = []
    for (;;) {
      const t = this.tk
      if (t.t === 'op' && ['=', '<', '>', '<=', '>='].includes(t.v)) {
        this.i++
        ops.push(t.v)
        partes.push(this.expr())
      } else if (t.t === 'op' && t.v === '∈') {
        this.i++
        const aberto = this.pega('[') || this.pega('(')
        if (!aberto) throw new ErroSintaxe('Depois de ∈ vem um intervalo, como [0, 2π]')
        const lo = this.expr()
        this.exige(',', 'O intervalo precisa de dois limites')
        const hi = this.expr()
        if (!this.pega(']')) this.exige(')', 'Faltou fechar o intervalo')
        return { partes: [lo, partes[0], hi], ops: ['<=', '<='] }
      } else return { partes, ops }
    }
  }

  linha(): Linha {
    let nome: string | undefined
    const a = this.tk
    if (a.t === 'id' && this.ehOp(':', 1)) {
      nome = a.v
      this.i += 2
    }
    const itens: Item[] = []
    const restr: Item[] = []
    const lista = (destino: Item[]) => {
      destino.push(this.relacao())
      while (this.pega(',')) destino.push(this.relacao())
    }
    if (this.ehOp('{') && nome) {
      this.i++
      lista(itens)
      this.exige('}', 'Faltou fechar as chaves')
    } else lista(itens)
    while (this.ehOp('{')) {
      this.i++
      lista(restr)
      this.exige('}', 'Faltou fechar as chaves')
    }
    if (this.tk.t !== 'fim') {
      const r = this.tk
      throw new ErroSintaxe(r.t === 'op' ? `Não esperava “${r.v}” aqui` : 'Sobrou algo depois da expressão')
    }
    return { nome, itens, restr }
  }
}

const ctxVazio: Contexto = { nomes: [], funcoes: new Set() }

export function parseLinha(src: string, ctx: Contexto = ctxVazio): Linha {
  const p = new Parser(tokeniza(src, ctx.nomes), ctx)
  return p.linha()
}

export function parseExpr(src: string, ctx: Contexto = ctxVazio): No {
  const p = new Parser(tokeniza(src, ctx.nomes), ctx)
  const e = p.expr()
  if (p.tk.t !== 'fim') throw new ErroSintaxe('Sobrou algo depois da expressão')
  return e
}

/** Nomes definidos numa linha ("f(x,y) = …", "raio = 2"), antes do parse completo. */
export function nomeDefinido(src: string): { nome: string; funcao: boolean } | null {
  const limpo = src.replace(/\\left|\\right|\\mleft|\\mright|\s/g, '').replace(/\\operatorname\{([^}]*)\}/g, '$1').replace(/\\(?:vec|mathbf)\{([^}]*)\}/g, '$1')
  const m = /^([A-Za-z](?:[A-Za-z0-9]*)(?:_\{?[A-Za-z0-9]+\}?)?)(\(|=|:)/.exec(limpo)
  if (!m) return null
  return { nome: m[1].replace(/[{}]/g, ''), funcao: m[2] === '(' }
}

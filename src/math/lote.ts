import { type Expr, type Fn, aplicaFn, avalia, chave } from './alg'

/**
 * Avaliação em lote sem `eval`. Em vez de andar pela árvore para cada ponto, a expressão
 * vira uma lista de instruções sobre vetores: cada laço roda sobre o lote inteiro e o JIT
 * o compila como um laço numérico simples. Assim a CSP segue sem 'unsafe-eval' e uma malha
 * de 40 mil pontos custa pouco mais de 1 ms.
 */
type Instr =
  | { op: 'const'; d: number; v: number }
  | { op: 'ent'; d: number; i: number }
  | { op: 'add' | 'mul' | 'pow'; d: number; a: number; b: number }
  | { op: 'inv' | 'quad' | 'sqrt'; d: number; a: number }
  | { op: 'fn'; d: number; f: Fn; a: number[] }

export type Programa = { instr: Instr[]; saidas: number[]; nRegs: number; entradas: string[] }

/** Compila várias expressões juntas, dividindo as subexpressões iguais entre elas. */
export function compila(exprs: Expr[], entradas: string[]): Programa {
  const instr: Instr[] = []
  const memo = new Map<string, number>()
  let nRegs = 0
  const emite = (e: Expr): number => {
    const k = chave(e)
    const m = memo.get(k)
    if (m !== undefined) return m
    let r: number
    switch (e.k) {
      case 'num':
        r = nRegs++
        instr.push({ op: 'const', d: r, v: avalia(e) })
        break
      case 'sym': {
        const idx = entradas.indexOf(e.s)
        r = nRegs++
        instr.push(idx >= 0 ? { op: 'ent', d: r, i: idx } : { op: 'const', d: r, v: avalia(e) })
        break
      }
      case 'add': case 'mul':
        r = emite(e.a[0])
        for (let j = 1; j < e.a.length; j++) {
          const b = emite(e.a[j])
          const d = nRegs++
          instr.push({ op: e.k, d, a: r, b })
          r = d
        }
        break
      case 'pow': {
        const a = emite(e.b)
        const x = e.e.k === 'num' ? avalia(e.e) : NaN
        if (x === -1 || x === 2 || x === 0.5) {
          r = nRegs++
          instr.push({ op: x === -1 ? 'inv' : x === 2 ? 'quad' : 'sqrt', d: r, a })
        } else {
          const b = emite(e.e)
          r = nRegs++
          instr.push({ op: 'pow', d: r, a, b })
        }
        break
      }
      case 'fn': {
        const a = e.a.map(emite)
        r = nRegs++
        instr.push({ op: 'fn', d: r, f: e.f, a })
        break
      }
    }
    memo.set(k, r)
    return r
  }
  const saidas = exprs.map(emite)
  return { instr, saidas, nRegs, entradas }
}

export type Lote = { regs: Float64Array[]; n: number }

function regsPara(p: Programa, n: number, lote?: Lote): Lote {
  if (lote && lote.n === n && lote.regs.length >= p.nRegs) return lote
  return { regs: Array.from({ length: p.nRegs }, () => new Float64Array(n)), n }
}

/**
 * Roda o programa em `n` pontos. Cada entrada é um vetor de `n` valores ou um número
 * (parâmetro do controle deslizante, igual em todos os pontos). Devolve os registradores
 * de saída: valem até a próxima execução com o mesmo lote.
 */
export function executa(p: Programa, ent: (Float64Array | number)[], n: number, reuso?: Lote): { saidas: Float64Array[]; lote: Lote } {
  const lote = regsPara(p, n, reuso)
  const R = lote.regs
  for (const i of p.instr) {
    const D = R[i.d]
    switch (i.op) {
      case 'const': D.fill(i.v); break
      case 'ent': {
        const x = ent[i.i]
        if (typeof x === 'number') D.fill(x)
        else D.set(x.length === n ? x : x.subarray(0, n))
        break
      }
      case 'add': { const a = R[i.a], b = R[i.b]; for (let j = 0; j < n; j++) D[j] = a[j] + b[j]; break }
      case 'mul': { const a = R[i.a], b = R[i.b]; for (let j = 0; j < n; j++) D[j] = a[j] * b[j]; break }
      case 'pow': { const a = R[i.a], b = R[i.b]; for (let j = 0; j < n; j++) D[j] = Math.pow(a[j], b[j]); break }
      case 'inv': { const a = R[i.a]; for (let j = 0; j < n; j++) D[j] = 1 / a[j]; break }
      case 'quad': { const a = R[i.a]; for (let j = 0; j < n; j++) D[j] = a[j] * a[j]; break }
      case 'sqrt': { const a = R[i.a]; for (let j = 0; j < n; j++) D[j] = Math.sqrt(a[j]); break }
      case 'fn': fnLote(i.f, i.a.map((r) => R[r]), D, n); break
    }
  }
  return { saidas: p.saidas.map((r) => R[r]), lote }
}

const UNARIAS: Partial<Record<Fn, (x: number) => number>> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, asinh: Math.asinh, acosh: Math.acosh, atanh: Math.atanh,
  ln: Math.log, abs: Math.abs, sign: Math.sign, floor: Math.floor, ceil: Math.ceil,
}

function fnLote(f: Fn, a: Float64Array[], D: Float64Array, n: number) {
  const u = UNARIAS[f]
  if (u) {
    const x = a[0]
    for (let j = 0; j < n; j++) D[j] = u(x[j])
    return
  }
  const args: number[] = a.map(() => 0)
  for (let j = 0; j < n; j++) {
    for (let k = 0; k < a.length; k++) args[k] = a[k][j]
    D[j] = aplicaFn(f, args)
  }
}

/** Avaliador de um ponto, com a mesma compilação. */
export function funcao(exprs: Expr[], entradas: string[]): (x: number[]) => number[] {
  const p = compila(exprs, entradas)
  let lote: Lote | undefined
  return (x) => {
    const r = executa(p, x, 1, lote)
    lote = r.lote
    return r.saidas.map((s) => s[0])
  }
}

const FATIA = 8192

/**
 * Executa em fatias, para que o custo de memória dos registradores não cresça com a malha:
 * sem isso, um milhão de pontos com 50 registradores pediria 400 MB. `aoFatia` recebe o
 * início da fatia e as saídas, que só valem durante a chamada.
 */
export function varre(p: Programa, ent: (Float64Array | number)[], n: number, aoFatia: (ini: number, saidas: Float64Array[], tam: number) => void) {
  let lote: Lote | undefined
  for (let ini = 0; ini < n; ini += FATIA) {
    const tam = Math.min(FATIA, n - ini)
    const parte = ent.map((x) => (typeof x === 'number' ? x : x.subarray(ini, ini + tam)))
    const r = executa(p, parte, tam, lote)
    lote = r.lote
    aoFatia(ini, r.saidas, tam)
  }
}

/** Avalia em `n` pontos e devolve cada saída num vetor próprio. */
export function avaliaTudo(p: Programa, ent: (Float64Array | number)[], n: number): Float64Array[] {
  const out = p.saidas.map(() => new Float64Array(n))
  varre(p, ent, n, (ini, s, tam) => {
    s.forEach((v, i) => out[i].set(tam === v.length ? v : v.subarray(0, tam), ini))
  })
  return out
}

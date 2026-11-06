/**
 * Uma só gramática para o que o editor de fórmulas produz (LaTeX) e para o que se digita
 * à mão ("sen x + y^2", "∫_0^1 x dx"). O aluno brasileiro escreve sen, tg e cossec, então
 * esses nomes valem tanto quanto sin, tan e csc.
 */
export type Tok =
  | { t: 'num'; v: string; p: number }
  | { t: 'id'; v: string; p: number }
  | { t: 'fn'; v: string; p: number }
  | { t: 'cmd'; v: string; p: number }
  | { t: 'op'; v: string; p: number }
  | { t: 'int'; n: 1 | 2 | 3; fechada: boolean; p: number }
  | { t: 'fim'; p: number }

export class ErroSintaxe extends Error {}

const FUNCOES: Record<string, string> = {
  sin: 'sin', sen: 'sin', cos: 'cos', tan: 'tan', tg: 'tan', sec: 'sec', csc: 'csc', cossec: 'csc', cot: 'cot', cotg: 'cot', ctg: 'cot',
  asin: 'asin', asen: 'asin', arcsin: 'asin', arcsen: 'asin', acos: 'acos', arccos: 'acos',
  atan: 'atan', atg: 'atan', arctan: 'atan', arctg: 'atan', atan2: 'atan2',
  sinh: 'sinh', senh: 'sinh', cosh: 'cosh', tanh: 'tanh', tgh: 'tanh', asinh: 'asinh', acosh: 'acosh', atanh: 'atanh',
  ln: 'ln', log: 'log', exp: 'exp', sqrt: 'sqrt', raiz: 'sqrt', abs: 'abs', sgn: 'sign', sign: 'sign', floor: 'floor', ceil: 'ceil', min: 'min', max: 'max',
}

const GREGOS: Record<string, string> = {
  alpha: 'alpha', beta: 'beta', gamma: 'gamma', delta: 'delta', epsilon: 'epsilon', varepsilon: 'epsilon', theta: 'theta', vartheta: 'theta',
  lambda: 'lambda', mu: 'mu', nu: 'nu', xi: 'xi', pi: 'pi', rho: 'rho', varrho: 'rho', sigma: 'sigma', tau: 'tau',
  phi: 'phi', varphi: 'phi', psi: 'psi', omega: 'omega',
}

/** Só estes viram grego sem barra: `mu`, `nu` e `xi` em texto corrido são produtos. */
const GREGOS_TEXTO = ['inf', 'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'theta', 'lambda', 'pi', 'rho', 'sigma', 'tau', 'phi', 'psi', 'omega']

const UNICODE: Record<string, string> = {
  α: 'alpha', β: 'beta', γ: 'gamma', δ: 'delta', ε: 'epsilon', θ: 'theta', ϑ: 'theta', λ: 'lambda', μ: 'mu', ν: 'nu', ξ: 'xi',
  π: 'pi', ρ: 'rho', σ: 'sigma', τ: 'tau', φ: 'phi', ϕ: 'phi', ψ: 'psi', ω: 'omega', '∞': 'inf',
}

export const COMANDOS = [
  'grad', 'gradiente', 'div', 'divergente', 'rot', 'rotacional', 'curl', 'lap', 'laplaciano',
  'tangente', 'direcional', 'criticos', 'lagrange', 'taylor', 'potencial', 'hessiana',
  'comprimento', 'curvatura', 'torcao', 'frenet', 'area', 'volume', 'massa', 'centroide', 'linha', 'fluxo',
  'green', 'stokes', 'gauss', 'jacobiano', 'riemann', 'sonda', 'fatia', 'curvas',
]
/** Aceitam argumento sem parênteses, como "grad f" e "div F". */
const SEM_PARENTESES = new Set(['grad', 'gradiente', 'div', 'divergente', 'rot', 'rotacional', 'curl', 'lap', 'laplaciano'])

const LATEX_OPS: Record<string, string> = {
  cdot: '·', ast: '*', times: '×', le: '<=', leq: '<=', leqslant: '<=', ge: '>=', geq: '>=', geqslant: '>=', lt: '<', gt: '>', in: '∈',
  lbrace: '{', rbrace: '}', lbrack: '[', rbrack: ']', langle: '⟨', rangle: '⟩', vert: '|', lvert: '|', rvert: '|', mid: '|',
  Vert: '‖', lVert: '‖', rVert: '‖', partial: '∂', nabla: '∇', colon: ':', to: ':', prime: "'",
}
const LATEX_MUDOS = new Set(['left', 'right', 'mleft', 'mright', 'bigl', 'bigr', 'Bigl', 'Bigr', 'biggl', 'biggr', 'big', 'Big', 'quad', 'qquad', 'displaystyle', 'limits', 'nolimits', 'textstyle'])
const LATEX_INVOLUCRO = new Set(['vec', 'mathbf', 'hat', 'boldsymbol', 'mathrm', 'mathit', 'bm', 'overrightarrow', 'operatorname', 'text', 'mathbb'])

function semAcento(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

const ehLetra = (c: string | undefined) => c !== undefined && /[A-Za-z]/.test(c)
const ehDigito = (c: string | undefined) => c !== undefined && c >= '0' && c <= '9'

export function tokeniza(fonte: string, nomes: readonly string[] = []): Tok[] {
  const s = semAcento(fonte).replace(/²/g, '^2').replace(/³/g, '^3').replace(/\^\{\\prime\\prime\}/g, "''").replace(/\^\{\\prime\}/g, "'").replace(/\\placeholder\{[^}]*\}/g, '')
  const toks: Tok[] = []
  const palavras = [...new Set([...nomes, ...Object.keys(FUNCOES), ...GREGOS_TEXTO, ...COMANDOS])].sort((a, b) => b.length - a.length)
  let i = 0

  const subscrito = (id: string) => {
    if (s[i] !== '_') return id
    let j = i + 1
    let t = ''
    if (s[j] === '{') {
      const f = s.indexOf('}', j)
      if (f < 0) return id
      t = s.slice(j + 1, f)
      j = f + 1
    } else if (ehLetra(s[j]) || ehDigito(s[j])) {
      t = s[j]
      j++
    }
    if (!/^[A-Za-z0-9]+$/.test(t)) return id
    i = j
    return `${id}_${t}`
  }
  const empurraId = (v: string, p: number) => toks.push({ t: 'id', v: subscrito(v), p })

  while (i < s.length) {
    const c = s[i]
    const p = i
    if (c === ' ' || c === '\n' || c === '\t' || c === '~') {
      i++
      continue
    }
    if (ehDigito(c) || (c === '.' && ehDigito(s[i + 1]))) {
      let j = i
      while (ehDigito(s[j])) j++
      if (s[j] === '.' && ehDigito(s[j + 1])) {
        j++
        while (ehDigito(s[j])) j++
      } else if (s[j] === '{' && s[j + 1] === ',' && s[j + 2] === '}' && ehDigito(s[j + 3])) {
        // MathLive escreve vírgula decimal como 1{,}5
        const ini = j
        j += 3
        while (ehDigito(s[j])) j++
        toks.push({ t: 'num', v: `${s.slice(i, ini)}.${s.slice(ini + 3, j)}`, p })
        i = j
        continue
      }
      toks.push({ t: 'num', v: s.slice(i, j), p })
      i = j
      continue
    }
    if (c === '\\') {
      let j = i + 1
      if (!ehLetra(s[j])) {
        const x = s[j]
        i = j + 1
        if (x === '{' || x === '}' || x === '|') toks.push({ t: 'op', v: x === '|' ? '‖' : x, p })
        continue
      }
      while (ehLetra(s[j])) j++
      const nome = s.slice(i + 1, j)
      i = j
      if (LATEX_MUDOS.has(nome)) continue
      if (LATEX_INVOLUCRO.has(nome)) {
        // \operatorname{sen}, \vec{F}, \mathrm{d}: o nome de dentro segue como texto comum
        if (s[i] === '{') {
          const f = s.indexOf('}', i)
          if (f > 0) {
            const dentro = s.slice(i + 1, f)
            i = f + 1
            if (COMANDOS.includes(dentro)) toks.push({ t: 'cmd', v: dentro, p })
            else toks.push(...tokeniza(dentro, nomes).filter((t) => t.t !== 'fim').map((t) => ({ ...t, p })))
          }
        }
        continue
      }
      if (nome === 'int' || nome === 'iint' || nome === 'iiint' || nome === 'oint' || nome === 'oiint') {
        const n = nome === 'iiint' ? 3 : nome.includes('ii') ? 2 : 1
        toks.push({ t: 'int', n, fechada: nome.startsWith('o'), p })
        continue
      }
      if (nome === 'frac' || nome === 'dfrac' || nome === 'tfrac') {
        toks.push({ t: 'op', v: 'frac', p })
        continue
      }
      if (nome === 'sqrt') {
        toks.push({ t: 'op', v: 'sqrt', p })
        continue
      }
      if (nome === 'exponentialE') {
        toks.push({ t: 'id', v: 'e', p })
        continue
      }
      if (nome === 'differentialD') {
        toks.push({ t: 'id', v: 'd', p })
        continue
      }
      if (nome === 'imaginaryI') {
        toks.push({ t: 'id', v: 'i', p })
        continue
      }
      if (nome === 'infty') {
        toks.push({ t: 'id', v: 'inf', p })
        continue
      }
      if (FUNCOES[nome]) {
        toks.push({ t: 'fn', v: FUNCOES[nome], p })
        continue
      }
      if (GREGOS[nome]) {
        empurraId(GREGOS[nome], p)
        continue
      }
      if (LATEX_OPS[nome]) {
        toks.push({ t: 'op', v: LATEX_OPS[nome], p })
        continue
      }
      if (COMANDOS.includes(nome)) {
        toks.push({ t: 'cmd', v: nome, p })
        continue
      }
      throw new ErroSintaxe(`Não conheço \\${nome}`)
    }
    if (UNICODE[c]) {
      i++
      empurraId(UNICODE[c], p)
      continue
    }
    if (c === '∫' || c === '∬' || c === '∭' || c === '∮' || c === '∯') {
      i++
      toks.push({ t: 'int', n: c === '∭' ? 3 : c === '∬' || c === '∯' ? 2 : 1, fechada: c === '∮' || c === '∯', p })
      continue
    }
    if (c === '√') {
      i++
      toks.push({ t: 'op', v: 'sqrt', p })
      continue
    }
    if (ehLetra(c)) {
      const m = palavras.find((w) => s.startsWith(w, i))
      if (m) {
        const dep = i + m.length
        const proximo = s[dep]
        if (FUNCOES[m]) {
          i = dep
          toks.push({ t: 'fn', v: FUNCOES[m], p })
          continue
        }
        if (GREGOS_TEXTO.includes(m) || nomes.includes(m)) {
          i = dep
          empurraId(m, p)
          continue
        }
        // comando escrito por extenso: só vale seguido de "(" ou, para grad e cia., de um nome
        const abre = proximo === '(' || s.startsWith('\\left(', dep) || s.startsWith('\\mleft(', dep)
        if (abre || SEM_PARENTESES.has(m)) {
          i = dep
          toks.push({ t: 'cmd', v: m, p })
          continue
        }
      }
      i++
      empurraId(c, p)
      continue
    }
    const dois = s.slice(i, i + 2)
    if (dois === '<=' || dois === '>=' || dois === '==') {
      i += 2
      toks.push({ t: 'op', v: dois === '==' ? '=' : dois, p })
      continue
    }
    i++
    const unico: Record<string, string> = { '−': '-', '–': '-', '∙': '·', '⋅': '·', '≤': '<=', '≥': '>=', '∗': '*' }
    const v = unico[c] ?? c
    if ('+-*/^·×()[]{}⟨⟩,=<>|‖:;∈∂∇\'_!'.includes(v) || v === '<=' || v === '>=') {
      if (v === ';') continue
      toks.push({ t: 'op', v, p })
      continue
    }
    throw new ErroSintaxe(`Não entendi o símbolo “${c}”`)
  }
  toks.push({ t: 'fim', p: s.length })
  return toks
}

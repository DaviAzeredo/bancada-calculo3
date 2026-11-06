import type { Vista } from './lang/resolve'
import type { EstadoSalvo, OpcLinha } from './store'

const CHAVE = 'bancada-calculo3'
const MAX_LINHAS = 64
const MAX_FONTE = 2000
const NCORES = 8

/** Nada de fórmula aqui abre URL: num link alheio, esses comandos só podem ser armadilha. */
const PERIGOSOS = /\\(href|url|includegraphics|html|class|style|cssId|data)\b/i

const num = (v: unknown, lo: number, hi: number): number | undefined => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : undefined)

function saneiaOpc(o: unknown): OpcLinha {
  if (typeof o !== 'object' || o === null) return {}
  const c = o as Record<string, unknown>
  const r: OpcLinha = {}
  const nums: [keyof OpcLinha, number, number][] = [['opacidade', 0.05, 1], ['nivel', -1e6, 1e6], ['densidade', 0.3, 2], ['min', -1e6, 1e6], ['max', -1e6, 1e6], ['passo', 1e-6, 1e6]]
  for (const [k, lo, hi] of nums) {
    const v = num(c[k], lo, hi)
    if (v !== undefined) (r as Record<string, unknown>)[k] = v
  }
  for (const k of ['grade', 'contornos', 'mapa', 'fluxo', 'particulas', 'setas', 'unitarias'] as const) {
    if (typeof c[k] === 'boolean') r[k] = c[k]
  }
  return r
}

function saneiaVista(v: unknown): Vista | null {
  if (typeof v !== 'object' || v === null) return null
  const c = v as Record<string, unknown>
  const eixo = (k: string): [number, number] | null => {
    const e = c[k]
    if (!Array.isArray(e) || e.length !== 2) return null
    const [a, b] = [num(e[0], -1e4, 1e4), num(e[1], -1e4, 1e4)]
    return a !== undefined && b !== undefined && b - a > 1e-3 ? [a, b] : null
  }
  const [x, y, z] = [eixo('x'), eixo('y'), eixo('z')]
  return x && y && z ? { x, y, z } : null
}

/** Tudo o que vem de fora (link, armazenamento) passa por aqui, campo a campo. */
export function saneia(bruto: unknown): EstadoSalvo | null {
  if (typeof bruto !== 'object' || bruto === null) return null
  const c = bruto as Record<string, unknown>
  if (!Array.isArray(c.linhas)) return null
  const vista = saneiaVista(c.vista)
  if (!vista) return null
  const linhas: EstadoSalvo['linhas'] = []
  for (const l of c.linhas.slice(0, MAX_LINHAS)) {
    if (typeof l !== 'object' || l === null) continue
    const x = l as Record<string, unknown>
    if (typeof x.fonte !== 'string' || x.fonte.length > MAX_FONTE || PERIGOSOS.test(x.fonte)) continue
    linhas.push({
      fonte: x.fonte,
      visivel: x.visivel !== false,
      cor: Number.isInteger(x.cor) && (x.cor as number) >= 0 && (x.cor as number) < NCORES ? (x.cor as number) : 0,
      opc: saneiaOpc(x.opc),
    })
  }
  return { linhas, vista, titulo: typeof c.titulo === 'string' ? c.titulo.slice(0, 80) : undefined }
}

const paraBase64Url = (s: string) => {
  const b = new TextEncoder().encode(s)
  let t = ''
  for (const c of b) t += String.fromCharCode(c)
  return btoa(t).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

const deBase64Url = (s: string) => {
  const t = atob(s.replaceAll('-', '+').replaceAll('_', '/'))
  return new TextDecoder().decode(Uint8Array.from(t, (c) => c.charCodeAt(0)))
}

export const linkDe = (e: EstadoSalvo) => `${location.origin}${location.pathname}#c=${paraBase64Url(JSON.stringify(e))}`

export function decodifica(hash: string): EstadoSalvo | null {
  const m = /^#c=([A-Za-z0-9_-]{1,200000})$/.exec(hash)
  if (!m) return null
  try {
    return saneia(JSON.parse(deBase64Url(m[1])))
  } catch {
    return null
  }
}

export function lerCompartilhado(): EstadoSalvo | null {
  if (typeof location === 'undefined') return null
  return decodifica(location.hash)
}

export function lerSalvo(): EstadoSalvo | null {
  try {
    const t = localStorage.getItem(CHAVE)
    return t ? saneia(JSON.parse(t)) : null
  } catch {
    return null
  }
}

let pendente: ReturnType<typeof setTimeout> | undefined
export function salvar(e: EstadoSalvo) {
  clearTimeout(pendente)
  pendente = setTimeout(() => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(e))
    } catch {
      // sem armazenamento, o trabalho vale só nesta visita
    }
  }, 400)
}

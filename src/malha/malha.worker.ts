import { type Entrada, type Vista, resolve } from '../lang/resolve'
import { type Feito, type Opcoes, QUALIDADE, assinatura, constroi } from './malhas'

export type PedidoMalha = {
  seq: number
  entradas: (Entrada & { visivel: boolean; opc: Opcoes })[]
  vista: Vista
  qualidade: keyof typeof QUALIDADE
}

export type RespostaMalha =
  | { tipo: 'peca'; seq: number; chave: string; id: string; feitos: Feito[] }
  | { tipo: 'fim'; seq: number; vivas: string[] }

const feitas = new Map<string, string>()

function transferiveis(f: Feito): ArrayBuffer[] {
  const b = (a: Float32Array | Uint32Array) => a.buffer as ArrayBuffer
  switch (f.tipo) {
    case 'sup': return [b(f.pos), b(f.nor), b(f.uv), b(f.idx)]
    case 'setas': return [b(f.pos), b(f.dir), b(f.mag)]
    case 'linhas': return [b(f.seg), b(f.val)]
    case 'marcas': return []
  }
}

/** Desenhos que viram superfície: são eles que somam centenas de milhares de triângulos. */
const SUPERFICIES = new Set(['grafico', 'param', 'implicita', 'desigualdade', 'solido', 'escalar'])
/** Até tantas superfícies na resolução cheia; acima disso, o total de triângulos fica parado. */
const SUP_CHEIAS = 4

self.onmessage = (ev: MessageEvent<PedidoMalha>) => {
  const { seq, entradas, vista, qualidade } = ev.data
  const r = resolve(entradas, vista)
  // orçamento de triângulos: a grade de cada superfície encolhe com a raiz do número delas
  const nSup = r.analises.reduce((n, a, i) => (entradas[i].visivel && !a.erro && !a.faltando.length ? n + a.desenhos.filter((d) => SUPERFICIES.has(d.d)).length : n), 0)
  const f = Math.min(1, Math.sqrt(SUP_CHEIAS / Math.max(1, nSup)))
  const q0 = QUALIDADE[qualidade]
  const q = f < 1 ? { ...q0, grade: Math.max(24, Math.round(q0.grade * f)), implicita: Math.max(20, Math.round(q0.implicita * f)), desig: Math.max(20, Math.round(q0.desig * f)) } : q0
  const nivel = `${qualidade}${f < 1 ? `@${q.grade}` : ''}`
  const vivas: string[] = []
  r.analises.forEach((a, i) => {
    const e = entradas[i]
    if (!e.visivel || a.erro || a.faltando.length) return
    a.desenhos.forEach((d, k) => {
      const chave = `${a.id}#${k}`
      vivas.push(chave)
      const sig = `${assinatura(d, r.numeros)}|${JSON.stringify(vista)}|${nivel}|${JSON.stringify(e.opc)}`
      if (feitas.get(chave) === sig) return
      feitas.set(chave, sig)
      try {
        const feitos = constroi(d, { nums: r.numeros, vista, q, opc: e.opc })
        const msg: RespostaMalha = { tipo: 'peca', seq, chave, id: a.id, feitos }
        self.postMessage(msg, { transfer: feitos.flatMap(transferiveis) })
      } catch (err) {
        console.error('malha', chave, err)
        const msg: RespostaMalha = { tipo: 'peca', seq, chave, id: a.id, feitos: [] }
        self.postMessage(msg)
      }
    })
  })
  for (const k of feitas.keys()) if (!vivas.includes(k)) feitas.delete(k)
  const fim: RespostaMalha = { tipo: 'fim', seq, vivas }
  self.postMessage(fim)
}

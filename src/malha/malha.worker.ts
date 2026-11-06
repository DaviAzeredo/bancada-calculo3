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

self.onmessage = (ev: MessageEvent<PedidoMalha>) => {
  const { seq, entradas, vista, qualidade } = ev.data
  const r = resolve(entradas, vista)
  const q = QUALIDADE[qualidade]
  const vivas: string[] = []
  r.analises.forEach((a, i) => {
    const e = entradas[i]
    if (!e.visivel || a.erro || a.faltando.length) return
    a.desenhos.forEach((d, k) => {
      const chave = `${a.id}#${k}`
      vivas.push(chave)
      const sig = `${assinatura(d, r.numeros)}|${JSON.stringify(vista)}|${qualidade}|${JSON.stringify(e.opc)}`
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

import type { Resultado } from '../lang/calculos'
import { type Entrada, type Vista, resolve } from '../lang/resolve'

export type PedidoCalculo = { seq: number; entradas: Entrada[]; vista: Vista }
export type RespostaCalculo = { seq: number; id: string; resultado: Resultado }

const feitos = new Map<string, string>()

/**
 * Worker próprio: uma tripla difícil ou Lagrange em 3D pode levar um segundo, e os
 * controles deslizantes e as malhas não podem esperar por isso.
 */
self.onmessage = (ev: MessageEvent<PedidoCalculo>) => {
  const { seq, entradas, vista } = ev.data
  const r = resolve(entradas, vista)
  const definicoes = entradas.map((e) => e.fonte).join('\n')
  r.analises.forEach((a) => {
    if (!a.calcula || a.erro || a.faltando.length) return
    const sig = `${definicoes}|${JSON.stringify(r.numeros)}|${JSON.stringify(vista)}`
    if (feitos.get(a.id) === sig) return
    feitos.set(a.id, sig)
    let resultado: Resultado
    try {
      resultado = a.calcula(r.numeros)
    } catch (err) {
      console.error('calculo', a.id, err)
      resultado = { rotulo: a.rotulo, formula: '', selo: 'falhou', aviso: 'Não consegui concluir esta conta.', passos: [] }
    }
    const msg: RespostaCalculo = { seq, id: a.id, resultado }
    self.postMessage(msg)
  })
}

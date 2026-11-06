import { create } from 'zustand'
import type { Feito, Opcoes } from './malha/malhas'
import type { PedidoMalha, RespostaMalha } from './malha/malha.worker'
import type { PedidoCalculo, RespostaCalculo } from './malha/calculo.worker'
import { type Linha, useBancada } from './store'

/** Peças prontas para a cena, por chave. O conjunto muda; cada peça é atualizada no lugar. */
type Pecas = { pecas: Record<string, { id: string; feitos: Feito[] }>; prontas: boolean }
export const usePecas = create<Pecas>(() => ({ pecas: {}, prontas: false }))

const opcoesDe = (l: Linha): Opcoes => ({ nivel: l.opc.nivel, densidade: l.opc.densidade, linhasFluxo: l.opc.fluxo })

let malhaW: Worker | null = null
let calculoW: Worker | null = null
let seq = 0
let emVoo = false
let pendente: PedidoMalha['qualidade'] | null = null
let refino: ReturnType<typeof setTimeout> | undefined
let debounceCalculo: ReturnType<typeof setTimeout> | undefined
let seqCalc = 0

function enviaMalha(qualidade: PedidoMalha['qualidade']) {
  if (!malhaW) return
  if (emVoo) {
    pendente = qualidade
    return
  }
  emVoo = true
  const { linhas, vista } = useBancada.getState()
  const pedido: PedidoMalha = {
    seq: ++seq,
    vista,
    qualidade,
    entradas: linhas.map((l) => ({ id: l.id, fonte: l.fonte, visivel: l.visivel, opc: opcoesDe(l) })),
  }
  malhaW.postMessage(pedido)
}

function aoMudar() {
  const baixo = navigator.hardwareConcurrency <= 4
  const alta: PedidoMalha['qualidade'] = baixo ? 'media' : 'alta'
  clearTimeout(refino)
  if (useBancada.getState().arrastando || Object.values(useBancada.getState().animando).some(Boolean)) {
    enviaMalha(baixo ? 'baixa' : 'media')
    refino = setTimeout(() => enviaMalha(alta), 180)
  } else enviaMalha(alta)
}

function enviaCalculo() {
  if (!calculoW) return
  clearTimeout(debounceCalculo)
  debounceCalculo = setTimeout(() => {
    const { linhas, vista, resolvido } = useBancada.getState()
    const st = useBancada.getState()
    for (const a of resolvido.analises) {
      if (a.calcula && !a.erro && !a.faltando.length && !st.resultados[a.id]) st.setResultado(a.id, 'calculando')
    }
    const pedido: PedidoCalculo = { seq: ++seqCalc, vista, entradas: linhas.map(({ id, fonte }) => ({ id, fonte })) }
    calculoW!.postMessage(pedido)
  }, 140)
}

export function ligaMotor() {
  if (malhaW) return
  malhaW = new Worker(new URL('./malha/malha.worker.ts', import.meta.url), { type: 'module' })
  calculoW = new Worker(new URL('./malha/calculo.worker.ts', import.meta.url), { type: 'module' })

  malhaW.onmessage = (ev: MessageEvent<RespostaMalha>) => {
    const m = ev.data
    if (m.tipo === 'peca') {
      usePecas.setState((s) => ({ pecas: { ...s.pecas, [m.chave]: { id: m.id, feitos: m.feitos } } }))
      return
    }
    emVoo = false
    usePecas.setState((s) => {
      const vivas = new Set(m.vivas)
      const pecas = Object.fromEntries(Object.entries(s.pecas).filter(([k]) => vivas.has(k)))
      return { pecas, prontas: true }
    })
    if (pendente) {
      const q = pendente
      pendente = null
      enviaMalha(q)
    }
  }
  calculoW.onmessage = (ev: MessageEvent<RespostaCalculo>) => {
    useBancada.getState().setResultado(ev.data.id, ev.data.resultado)
  }

  useBancada.subscribe((s, ant) => {
    if (s.linhas !== ant.linhas || s.vista !== ant.vista) {
      aoMudar()
      if (s.linhas.map((l) => l.fonte).join('\n') !== ant.linhas.map((l) => l.fonte).join('\n') || s.vista !== ant.vista) enviaCalculo()
    }
    if (ant.arrastando && !s.arrastando) aoMudar()
  })
  aoMudar()
  enviaCalculo()
  ligaAnimacao()
}

/** Controles em animação: vaivém entre mínimo e máximo, em ritmo de cerca de 6 s por volta. */
function ligaAnimacao() {
  const sentido: Record<string, number> = {}
  let ultimo = performance.now()
  const passo = (t: number) => {
    const dt = Math.min(t - ultimo, 100) / 1000
    ultimo = t
    const st = useBancada.getState()
    for (const [id, on] of Object.entries(st.animando)) {
      if (!on) continue
      const l = st.linhas.find((x) => x.id === id)
      const a = st.resolvido.analises.find((x) => x.id === id)
      if (!l || !a?.numero) continue
      const min = l.opc.min ?? -5
      const max = l.opc.max ?? 5
      const s = sentido[id] ?? 1
      let v = a.numero.valor + (s * (max - min) * dt) / 6
      if (v >= max) {
        v = max
        sentido[id] = -1
      } else if (v <= min) {
        v = min
        sentido[id] = 1
      }
      st.numero(id, v)
    }
    requestAnimationFrame(passo)
  }
  requestAnimationFrame(passo)
}

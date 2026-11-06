import { create } from 'zustand'

/** Fica fora de Viewport.tsx: a barra de ferramentas não pode puxar o three para a primeira tela. */
export type Pedido = 'iso' | 'topo' | 'frente' | 'lado' | 'ajusta'
export type Medida = { fps: number; gpu: string; triangulos: number; dpr: number; largura: number; altura: number }
type Hud = { cursor: [number, number, number] | null; pedido: { tipo: Pedido; n: number } | null; capturar: (() => void) | null; medida: Medida | null }
export const useHud = create<Hud>(() => ({ cursor: null, pedido: null, capturar: null, medida: null }))

/** `?fps` no endereço liga o medidor: a cena passa a desenhar sem parar, para medir a capacidade. */
export const MEDIR = typeof location !== 'undefined' && new URLSearchParams(location.search).has('fps')
/** `?fps=sync` lê um pixel depois de cada quadro: o tempo passa a incluir o trabalho da placa. */
export const SINCRONO = MEDIR && new URLSearchParams(location.search).get('fps') === 'sync'
export const pedeVisao = (tipo: Pedido) => useHud.setState((s) => ({ pedido: { tipo, n: (s.pedido?.n ?? 0) + 1 } }))

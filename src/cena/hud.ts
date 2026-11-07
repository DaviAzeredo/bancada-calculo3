import { create } from 'zustand'

/** Fica fora de Viewport.tsx: a barra de ferramentas não pode puxar o three para a primeira tela. */
export type Pedido = 'iso' | 'topo' | 'frente' | 'lado' | 'ajusta'
export type Medida = { fps: number; gpu: string; triangulos: number; dpr: number; largura: number; altura: number }
/** `densidade` é a do controle de ritmo; ela vai como prop do Canvas, senão a R3F a desfaz a cada render. */
type Hud = { cursor: [number, number, number] | null; pedido: { tipo: Pedido; n: number } | null; capturar: (() => void) | null; medida: Medida | null; densidade: number | null }
export const useHud = create<Hud>(() => ({ cursor: null, pedido: null, capturar: null, medida: null, densidade: null }))

/** `?fps` no endereço liga o medidor: a cena passa a desenhar sem parar, para medir a capacidade. */
export const MEDIR = typeof location !== 'undefined' && new URLSearchParams(location.search).has('fps')
/** `?fps=sync` lê um pixel depois de cada quadro: o tempo passa a incluir o trabalho da placa. */
export const SINCRONO = MEDIR && new URLSearchParams(location.search).get('fps') === 'sync'
/**
 * Só para medir sem vsync: `?alvo=120` diz ao controle de ritmo que a tela é de 120 Hz. Sem ele,
 * o ritmo da tela é estimado pelos quadros mais rápidos.
 */
export const ALVO = typeof location !== 'undefined' ? Number(new URLSearchParams(location.search).get('alvo')) || 0 : 0
/** Só para medir: `?fps&ritmo=0` desliga o controle de ritmo e fixa a densidade. */
export const SEM_RITMO = MEDIR && new URLSearchParams(location.search).get('ritmo') === '0'
/** Só para medir: `?fps&aa=0` desliga o antisserrilhado da placa. */
export const SEM_AA = MEDIR && new URLSearchParams(location.search).get('aa') === '0'
export const pedeVisao = (tipo: Pedido) => useHud.setState((s) => ({ pedido: { tipo, n: (s.pedido?.n ?? 0) + 1 } }))

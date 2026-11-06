import { create } from 'zustand'

/** Fica fora de Viewport.tsx: a barra de ferramentas não pode puxar o three para a primeira tela. */
export type Pedido = 'iso' | 'topo' | 'frente' | 'lado' | 'ajusta'
type Hud = { cursor: [number, number, number] | null; pedido: { tipo: Pedido; n: number } | null; capturar: (() => void) | null }
export const useHud = create<Hud>(() => ({ cursor: null, pedido: null, capturar: null }))
export const pedeVisao = (tipo: Pedido) => useHud.setState((s) => ({ pedido: { tipo, n: (s.pedido?.n ?? 0) + 1 } }))

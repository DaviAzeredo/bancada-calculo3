import { create } from 'zustand'
import { type Analise, type Resolvido, type Vista, resolve } from './lang/resolve'
import type { Resultado } from './lang/calculos'
import { lerCompartilhado, lerSalvo, salvar } from './compartilha'

export const CORES = ['#5aa2f0', '#f29a56', '#4fcb9d', '#ea74ad', '#a88cf2', '#e6c757', '#52c4d8', '#ef7070']

export type OpcLinha = {
  opacidade?: number
  grade?: boolean
  contornos?: boolean
  mapa?: boolean
  nivel?: number
  densidade?: number
  fluxo?: boolean
  particulas?: boolean
  setas?: boolean
  unitarias?: boolean
  min?: number
  max?: number
  passo?: number
}

export type Linha = { id: string; fonte: string; visivel: boolean; cor: number; opc: OpcLinha }
export type Cena = { eixos: boolean; grade: boolean; caixa: boolean; rotulos: boolean; giro: boolean }
export type Tema = 'escuro' | 'claro'
export type EstadoSalvo = { linhas: Omit<Linha, 'id'>[]; vista: Vista; titulo?: string }

let contador = 0
export const novoId = () => `l${++contador}`

export const VISTA_PADRAO: Vista = { x: [-5, 5], y: [-5, 5], z: [-5, 5] }

function criar(fonte: string, cor: number, opc: OpcLinha = {}): Linha {
  return { id: novoId(), fonte, visivel: true, cor, opc }
}

const INICIO: EstadoSalvo = {
  titulo: 'Sela e plano tangente',
  vista: { x: [-3, 3], y: [-3, 3], z: [-3, 3] },
  linhas: [
    { fonte: 'f(x,y)=\\frac{x^2-y^2}{3}', visivel: true, cor: 0, opc: { contornos: true } },
    { fonte: '\\operatorname{tangente}\\left(f,a,b\\right)', visivel: true, cor: 1, opc: { opacidade: 0.72 } },
    { fonte: 'a=1.5', visivel: true, cor: 1, opc: { min: -3, max: 3 } },
    { fonte: 'b=1', visivel: true, cor: 2, opc: { min: -3, max: 3 } },
  ],
}

type Estado = {
  linhas: Linha[]
  vista: Vista
  resolvido: Resolvido
  resultados: Record<string, Resultado | 'calculando'>
  selecionada: string | null
  arrastando: boolean
  animando: Record<string, boolean>
  cena: Cena
  tema: Tema
  titulo: string
  focoEm: string | null
  aviso: string | null
  faixas: Record<string, [number, number]>

  atualiza(id: string, fonte: string): void
  adiciona(fonte?: string, depoisDe?: string | null, opc?: OpcLinha): string
  adicionaVarias(fontes: { fonte: string; opc?: OpcLinha }[], depoisDe?: string | null): void
  remove(id: string): void
  move(id: string, delta: number): void
  alterna(id: string): void
  opcoes(id: string, o: Partial<OpcLinha>): void
  cor(id: string, cor: number): void
  numero(id: string, valor: number): void
  seleciona(id: string | null): void
  setArrastando(v: boolean): void
  anima(id: string, v: boolean): void
  setVista(v: Vista): void
  setCena(c: Partial<Cena>): void
  setTema(t: Tema): void
  carrega(e: EstadoSalvo): void
  limpa(): void
  setResultado(id: string, r: Resultado | 'calculando'): void
  setFoco(id: string | null): void
  setAviso(a: string | null): void
  setFaixa(id: string, f: [number, number]): void
}

const paraEntradas = (ls: Linha[]) => ls.map(({ id, fonte }) => ({ id, fonte }))

function materializa(e: EstadoSalvo): { linhas: Linha[]; vista: Vista; titulo: string } {
  const linhas = e.linhas.map((l) => ({ ...l, id: novoId() }))
  return { linhas, vista: e.vista, titulo: e.titulo ?? '' }
}

const inicial = materializa(lerCompartilhado() ?? lerSalvo() ?? INICIO)
if (!inicial.linhas.length) inicial.linhas.push(criar('', 0))

const temaInicial = (): Tema => {
  try {
    const t = localStorage.getItem('bancada-calculo3-tema')
    if (t === 'claro' || t === 'escuro') return t
  } catch {
    // armazenamento bloqueado: fica o padrão
  }
  return 'escuro'
}

function proximaCor(ls: Linha[]) {
  const usados = ls.map((l) => l.cor)
  for (let i = 0; i < CORES.length; i++) if (!usados.includes(i)) return i
  return ls.length % CORES.length
}

export const useBancada = create<Estado>((set, get) => {
  const comLinhas = (linhas: Linha[], extra: Partial<Estado> = {}) => set({ linhas, resolvido: resolve(paraEntradas(linhas), get().vista), ...extra })
  return {
    ...inicial,
    resolvido: resolve(paraEntradas(inicial.linhas), inicial.vista),
    resultados: {},
    selecionada: null,
    arrastando: false,
    animando: {},
    cena: { eixos: true, grade: true, caixa: true, rotulos: true, giro: false },
    tema: temaInicial(),
    focoEm: null,
    aviso: null,
    faixas: {},

    atualiza: (id, fonte) => comLinhas(get().linhas.map((l) => (l.id === id ? { ...l, fonte } : l))),
    adiciona: (fonte = '', depoisDe = null, opc = {}) => {
      const ls = get().linhas
      const nova = criar(fonte, proximaCor(ls), opc)
      const i = depoisDe ? ls.findIndex((l) => l.id === depoisDe) : ls.length - 1
      const novas = [...ls.slice(0, i + 1), nova, ...ls.slice(i + 1)]
      comLinhas(novas, { focoEm: fonte ? null : nova.id, selecionada: nova.id })
      return nova.id
    },
    adicionaVarias: (fontes, depoisDe = null) => {
      let ls = get().linhas
      let ult = depoisDe
      for (const { fonte, opc } of fontes) {
        const nova = criar(fonte, proximaCor(ls), opc)
        const i = ult ? ls.findIndex((l) => l.id === ult) : ls.length - 1
        ls = [...ls.slice(0, i + 1), nova, ...ls.slice(i + 1)]
        ult = nova.id
      }
      comLinhas(ls, { selecionada: ult })
    },
    remove: (id) => {
      const ls = get().linhas.filter((l) => l.id !== id)
      comLinhas(ls.length ? ls : [criar('', 0)], { selecionada: null })
    },
    move: (id, delta) => {
      const ls = [...get().linhas]
      const i = ls.findIndex((l) => l.id === id)
      const j = i + delta
      if (i < 0 || j < 0 || j >= ls.length) return
      ;[ls[i], ls[j]] = [ls[j], ls[i]]
      comLinhas(ls)
    },
    alterna: (id) => set({ linhas: get().linhas.map((l) => (l.id === id ? { ...l, visivel: !l.visivel } : l)) }),
    opcoes: (id, o) => set({ linhas: get().linhas.map((l) => (l.id === id ? { ...l, opc: { ...l.opc, ...o } } : l)) }),
    cor: (id, cor) => set({ linhas: get().linhas.map((l) => (l.id === id ? { ...l, cor } : l)) }),
    numero: (id, valor) => {
      comLinhas(get().linhas.map((l) => {
        if (l.id !== id) return l
        const i = l.fonte.indexOf('=')
        return i < 0 ? l : { ...l, fonte: `${l.fonte.slice(0, i + 1)}${Number(valor.toFixed(6))}` }
      }))
    },
    seleciona: (id) => set({ selecionada: id }),
    setArrastando: (v) => set({ arrastando: v }),
    anima: (id, v) => set({ animando: { ...get().animando, [id]: v } }),
    setVista: (vista) => {
      set({ vista })
      comLinhas(get().linhas)
    },
    setCena: (c) => set({ cena: { ...get().cena, ...c } }),
    setTema: (tema) => {
      try {
        localStorage.setItem('bancada-calculo3-tema', tema)
      } catch {
        // sem armazenamento, vale só nesta visita
      }
      set({ tema })
    },
    carrega: (e) => {
      const m = materializa(e)
      set({ vista: m.vista, titulo: m.titulo, resultados: {}, animando: {}, faixas: {} })
      comLinhas(m.linhas.length ? m.linhas : [criar('', 0)], { selecionada: null })
    },
    limpa: () => {
      set({ titulo: '', resultados: {}, animando: {} })
      comLinhas([criar('', 0)], { selecionada: null })
    },
    setResultado: (id, r) => set({ resultados: { ...get().resultados, [id]: r } }),
    setFoco: (focoEm) => set({ focoEm }),
    setAviso: (aviso) => set({ aviso }),
    setFaixa: (id, f) => set({ faixas: { ...get().faixas, [id]: f } }),
  }
})

export const analiseDe = (r: Resolvido, id: string): Analise | undefined => r.analises.find((a) => a.id === id)

useBancada.subscribe((s, ant) => {
  if (s.linhas !== ant.linhas || s.vista !== ant.vista) salvar({ linhas: s.linhas.map(({ fonte, visivel, cor, opc }) => ({ fonte, visivel, cor, opc })), vista: s.vista, titulo: s.titulo })
})

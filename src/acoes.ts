import type { Analise, Resolvido } from './lang/resolve'
import type { Linha, OpcLinha } from './store'

export type Acao = {
  rotulo: string
  /** Linhas novas; o nome do objeto entra no lugar de @. */
  linhas: { fonte: string; opc?: OpcLinha }[]
  dica: string
}

const op = (n: string) => `\\operatorname{${n}}`
const LETRAS = ['a', 'b', 'c', 'h', 'k', 'm', 'p', 'q', 's']

function livres(r: Resolvido, n: number) {
  const usados = new Set([...Object.keys(r.numeros), ...r.funcoes.keys()])
  return LETRAS.filter((l) => !usados.has(l)).slice(0, n)
}

const deslizante = (n: string, v: number, min = -3, max = 3) => ({ fonte: `${n}=${v}`, opc: { min, max } })

/** O que faz sentido oferecer para cada tipo de linha. */
export function acoesDe(a: Analise, r: Resolvido): Acao[] {
  const nome = a.nome ?? ''
  const fn = nome ? r.funcoes.get(nome) : undefined
  const params = fn?.params.length ?? 0
  const acoes: Acao[] = []
  const add = (rotulo: string, linhas: Acao['linhas'], dica: string) => acoes.push({ rotulo, linhas, dica })
  if (a.tipo === 'funcao' && nome && params === 2) {
    const [p, q] = livres(r, 2)
    add('Plano tangente', [deslizante(p, 1), deslizante(q, 0.5), { fonte: `${op('tangente')}\\left(${nome},${p},${q}\\right)`, opc: { opacidade: 0.75 } }], 'Plano e normal num ponto que você move')
    add('Gradiente', [{ fonte: `${op('grad')}\\left(${nome}\\right)` }], 'Campo gradiente e sua fórmula')
    add('Curvas de nível', [{ fonte: `${op('curvas')}\\left(${nome}\\right)` }], 'Projetadas no piso da caixa')
    add('Pontos críticos', [{ fonte: `${op('criticos')}\\left(${nome}\\right)` }], 'Com teste da segunda derivada')
    add('Hessiana', [{ fonte: `${op('hessiana')}\\left(${nome}\\right)` }], 'Matriz das segundas derivadas')
    add('Taylor de ordem 2', [deslizante(p, 0.5), deslizante(q, 0.5), { fonte: `${op('taylor')}\\left(${nome},${p},${q}\\right)`, opc: { opacidade: 0.6 } }], 'Quádrica que aproxima a superfície')
  }
  if (a.tipo === 'escalar' && nome) {
    add('Gradiente', [{ fonte: `${op('grad')}\\left(${nome}\\right)` }], 'Campo normal às superfícies de nível')
    add('Laplaciano', [{ fonte: `${op('lap')}\\left(${nome}\\right)` }], 'Divergente do gradiente')
    add('Pontos críticos', [{ fonte: `${op('criticos')}\\left(${nome}\\right)` }], 'Em três variáveis')
  }
  if (a.tipo === 'campo' && nome) {
    add('Divergente', [{ fonte: `${op('div')}\\left(${nome}\\right)` }], 'Fonte ou sumidouro em cada ponto')
    add('Rotacional', [{ fonte: `${op('rot')}\\left(${nome}\\right)` }], 'Tendência de giro em cada ponto')
    add('Potencial', [{ fonte: `${op('potencial')}\\left(${nome}\\right)` }], 'Testa se é conservativo e integra')
    const [p, q] = livres(r, 2)
    add('Sonda de rotacional', [deslizante(p, 1), deslizante(q, 0), { fonte: `${op('sonda')}\\left(${nome},${p},${q},0\\right)` }], 'Pá que gira com o campo')
  }
  if (a.tipo === 'curva' && nome) {
    const [p] = livres(r, 1)
    add('Comprimento', [{ fonte: `${op('comprimento')}\\left(${nome}\\right)` }], 'Integral de |r′|')
    add('Curvatura', [{ fonte: `${op('curvatura')}\\left(${nome}\\right)` }], 'Fórmula de κ')
    add('Torção', [{ fonte: `${op('torcao')}\\left(${nome}\\right)` }], 'Fórmula de τ')
    add('Triedro de Frenet', [deslizante(p, 1, 0, 6.28), { fonte: `${op('frenet')}\\left(${nome},${p}\\right)` }], 'T, N e B num ponto móvel')
  }
  if (a.tipo === 'superficie' && nome && (r.superficies.has(nome))) {
    add('Área', [{ fonte: `${op('area')}\\left(${nome}\\right)` }], 'Integral de |Sᵤ × Sᵥ|')
  }
  if (a.tipo === 'regiao' && nome && r.regioes.has(nome)) {
    const reg = r.regioes.get(nome)!
    const dim = reg.lim.length
    add(dim === 2 ? 'Área' : 'Volume', [{ fonte: `${op(dim === 2 ? 'area' : 'volume')}\\left(${nome}\\right)` }], 'Integral da região, com o jacobiano')
    add('Centro de massa', [{ fonte: `${op('centroide')}\\left(${nome}\\right)` }], 'Densidade 1; dá para passar outra')
    const [p] = livres(r, 1)
    add('Fatia', [deslizante(p, 0.5), { fonte: `${op('fatia')}\\left(${nome},${p}\\right)` }], 'Seção móvel e limites de dentro')
  }
  return acoes
}

/** Linha do tipo z = … ganha um nome para poder usar as ações. */
export function comoFuncao(l: Linha): string | null {
  const m = /^\s*z\s*=(.+)$/.exec(l.fonte)
  return m ? `f(x,y)=${m[1]}` : null
}

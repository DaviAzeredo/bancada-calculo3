import { EXEMPLOS, type Exemplo } from './exemplos'

/** Item do guia: como aparece, o que entra na lista ao clicar, o que é, e palavras que o aluno pesquisaria. */
export type ItemGuia = { tex: string; fonte: string; desc: string; chaves?: string }
export type TemaGuia = { tema: string; itens: ItemGuia[] }

const op = (n: string, args: string) => `\\operatorname{${n}}\\left(${args}\\right)`

export const GUIA: TemaGuia[] = [
  {
    tema: 'Básico',
    itens: [
      { tex: 'f(x,y) = \\sin x', fonte: 'f(x,y)=\\sin x', desc: 'Função com nome, usável nas outras expressões', chaves: 'funcao definir nome duas variaveis' },
      { tex: 'a = 2', fonte: 'a=2', desc: 'Controle deslizante, com animação', chaves: 'parametro slider variar animar constante numero' },
      { tex: 'P = (1, 2, 3)', fonte: 'P=\\left(1,2,3\\right)', desc: 'Maiúscula é ponto, minúscula é vetor', chaves: 'ponto vetor coordenadas' },
    ],
  },
  {
    tema: 'Superfícies',
    itens: [
      { tex: 'z = x^2 - y^2', fonte: 'z=x^2-y^2', desc: 'Gráfico explícito (também x = … e y = …)', chaves: 'grafico explicito superficie funcao sela paraboloide' },
      { tex: 'x^2+y^2+z^2=4', fonte: 'x^2+y^2+z^2=4', desc: 'Superfície implícita', chaves: 'implicita esfera quadrica elipsoide hiperboloide cone cilindro plano' },
      { tex: 'g(x,y,z) = x^2+y^2+z^2', fonte: 'g(x,y,z)=x^2+y^2+z^2', desc: 'Campo escalar, com superfícies de nível', chaves: 'nivel isosuperficie tres variaveis escalar' },
      { tex: 'S(u,v) = (u, v, uv)', fonte: 'S(u,v)=\\left(u,v,uv\\right),\\ -1\\le u\\le1,\\ -1\\le v\\le1', desc: 'Paramétrica, com domínio após a vírgula', chaves: 'parametrizacao parametrica superficie dominio' },
      { tex: 'z = r^2', fonte: 'z=r^2', desc: 'Cilíndricas: r, θ', chaves: 'cilindricas polares coordenadas theta' },
      { tex: '\\rho = 2', fonte: '\\rho=2', desc: 'Esféricas: ρ, θ, φ', chaves: 'esfericas coordenadas rho phi theta esfera' },
    ],
  },
  {
    tema: 'Curvas e campos',
    itens: [
      { tex: 'r(t) = (\\cos t, \\sin t, t)', fonte: 'r(t)=\\left(\\cos t,\\sin t,t\\right)', desc: 'Curva paramétrica', chaves: 'curva parametrica parametrizacao helice trajetoria' },
      { tex: 'L(t) = (1,2,3) + t(1,0,1)', fonte: 'L(t)=\\left(1,2,3\\right)+t\\left(1,0,1\\right)', desc: 'Reta por um ponto, com direção', chaves: 'reta parametrica vetor diretor' },
      { tex: 'B(t) = (1-t)P + tQ', fonte: 'B(t)=\\left(1-t\\right)\\left(1,0\\right)+t\\left(0,1\\right),\\ 0\\le t\\le1', desc: 'Segmento de P a Q, com t de 0 a 1', chaves: 'segmento reta pedaco parametrizacao contorno' },
      { tex: 'F(x,y,z) = (y, -x, z)', fonte: 'F(x,y,z)=\\left(y,-x,z\\right)', desc: 'Campo vetorial', chaves: 'campo vetorial setas linhas de fluxo particulas' },
      { tex: 'F = y\\,\\mathbf{i} - x\\,\\mathbf{j}', fonte: 'F=y\\mathbf{i}-x\\mathbf{j}', desc: 'Notação i, j, k', chaves: 'campo vetorial versores ijk' },
    ],
  },
  {
    tema: 'Regiões',
    itens: [
      { tex: 'R: 0 \\le x \\le 1,\\ 0 \\le y \\le x', fonte: 'R:0\\le x\\le1,\\ 0\\le y\\le x', desc: 'Região plana iterada', chaves: 'regiao dupla limites tipo I tipo II' },
      { tex: 'R: 1 \\le r \\le 2,\\ 0 \\le \\theta \\le \\pi', fonte: 'R:1\\le r\\le2,\\ 0\\le\\theta\\le\\pi', desc: 'Região em polares', chaves: 'polares coroa anel setor jacobiano dupla' },
      { tex: 'E: 0 \\le r \\le 1,\\ 0 \\le \\theta \\le 2\\pi,\\ 0 \\le z \\le 2', fonte: 'E:0\\le r\\le1,\\ 0\\le\\theta\\le2\\pi,\\ 0\\le z\\le2', desc: 'Sólido em cilíndricas', chaves: 'cilindricas cilindro solido tripla' },
      { tex: 'E: 0 \\le \\rho \\le 1,\\ 0 \\le \\varphi \\le \\pi,\\ 0 \\le \\theta \\le 2\\pi', fonte: 'E:0\\le\\rho\\le1,\\ 0\\le\\varphi\\le\\pi,\\ 0\\le\\theta\\le2\\pi', desc: 'Sólido em esféricas', chaves: 'esfericas esfera bola solido tripla' },
      { tex: 'x^2+y^2 \\le z \\le 4', fonte: 'x^2+y^2\\le z\\le4', desc: 'Região por desigualdades', chaves: 'desigualdades solido inequacao' },
      { tex: 'z = x^2 \\{x^2+y^2 \\le 1\\}', fonte: 'z=x^2\\left\\lbrace x^2+y^2\\le1\\right\\rbrace', desc: 'Restrição entre chaves', chaves: 'restricao recorte dominio' },
    ],
  },
  {
    tema: 'Integrais',
    itens: [
      { tex: '\\int_0^1\\int_0^x xy\\,dy\\,dx', fonte: '\\int_0^1\\int_0^xxy\\,dy\\,dx', desc: 'Iterada: desenha o sólido', chaves: 'integral dupla tripla iterada volume limites' },
      { tex: '\\iint_R f\\,dA', fonte: '\\iint_{R}f\\,dA', desc: 'Sobre região com nome', chaves: 'integral dupla regiao area' },
      { tex: '\\iiint_E f\\,dV', fonte: '\\iiint_{E}f\\,dV', desc: 'Com jacobiano automático', chaves: 'integral tripla volume massa solido' },
      { tex: '\\int_0^\\infty e^{-x}\\,dx', fonte: '\\int_0^{\\infty}e^{-x}\\,dx', desc: 'Imprópria, com limite infinito', chaves: 'integral impropria infinito convergente divergente' },
      { tex: '\\oint_C \\mathbf{F}\\cdot d\\mathbf{r}', fonte: '\\oint_{C}F\\cdot dr', desc: 'Integral de linha', chaves: 'integral de linha trabalho circulacao campo curva fechada' },
      { tex: '\\oint_C -y\\,dx + x\\,dy', fonte: '\\oint_{C}-y\\,dx+x\\,dy', desc: 'Integral de linha na forma P dx + Q dy', chaves: 'integral de linha forma diferencial pdx qdy trabalho green' },
      { tex: '\\int_C f\\,ds', fonte: '\\int_{C}f\\,ds', desc: 'Integral de linha escalar', chaves: 'integral de linha escalar massa de fio comprimento arco' },
      { tex: '\\int_A \\mathbf{F}\\cdot d\\mathbf{r} + \\int_B \\mathbf{F}\\cdot d\\mathbf{r}', fonte: '\\int_{A}F\\cdot dr+\\int_{B}F\\cdot dr', desc: 'Contorno por pedaços: some as parcelas', chaves: 'integral de linha soma pedacos segmentos contorno trabalho' },
      { tex: '\\iint_S \\mathbf{F}\\cdot d\\mathbf{S}', fonte: '\\iint_{S}F\\cdot dS', desc: 'Fluxo por uma superfície', chaves: 'integral de superficie fluxo campo normal' },
      { tex: '\\iint_S f\\,dS', fonte: '\\iint_{S}f\\,dS', desc: 'Integral de superfície escalar', chaves: 'integral de superficie escalar area massa casca' },
    ],
  },
  {
    tema: 'Derivadas',
    itens: [
      { tex: '\\nabla f,\\ \\nabla\\cdot F,\\ \\nabla\\times F', fonte: op('grad', 'f'), desc: 'grad, div, rot, lap', chaves: 'gradiente divergente rotacional laplaciano nabla operadores' },
      { tex: '\\operatorname{tangente}(f, a, b)', fonte: op('tangente', 'f,a,b'), desc: 'Plano tangente e reta normal', chaves: 'plano tangente normal linearizacao' },
      { tex: '\\operatorname{direcional}(f, P, u)', fonte: op('direcional', 'f,\\left(1,0.5\\right),\\left(1,0\\right)'), desc: 'Derivada direcional num ponto', chaves: 'derivada direcional gradiente taxa de variacao' },
      { tex: '\\operatorname{criticos}(f)', fonte: op('criticos', 'f'), desc: 'Pontos críticos, com teste da segunda derivada', chaves: 'pontos criticos maximo minimo sela extremos hessiana' },
      { tex: '\\operatorname{lagrange}(f, g)', fonte: op('lagrange', 'f,g'), desc: 'Extremos de f com g = 0', chaves: 'multiplicadores lagrange restricao vinculo extremos maximo minimo' },
      { tex: '\\operatorname{taylor}(f, a, b)', fonte: op('taylor', 'f,a,b'), desc: 'Polinômio de Taylor de ordem 2', chaves: 'taylor aproximacao quadratica' },
      { tex: '\\operatorname{hessiana}(f)', fonte: op('hessiana', 'f'), desc: 'Matriz das segundas derivadas', chaves: 'hessiana segunda derivada matriz' },
      { tex: '\\operatorname{curvas}(f)', fonte: op('curvas', 'f'), desc: 'Curvas de nível no piso da caixa', chaves: 'curvas de nivel contorno mapa topografico' },
    ],
  },
  {
    tema: 'Curvas no espaço',
    itens: [
      { tex: '\\operatorname{comprimento}(r)', fonte: op('comprimento', 'r'), desc: 'Comprimento de arco', chaves: 'comprimento arco' },
      { tex: '\\operatorname{curvatura}(r)', fonte: op('curvatura', 'r'), desc: 'Curvatura, raio de curvatura e raio da hélice', chaves: 'curvatura kappa raio helice circulo osculador circunferencia' },
      { tex: '\\operatorname{torcao}(r)', fonte: op('torcao', 'r'), desc: 'Torção', chaves: 'torcao tau' },
      { tex: '\\operatorname{frenet}(r, q)', fonte: op('frenet', 'r,q'), desc: 'Triedro T, N e B num ponto móvel', chaves: 'frenet triedro tangente normal binormal' },
    ],
  },
  {
    tema: 'Campos e teoremas',
    itens: [
      { tex: '\\operatorname{potencial}(F)', fonte: op('potencial', 'F'), desc: 'Testa se é conservativo e acha o potencial', chaves: 'conservativo potencial independencia do caminho gradiente' },
      { tex: '\\operatorname{linha}(F, C)', fonte: op('linha', 'F,C'), desc: 'Integral de linha por comando', chaves: 'integral de linha trabalho circulacao' },
      { tex: '\\operatorname{fluxo}(F, S)', fonte: op('fluxo', 'F,S'), desc: 'Fluxo por comando', chaves: 'fluxo integral de superficie' },
      { tex: '\\operatorname{green}(F, R)', fonte: op('green', 'F,R'), desc: 'Teorema de Green: borda e região', chaves: 'teorema green circulacao rotacional plano' },
      { tex: '\\operatorname{stokes}(F, S)', fonte: op('stokes', 'F,S'), desc: 'Teorema de Stokes: borda e rotacional', chaves: 'teorema stokes circulacao rotacional superficie' },
      { tex: '\\operatorname{gauss}(F, E)', fonte: op('gauss', 'F,E'), desc: 'Teorema da divergência (Gauss)', chaves: 'teorema gauss divergencia fluxo solido' },
      { tex: '\\operatorname{sonda}(F, a, b, c)', fonte: op('sonda', 'F,a,b,0'), desc: 'Divergente e rotacional num ponto, com pá que gira', chaves: 'sonda ponto rotacional divergente pa roda' },
    ],
  },
  {
    tema: 'Regiões e sólidos',
    itens: [
      { tex: '\\operatorname{area}(S)', fonte: op('area', 'S'), desc: 'Área de superfície (ou de região plana)', chaves: 'area superficie regiao' },
      { tex: '\\operatorname{volume}(E)', fonte: op('volume', 'E'), desc: 'Volume do sólido, com o jacobiano', chaves: 'volume solido integral tripla' },
      { tex: '\\operatorname{massa}(E, z)', fonte: op('massa', 'E,z'), desc: 'Massa com densidade', chaves: 'massa densidade' },
      { tex: '\\operatorname{centroide}(E, z)', fonte: op('centroide', 'E,z'), desc: 'Centro de massa, com densidade opcional', chaves: 'centroide centro de massa baricentro densidade' },
      { tex: '\\operatorname{riemann}(f, R, n)', fonte: op('riemann', 'f,R,n'), desc: 'Soma de Riemann: colunas que convergem', chaves: 'soma riemann particao colunas aproximacao' },
      { tex: '\\operatorname{fatia}(E, c)', fonte: op('fatia', 'E,c'), desc: 'Seção móvel e limites de dentro', chaves: 'fatia secao corte limites de integracao' },
      { tex: '\\operatorname{jacobiano}((u+v, u-v), u, v)', fonte: op('jacobiano', '\\left(u+v,u-v\\right),u,v'), desc: 'Determinante da mudança de variáveis', chaves: 'jacobiano mudanca de variaveis determinante' },
    ],
  },
]

/** Minúsculas e sem acento: "Divergência" acha "divergencia". */
export const normaliza = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** Termos da busca; plural simples cai para o singular, para "derivadas" achar "derivada". */
function termos(q: string): string[] {
  return normaliza(q)
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w))
}

// o texto da fórmula entra sem os comandos LaTeX, senão "left" acharia meio guia
const semLatex = (s: string) => s.replace(/\\[a-zA-Z]+/g, ' ').replace(/[{}\\]/g, ' ')
const palheiroGuia = new Map<ItemGuia, string>()
for (const t of GUIA) for (const i of t.itens) palheiroGuia.set(i, normaliza(`${t.tema} ${i.desc} ${i.chaves ?? ''} ${semLatex(i.fonte)} ${semLatex(i.tex)}`))

const exemplos = EXEMPLOS.flatMap((t) => t.itens.map((e) => ({ e, palheiro: normaliza(`${t.tema} ${e.titulo} ${e.nota}`) })))

/** Temas com os itens que contêm todos os termos; sem termos, o guia inteiro. */
export function buscaGuia(q: string): TemaGuia[] {
  const ts = termos(q)
  if (!ts.length) return GUIA
  return GUIA.map((t) => ({ tema: t.tema, itens: t.itens.filter((i) => ts.every((w) => palheiroGuia.get(i)!.includes(w))) })).filter((t) => t.itens.length)
}

/** Exemplos prontos da galeria que respondem à mesma busca. */
export function buscaExemplos(q: string): Exemplo[] {
  const ts = termos(q)
  if (!ts.length) return []
  return exemplos.filter((x) => ts.every((w) => x.palheiro.includes(w))).map((x) => x.e)
}

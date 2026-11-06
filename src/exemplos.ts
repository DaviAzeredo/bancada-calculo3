import type { Vista } from './lang/resolve'
import type { EstadoSalvo, OpcLinha } from './store'

type L = string | [string, OpcLinha]

export type Exemplo = { id: string; titulo: string; nota: string; linhas: L[]; vista?: number | Vista }
export type Tema = { tema: string; itens: Exemplo[] }

const P = '\\pi'

/** Organizados na ordem em que o curso costuma andar. */
export const EXEMPLOS: Tema[] = [
  {
    tema: 'Funções de várias variáveis',
    itens: [
      { id: 'sela', titulo: 'Sela e curvas de nível', nota: 'As hipérboles no piso são as curvas de nível da superfície.', vista: 3, linhas: [['f(x,y)=\\frac{x^2-y^2}{3}', { contornos: true }], '\\operatorname{curvas}\\left(f\\right)'] },
      { id: 'paraboloide', titulo: 'Paraboloide com abertura variável', nota: 'Mexa em a: o sinal inverte a concavidade.', vista: 3, linhas: [['a=0.5', { min: -1, max: 1 }], 'z=a\\left(x^2+y^2\\right)'] },
      { id: 'gaussiana', titulo: 'Sino de Gauss', nota: 'Máximo único na origem, com plateau longe dela.', vista: 3, linhas: ['f(x,y)=2e^{-\\left(x^2+y^2\\right)}'] },
      { id: 'ondas', titulo: 'Ondas radiais', nota: 'Uma função de r vira superfície de revolução.', vista: 6, linhas: ['z=\\frac{2\\sin\\left(2r\\right)}{r+1}'] },
      { id: 'quadricas', titulo: 'Quádricas implícitas', nota: 'Hiperboloide de uma folha cortado por um plano.', vista: 3, linhas: ['x^2+y^2-z^2=1', ['z=c', { opacidade: 0.5 }], ['c=0.5', { min: -2, max: 2 }]] },
      { id: 'nivel3d', titulo: 'Superfícies de nível', nota: 'Use o controle de nível na linha de g para percorrer as esferas.', vista: 3, linhas: [['g(x,y,z)=x^2+y^2+z^2', { nivel: 4, opacidade: 0.7 }]] },
    ],
  },
  {
    tema: 'Derivadas',
    itens: [
      { id: 'tangente', titulo: 'Plano tangente', nota: 'Mova a e b: o plano acompanha a superfície, e a seta é o vetor normal.', vista: 3, linhas: ['f(x,y)=\\sin\\left(x\\right)\\cos\\left(y\\right)', ['a=0.8', { min: -3, max: 3 }], ['b=0.5', { min: -3, max: 3 }], ['\\operatorname{tangente}\\left(f,a,b\\right)', { opacidade: 0.75 }]] },
      { id: 'direcional', titulo: 'Derivada direcional', nota: 'A taxa depende da direção; no gradiente, ela é máxima.', vista: 3, linhas: ['f(x,y)=x^2+xy-y^2', ['t=0.8', { min: 0, max: 6.28 }], 'direcional(f,(1,0.5),(\\cos t,\\sin t))'.replace('direcional', '\\operatorname{direcional}')] },
      { id: 'gradiente', titulo: 'Gradiente e curvas de nível', nota: 'O gradiente cruza as curvas de nível em ângulo reto.', vista: 3, linhas: [['f(x,y)=\\frac{x^2+2y^2}{2}', { opacidade: 0.45 }], '\\operatorname{curvas}\\left(f\\right)', '\\operatorname{grad}\\left(f\\right)'] },
      { id: 'criticos', titulo: 'Pontos críticos', nota: 'Dois pontos: um mínimo e uma sela, separados pela segunda derivada.', vista: 3, linhas: [['f(x,y)=\\frac{x^3}{3}-x+\\frac{y^2}{2}', { contornos: true }], '\\operatorname{criticos}\\left(f\\right)'] },
      { id: 'taylor', titulo: 'Aproximação de Taylor', nota: 'A quádrica cola na superfície perto do ponto e descola longe dele.', vista: 3, linhas: ['f(x,y)=\\cos\\left(x\\right)e^{-y^2/2}', ['a=0.5', { min: -3, max: 3 }], ['b=0.5', { min: -3, max: 3 }], ['\\operatorname{taylor}\\left(f,a,b\\right)', { opacidade: 0.6 }]] },
      { id: 'lagrange', titulo: 'Multiplicadores de Lagrange', nota: 'Extremos de f sobre a circunferência g = 0: as curvas de nível tangenciam a restrição.', vista: 3, linhas: ['f(x,y)=x+y', 'g(x,y)=x^2+y^2-1', '\\operatorname{lagrange}\\left(f,g\\right)'] },
    ],
  },
  {
    tema: 'Integrais múltiplas',
    itens: [
      { id: 'volume', titulo: 'Volume sob um gráfico', nota: 'O sólido é desenhado a partir dos limites da própria integral.', vista: 3, linhas: [`\\int_0^2\\int_0^{2-x}\\left(4-x^2-y^2\\right)\\,dy\\,dx`] },
      { id: 'riemann', titulo: 'Soma de Riemann', nota: 'Aumente n e veja as colunas convergirem para a integral.', vista: 3, linhas: [['n=4', { min: 1, max: 40, passo: 1 }], 'R:0\\le x\\le2,\\ 0\\le y\\le2', ['f(x,y)=1+\\frac{x y}{2},\\ 0\\le x\\le2,\\ 0\\le y\\le2', { opacidade: 0.45 }], '\\operatorname{riemann}\\left(f,R,n\\right)'] },
      { id: 'polar', titulo: 'Coordenadas polares', nota: 'A região é um setor de anel; o fator r vem do jacobiano.', vista: 3, linhas: [`R:1\\le r\\le2,\\ 0\\le\\theta\\le${P}`, '\\iint_{R}\\left(x^2+y^2\\right)\\,dA'] },
      { id: 'inversao', titulo: 'Inverter a ordem de integração', nota: 'A mesma região, descrita nas duas ordens, dá o mesmo valor.', vista: 2, linhas: ['\\int_0^1\\int_{y}^{1}e^{x^2}\\,dx\\,dy', '\\int_0^1\\int_{0}^{x}e^{x^2}\\,dy\\,dx'] },
      { id: 'fatias', titulo: 'Fatias e limites de integração', nota: 'Mova c: a seção mostra de onde saem os limites da integral de dentro.', vista: 1.2, linhas: [['E:0\\le x\\le1,\\ 0\\le y\\le1-x,\\ 0\\le z\\le1-x-y', { opacidade: 0.35 }], ['c=0.4', { min: 0, max: 1 }], '\\operatorname{fatia}\\left(E,c\\right)', '\\operatorname{volume}\\left(E\\right)'] },
      { id: 'cilindricas', titulo: 'Coordenadas cilíndricas', nota: 'O sólido entre o paraboloide e o plano z = 4.', vista: 3, linhas: [`E:0\\le r\\le2,\\ 0\\le\\theta\\le2${P},\\ r^2\\le z\\le4`, '\\operatorname{volume}\\left(E\\right)'] },
      { id: 'sorvete', titulo: 'Casquinha de sorvete', nota: 'Cone φ = π/4 tampado pela esfera ρ = 2, em coordenadas esféricas.', vista: 3, linhas: [`E:0\\le\\rho\\le2,\\ 0\\le\\varphi\\le\\frac{${P}}{4},\\ 0\\le\\theta\\le2${P}`, '\\operatorname{volume}\\left(E\\right)'] },
      { id: 'massa', titulo: 'Centro de massa', nota: 'Densidade que cresce com z puxa o centro para cima.', vista: 3, linhas: [`E:0\\le r\\le1,\\ 0\\le\\theta\\le2${P},\\ 0\\le z\\le2`, '\\operatorname{massa}\\left(E,z\\right)', '\\operatorname{centroide}\\left(E,z\\right)'] },
      { id: 'inequacoes', titulo: 'Sólido por desigualdades', nota: 'Interseção desenhada direto das desigualdades, com aresta nítida.', vista: 2, linhas: ['x^2+y^2\\le z\\le2-x^2-y^2'] },
    ],
  },
  {
    tema: 'Curvas no espaço',
    itens: [
      { id: 'helice', titulo: 'Hélice e comprimento', nota: 'Comprimento exato, com o tubo seguindo o sentido de t.', vista: 4, linhas: [`r(t)=\\left(\\cos t,\\sin t,\\frac{t}{4}\\right),\\ 0\\le t\\le4${P}`, '\\operatorname{comprimento}\\left(r\\right)', '\\operatorname{curvatura}\\left(r\\right)'] },
      { id: 'frenet', titulo: 'Triedro de Frenet', nota: 'T, N e B acompanham a curva; mova q.', vista: 2, linhas: [`r(t)=\\left(\\cos t,\\sin t,\\frac{\\sin\\left(2t\\right)}{2}\\right),\\ 0\\le t\\le2${P}`, ['q=1', { min: 0, max: 6.28 }], '\\operatorname{frenet}\\left(r,q\\right)'] },
      { id: 'viviani', titulo: 'Curva de Viviani', nota: 'Interseção da esfera com um cilindro tangente.', vista: 2, linhas: [['x^2+y^2+z^2=4', { opacidade: 0.35 }], `r(t)=\\left(1+\\cos t,\\sin t,2\\sin\\left(\\frac{t}{2}\\right)\\right),\\ 0\\le t\\le4${P}`] },
    ],
  },
  {
    tema: 'Campos vetoriais',
    itens: [
      { id: 'rotacao', titulo: 'Rotação e rotacional', nota: 'Fluxo em círculos: rotacional constante e divergente nulo.', vista: 3, linhas: [['F(x,y)=\\left(-y,x\\right)', { particulas: true, setas: true }], '\\operatorname{div}\\left(F\\right)', '\\operatorname{rot}\\left(F\\right)'] },
      { id: 'fonte', titulo: 'Fonte e divergente', nota: 'O campo radial expande a matéria: divergente positivo em todo ponto.', vista: 3, linhas: [['F(x,y,z)=\\left(x,y,z\\right)', { particulas: true, setas: true }], '\\operatorname{div}\\left(F\\right)'] },
      { id: 'selac', titulo: 'Campo de sela', nota: 'Linhas de fluxo são hipérboles em torno do ponto de sela.', vista: 3, linhas: [['F(x,y)=\\left(x,-y\\right)', { fluxo: true, setas: true }]] },
      { id: 'potencial', titulo: 'Campo conservativo', nota: 'Rotacional nulo: o potencial sai por integração, passo a passo.', vista: 3, linhas: ['F(x,y,z)=\\left(2xy,x^2+z,y\\right)', '\\operatorname{potencial}\\left(F\\right)'] },
      { id: 'sonda', titulo: 'Sonda de rotacional', nota: 'A pá gira em torno do rotacional; arraste o ponto com a, b.', vista: 3, linhas: [['F(x,y)=\\left(-y^3,x^3\\right)', { particulas: true, setas: true }], ['a=1', { min: -3, max: 3 }], ['b=0', { min: -3, max: 3 }], '\\operatorname{sonda}\\left(F,a,b,0\\right)'] },
      { id: 'tornado', titulo: 'Redemoinho 3D', nota: 'Espiral com subida: componentes em xy e em z.', vista: 3, linhas: [['F(x,y,z)=\\left(-y,x,\\frac{1}{1+x^2+y^2}\\right)', { fluxo: true, setas: false }]] },
    ],
  },
  {
    tema: 'Integrais de linha e de superfície',
    itens: [
      { id: 'trabalho', titulo: 'Trabalho ao longo de uma curva', nota: 'A integral de linha, com a parametrização explícita nos passos.', vista: 3, linhas: [['F(x,y)=\\left(-y,x\\right)', { setas: true }], `C(t)=\\left(2\\cos t,2\\sin t\\right),\\ 0\\le t\\le2${P}`, '\\oint_{C}F\\cdot dr'] },
      { id: 'caminho', titulo: 'Independência do caminho', nota: 'Campo conservativo: dois caminhos com as mesmas pontas dão o mesmo trabalho.', vista: 3, linhas: ['F(x,y,z)=\\left(2x,2y,2z\\right)', 'C(t)=\\left(t,t,t\\right),\\ 0\\le t\\le1', 'D(t)=\\left(t,t^2,t^3\\right),\\ 0\\le t\\le1', '\\int_{C}F\\cdot dr', '\\int_{D}F\\cdot dr'] },
      { id: 'pedacos', titulo: 'Contorno por pedaços', nota: 'A borda do triângulo em três segmentos: a soma das três integrais é igual a Green.', vista: 1.5, linhas: [['F(x,y)=\\left(-y,x\\right)', { setas: true }], 'A(t)=\\left(t,0\\right),\\ 0\\le t\\le1', 'B(t)=\\left(1-t\\right)\\left(1,0\\right)+t\\left(0,1\\right),\\ 0\\le t\\le1', 'D(t)=\\left(0,1-t\\right),\\ 0\\le t\\le1', '\\int_{A}F\\cdot dr+\\int_{B}F\\cdot dr+\\int_{D}F\\cdot dr', 'R:0\\le x\\le1,\\ 0\\le y\\le1-x', '\\operatorname{green}\\left(F,R\\right)'] },
      { id: 'green', titulo: 'Teorema de Green', nota: 'Circulação na borda igual ao rotacional somado na região.', vista: 2, linhas: [['F(x,y)=\\left(xy,x^2\\right)', { setas: true }], 'R:0\\le x\\le1,\\ x^2\\le y\\le x', '\\operatorname{green}\\left(F,R\\right)'] },
      { id: 'fluxo', titulo: 'Fluxo por um paraboloide', nota: 'Parametrizada pelo domínio, com o normal para cima.', vista: 2, linhas: [['F(x,y,z)=\\left(x,y,z\\right)', { setas: true }], `S:z=1-x^2-y^2,\\ 0\\le r\\le1,\\ 0\\le\\theta\\le2${P}`, '\\iint_{S}F\\cdot dS'] },
      { id: 'stokes', titulo: 'Teorema de Stokes', nota: 'Borda e rotacional coincidem numa superfície curva qualquer.', vista: 2, linhas: ['F(x,y,z)=\\left(-y,x,z\\right)', `S:z=1-x^2-y^2,\\ 0\\le r\\le1,\\ 0\\le\\theta\\le2${P}`, '\\operatorname{stokes}\\left(F,S\\right)'] },
      { id: 'gauss', titulo: 'Teorema da divergência', nota: 'O fluxo pelas faces é igual ao divergente somado no volume.', vista: 3, linhas: [['F(x,y,z)=\\left(x,y,z\\right)', { setas: true }], `E:0\\le r\\le1,\\ 0\\le\\theta\\le2${P},\\ 0\\le z\\le2`, '\\operatorname{gauss}\\left(F,E\\right)'] },
      { id: 'mobius', titulo: 'Faixa de Möbius', nota: 'Superfície de um só lado: o sinal de fluxo perde sentido.', vista: 2, linhas: [`S(u,v)=\\left(\\left(1+\\frac{v}{2}\\cos\\frac{u}{2}\\right)\\cos u,\\left(1+\\frac{v}{2}\\cos\\frac{u}{2}\\right)\\sin u,\\frac{v}{2}\\sin\\frac{u}{2}\\right),\\ 0\\le u\\le2${P},\\ -1\\le v\\le1`, '\\operatorname{area}\\left(S\\right)'] },
    ],
  },
]

export function estadoDe(e: Exemplo): EstadoSalvo {
  const r = e.vista ?? 5
  const vista: Vista = typeof r === 'number' ? { x: [-r, r], y: [-r, r], z: [-r, r] } : r
  return {
    titulo: e.titulo,
    vista,
    linhas: e.linhas.map((l, i) => {
      const [fonte, opc] = typeof l === 'string' ? [l, {}] : l
      return { fonte, visivel: true, cor: i % 8, opc }
    }),
  }
}

import { useState } from 'react'
import { EXEMPLOS, estadoDe } from '../exemplos'
import { useBancada } from '../store'
import { Formula } from './Formula'
import { Icone, Pilula } from './kit'
import { LinhaExpr } from './LinhaExpr'

type Aba = 'expressoes' | 'exemplos' | 'guia'

function Expressoes() {
  const linhas = useBancada((s) => s.linhas)
  const analises = useBancada((s) => s.resolvido.analises)
  const adiciona = useBancada((s) => s.adiciona)
  const limpa = useBancada((s) => s.limpa)
  const titulo = useBancada((s) => s.titulo)
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {titulo && <p className="truncate border-b border-line-soft px-4 py-2 text-[12.5px] font-medium text-text-2">{titulo}</p>}
      <ol className="rolagem min-h-0 flex-1">
        {linhas.map((l, i) => {
          const a = analises.find((x) => x.id === l.id)
          return a ? <LinhaExpr key={l.id} linha={l} analise={a} indice={i} /> : null
        })}
      </ol>
      <div className="flex items-center gap-2 border-t border-line-soft px-3 py-2">
        <button type="button" onClick={() => adiciona('')} className="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-ctl)] bg-accent px-3 text-[13px] font-medium text-accent-ink transition-opacity duration-150 hover:opacity-90">
          {Icone.mais}
          Nova linha
        </button>
        <button type="button" onClick={limpa} className="h-8 rounded-[var(--radius-ctl)] px-2.5 text-[13px] text-text-2 hover:bg-surface-3 hover:text-text">Limpar</button>
      </div>
    </div>
  )
}

function Exemplos({ aoEscolher }: { aoEscolher: () => void }) {
  const carrega = useBancada((s) => s.carrega)
  return (
    <div className="rolagem min-h-0 flex-1 px-3 py-3">
      {EXEMPLOS.map((t) => (
        <section key={t.tema} className="mb-5">
          <h2 className="mb-1.5 px-1 text-[11.5px] font-semibold tracking-[0.05em] text-text-3 uppercase">{t.tema}</h2>
          <ul>
            {t.itens.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => {
                    carrega(estadoDe(e))
                    aoEscolher()
                  }}
                  className="block w-full rounded-[var(--radius-ctl)] px-2 py-1.5 text-left transition-colors duration-150 hover:bg-surface-3"
                >
                  <span className="block text-[13.5px] font-medium text-text">{e.titulo}</span>
                  <span className="block text-[12.5px] leading-snug text-text-3">{e.nota}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

const GUIA: { tema: string; itens: [string, string, string][] }[] = [
  {
    tema: 'Superfícies',
    itens: [
      ['z = x^2 - y^2', 'z=x^2-y^2', 'Gráfico explícito (também x = … e y = …)'],
      ['x^2+y^2+z^2=4', 'x^2+y^2+z^2=4', 'Superfície implícita'],
      ['f(x,y) = \\sin x', 'f(x,y)=\\sin x', 'Função com nome, usável em outras linhas'],
      ['S(u,v) = (u, v, uv)', 'S(u,v)=\\left(u,v,uv\\right),\\ -1\\le u\\le1,\\ -1\\le v\\le1', 'Paramétrica, com domínio após a vírgula'],
      ['z = r^2', 'z=r^2', 'Cilíndricas: r, θ'],
      ['\\rho = 2', '\\rho=2', 'Esféricas: ρ, θ, φ'],
    ],
  },
  {
    tema: 'Curvas e campos',
    itens: [
      ['r(t) = (\\cos t, \\sin t, t)', 'r(t)=\\left(\\cos t,\\sin t,t\\right)', 'Curva paramétrica'],
      ['F(x,y,z) = (y, -x, z)', 'F(x,y,z)=\\left(y,-x,z\\right)', 'Campo vetorial'],
      ['F = y\\,\\mathbf{i} - x\\,\\mathbf{j}', 'F=y\\mathbf{i}-x\\mathbf{j}', 'Notação i, j, k'],
      ['P = (1, 2, 3)', 'P=\\left(1,2,3\\right)', 'Maiúscula é ponto, minúscula é vetor'],
      ['B(t) = (1-t)P + tQ', 'B(t)=\\left(1-t\\right)\\left(1,0\\right)+t\\left(0,1\\right),\\ 0\\le t\\le1', 'Segmento de P a Q, com t de 0 a 1'],
    ],
  },
  {
    tema: 'Regiões',
    itens: [
      ['R: 0 \\le x \\le 1,\\ 0 \\le y \\le x', 'R:0\\le x\\le1,\\ 0\\le y\\le x', 'Região plana iterada'],
      ['E: 0 \\le \\rho \\le 1,\\ 0 \\le \\varphi \\le \\pi,\\ 0 \\le \\theta \\le 2\\pi', 'E:0\\le\\rho\\le1,\\ 0\\le\\varphi\\le\\pi,\\ 0\\le\\theta\\le2\\pi', 'Sólido em esféricas'],
      ['x^2+y^2 \\le z \\le 4', 'x^2+y^2\\le z\\le4', 'Região por desigualdades'],
      ['z = x^2 \\{x^2+y^2 \\le 1\\}', 'z=x^2\\left\\lbrace x^2+y^2\\le1\\right\\rbrace', 'Restrição entre chaves'],
    ],
  },
  {
    tema: 'Integrais',
    itens: [
      ['\\int_0^1\\int_0^x xy\\,dy\\,dx', '\\int_0^1\\int_0^xxy\\,dy\\,dx', 'Iterada: desenha o sólido'],
      ['\\iint_R f\\,dA', '\\iint_{R}f\\,dA', 'Sobre região com nome'],
      ['\\iiint_E f\\,dV', '\\iiint_{E}f\\,dV', 'Com jacobiano automático'],
      ['\\oint_C \\mathbf{F}\\cdot d\\mathbf{r}', '\\oint_{C}F\\cdot dr', 'Integral de linha'],
      ['\\int_A \\mathbf{F}\\cdot d\\mathbf{r} + \\int_B \\mathbf{F}\\cdot d\\mathbf{r}', '\\int_{A}F\\cdot dr+\\int_{B}F\\cdot dr', 'Contorno por pedaços: some as parcelas'],
      ['\\iint_S \\mathbf{F}\\cdot d\\mathbf{S}', '\\iint_{S}F\\cdot dS', 'Fluxo por uma superfície'],
    ],
  },
  {
    tema: 'Comandos',
    itens: [
      ['\\nabla f,\\ \\nabla\\cdot F,\\ \\nabla\\times F', '\\operatorname{grad}\\left(f\\right)', 'grad, div, rot, lap'],
      ['\\operatorname{tangente}(f, a, b)', '\\operatorname{tangente}\\left(f,a,b\\right)', 'Plano tangente'],
      ['\\operatorname{criticos}(f)', '\\operatorname{criticos}\\left(f\\right)', 'Com teste da segunda derivada'],
      ['\\operatorname{lagrange}(f, g)', '\\operatorname{lagrange}\\left(f,g\\right)', 'Extremos com g = 0'],
      ['\\operatorname{potencial}(F)', '\\operatorname{potencial}\\left(F\\right)', 'Campo conservativo'],
      ['\\operatorname{green}(F, R)', '\\operatorname{green}\\left(F,R\\right)', 'Também stokes(F, S) e gauss(F, E)'],
      ['\\operatorname{riemann}(f, R, n)', '\\operatorname{riemann}\\left(f,R,n\\right)', 'Colunas que convergem'],
      ['\\operatorname{fatia}(E, c)', '\\operatorname{fatia}\\left(E,c\\right)', 'Seção e limites de dentro'],
      ['\\operatorname{jacobiano}((u+v, u-v), u, v)', '\\operatorname{jacobiano}\\left(\\left(u+v,u-v\\right),u,v\\right)', 'Determinante da mudança'],
    ],
  },
]

function Guia({ aoInserir }: { aoInserir: () => void }) {
  const adiciona = useBancada((s) => s.adiciona)
  return (
    <div className="rolagem min-h-0 flex-1 px-3 py-3">
      <p className="mb-3 px-1 text-[12.5px] leading-snug text-text-3">
        Escreva como no caderno: valem sen, tg, cossec e arctg, além de <span className="num">x^2</span>, <span className="num">sqrt</span>, <span className="num">pi</span>, <span className="num">theta</span> e <span className="num">{'<='}</span>. Em <span className="num">int_0^1</span>, a barra de espaço sai do limite. Clique num item para trazê-lo à lista.
      </p>
      {GUIA.map((g) => (
        <section key={g.tema} className="mb-4">
          <h2 className="mb-1 px-1 text-[11.5px] font-semibold tracking-[0.05em] text-text-3 uppercase">{g.tema}</h2>
          <ul>
            {g.itens.map(([t, f, d]) => (
              <li key={f}>
                <button
                  type="button"
                  onClick={() => {
                    adiciona(f)
                    aoInserir()
                  }}
                  className="block w-full rounded-[var(--radius-ctl)] px-2 py-1.5 text-left transition-colors duration-150 hover:bg-surface-3"
                >
                  <span className="block overflow-hidden text-[13px] text-text"><Formula tex={t} /></span>
                  <span className="block text-[12px] text-text-3">{d}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

export function Painel() {
  const [aba, setAba] = useState<Aba>('expressoes')
  const volta = () => setAba('expressoes')
  return (
    <aside className="flex min-h-0 flex-1 flex-col bg-bg" aria-label="Expressões e cálculos">
      <header className="hidden items-center justify-between gap-2 border-b border-line-soft px-4 py-2.5 md:flex">
        <h1 className="text-[14px] font-semibold tracking-[-0.01em] text-text">Bancada <span className="text-text-3">·</span> Cálculo III</h1>
      </header>
      <nav aria-label="Seções" className="flex gap-1 border-b border-line-soft px-3 py-1.5">
        <Pilula ativo={aba === 'expressoes'} onClick={() => setAba('expressoes')}>Expressões</Pilula>
        <Pilula ativo={aba === 'exemplos'} onClick={() => setAba('exemplos')}>Exemplos</Pilula>
        <Pilula ativo={aba === 'guia'} onClick={() => setAba('guia')}>Guia</Pilula>
      </nav>
      {aba === 'expressoes' && <Expressoes />}
      {aba === 'exemplos' && <Exemplos aoEscolher={volta} />}
      {aba === 'guia' && <Guia aoInserir={volta} />}
    </aside>
  )
}

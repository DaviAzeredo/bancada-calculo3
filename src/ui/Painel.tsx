import { useMemo, useState } from 'react'
import { EXEMPLOS, estadoDe } from '../exemplos'
import { buscaExemplos, buscaGuia } from '../guia'
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
          Nova expressão
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

function Guia({ aoInserir }: { aoInserir: () => void }) {
  const adiciona = useBancada((s) => s.adiciona)
  const carrega = useBancada((s) => s.carrega)
  const [busca, setBusca] = useState('')
  const temas = useMemo(() => buscaGuia(busca), [busca])
  const exemplos = useMemo(() => buscaExemplos(busca).slice(0, 4), [busca])
  const insere = (fonte: string) => {
    adiciona(fonte)
    aoInserir()
  }
  const abre = (e: (typeof exemplos)[number]) => {
    carrega(estadoDe(e))
    aoInserir()
  }
  const total = temas.reduce((s, t) => s + t.itens.length, 0)
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-line-soft px-3 py-2">
        <label className="relative block">
          <span className="sr-only">Pesquisar no guia</span>
          <span aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-text-3">{Icone.busca}</span>
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setBusca('')
              if (e.key !== 'Enter' || !busca.trim()) return
              // Enter traz o primeiro resultado, como numa paleta de comandos
              if (temas[0]) insere(temas[0].itens[0].fonte)
              else if (exemplos[0]) abre(exemplos[0])
            }}
            placeholder="Pesquisar: rotacional, volume, Stokes…"
            enterKeyHint="search"
            autoComplete="off"
            spellCheck={false}
            className="h-8 w-full rounded-[var(--radius-ctl)] border border-line bg-surface-2 pr-2 pl-8 text-[13px] text-text outline-none placeholder:text-text-3 focus:border-accent"
          />
        </label>
        {busca.trim() && (
          <p className="mt-1 px-0.5 text-[11.5px] text-text-3" aria-live="polite">
            {total || exemplos.length ? `${total} ${total === 1 ? 'item' : 'itens'}${exemplos.length ? ` e ${exemplos.length} ${exemplos.length === 1 ? 'exemplo' : 'exemplos'}` : ''}. Enter traz o primeiro.` : 'Nada encontrado.'}
          </p>
        )}
      </div>
      <div className="rolagem min-h-0 flex-1 px-3 py-3">
        {!busca.trim() && (
          <p className="mb-3 px-1 text-[12.5px] leading-snug text-text-3">
            Escreva como no caderno: valem sen, tg, cossec e arctg, além de <span className="num">x^2</span>, <span className="num">sqrt</span>, <span className="num">pi</span>, <span className="num">theta</span> e <span className="num">{'<='}</span>. Em <span className="num">int_0^1</span>, a barra de espaço sai do limite. Clique num item para trazê-lo à lista.
          </p>
        )}
        {busca.trim() && !total && !exemplos.length && (
          <p className="px-1 text-[12.5px] leading-snug text-text-3">
            Nada com “{busca.trim()}”. Tente uma palavra do curso, como gradiente, volume, fluxo ou esféricas.
          </p>
        )}
        {temas.map((g) => (
          <section key={g.tema} className="mb-4">
            <h2 className="mb-1 px-1 text-[11.5px] font-semibold tracking-[0.05em] text-text-3 uppercase">{g.tema}</h2>
            <ul>
              {g.itens.map((i) => (
                <li key={i.fonte}>
                  <button type="button" onClick={() => insere(i.fonte)} className="block w-full rounded-[var(--radius-ctl)] px-2 py-1.5 text-left transition-colors duration-150 hover:bg-surface-3">
                    <span className="block overflow-hidden text-[13px] text-text"><Formula tex={i.tex} /></span>
                    <span className="block text-[12px] text-text-3">{i.desc}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {exemplos.length > 0 && (
          <section className="mb-4">
            <h2 className="mb-1 px-1 text-[11.5px] font-semibold tracking-[0.05em] text-text-3 uppercase">Exemplos prontos</h2>
            <ul>
              {exemplos.map((e) => (
                <li key={e.id}>
                  <button type="button" onClick={() => abre(e)} className="block w-full rounded-[var(--radius-ctl)] px-2 py-1.5 text-left transition-colors duration-150 hover:bg-surface-3">
                    <span className="block text-[13.5px] font-medium text-text">{e.titulo}</span>
                    <span className="block text-[12.5px] leading-snug text-text-3">{e.nota}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
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

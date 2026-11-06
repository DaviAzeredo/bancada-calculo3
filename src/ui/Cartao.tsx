import { useState } from 'react'
import { type Resultado, texDecimal } from '../lang/calculos'
import { Formula, TextoComFormula } from './Formula'
import { Icone } from './kit'

const SELOS: Record<Resultado['selo'], { texto: string; cor: string } | null> = {
  exato: { texto: 'Exato, conferido com quadratura numérica', cor: 'text-ok' },
  identificado: { texto: 'Forma reconhecida a partir do decimal', cor: 'text-accent' },
  numerico: { texto: 'Numérico', cor: 'text-text-3' },
  simbolico: null,
  falhou: null,
}

export function Cartao({ r }: { r: Resultado | 'calculando' }) {
  const [aberto, setAberto] = useState(false)
  if (r === 'calculando') return <p className="pulso px-3 pb-2 text-[12.5px] text-text-3">Calculando…</p>
  const selo = SELOS[r.selo]
  const mostraDecimal = r.valor !== undefined && r.exato !== String(r.valor)
  const iguais = r.comparacao && Math.abs(r.comparacao.valorA - r.comparacao.valorB) < 1e-5 * (1 + Math.abs(r.comparacao.valorA))
  return (
    <div className="resultado border-t border-line-soft bg-surface-2/50 px-3 py-2.5">
      <p className="text-[11.5px] font-semibold tracking-[0.05em] text-text-3 uppercase">{r.rotulo}</p>
      {r.formula && <div className="mt-1 text-[13px] text-text-2"><Formula tex={r.formula} bloco /></div>}
      {r.exato && (
        <div className="mt-1.5 text-[15px] text-text">
          <Formula tex={r.exato} bloco />
        </div>
      )}
      {r.aproximado && <div className="mt-1 text-[13px] text-text-2"><Formula tex={r.aproximado} bloco /></div>}
      {mostraDecimal && (
        <p className="num mt-1 text-[13px] text-text-2">
          ≈ <Formula tex={texDecimal(r.valor!)} />
          {r.selo !== 'exato' && r.erro !== undefined && r.erro > 0 && <span className="text-text-3"> (± {r.erro.toExponential(0)})</span>}
        </p>
      )}
      {r.comparacao && (
        <dl className="num mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-[12.5px]">
          <dt className="font-sans text-text-3">{r.comparacao.a}</dt>
          <dd className="text-text-2">{texDecimalSimples(r.comparacao.valorA)}</dd>
          <dt className="font-sans text-text-3">{r.comparacao.b}</dt>
          <dd className="text-text-2">{texDecimalSimples(r.comparacao.valorB)}</dd>
          <dt className={`col-span-2 font-sans ${iguais ? 'text-ok' : 'text-danger'}`}>{iguais ? 'Os dois lados coincidem' : 'Os dois lados diferem'}</dt>
        </dl>
      )}
      {r.aviso && <p role="status" className="mt-1.5 text-[12.5px] leading-snug text-danger">{r.aviso}</p>}
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
        {selo ? <span className={`text-[12px] ${selo.cor}`}>{selo.texto}</span> : <span />}
        {r.passos.length > 0 && (
          <button type="button" onClick={() => setAberto(!aberto)} aria-expanded={aberto} className="inline-flex min-h-6 items-center gap-1 text-[12.5px] font-medium text-accent hover:underline">
            <span className={`transition-transform duration-150 ${aberto ? 'rotate-90' : ''}`}>{Icone.seta}</span>
            Passo a passo
          </button>
        )}
      </div>
      {aberto && (
        <ol className="mt-2 space-y-2.5 border-t border-line-soft pt-2.5">
          {r.passos.map((p, i) => (
            <li key={i} className="text-[12.5px] leading-snug text-text-2">
              <p className="font-medium text-text"><TextoComFormula texto={p.titulo} /></p>
              {p.tex && <div className="mt-1 text-[13px]"><Formula tex={p.tex} bloco /></div>}
              {p.nota && <p className="mt-1 text-text-3">{p.nota}</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

const texDecimalSimples = (v: number) => Number(v.toPrecision(10)).toLocaleString('pt-BR', { maximumFractionDigits: 8 })

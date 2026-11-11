import { memo, useState } from 'react'
import { acoesDe, comoFuncao } from '../acoes'
import { cabecaSolta, cabecaTex, comCabeca, contextoDe, separaCabeca, variaveisDe } from '../lang/cabeca'
import type { Analise } from '../lang/resolve'
import { CORES, type Linha, useBancada } from '../store'
import { Cartao } from './Cartao'
import { CampoMat } from './CampoMat'
import { Formula } from './Formula'
import { BotaoIcone, Icone, Pilula } from './kit'

function passoRedondo(faixa: number) {
  const bruto = faixa / 120
  const m = 10 ** Math.floor(Math.log10(bruto))
  const f = bruto / m
  return (f < 2 ? 1 : f < 5 ? 2 : 5) * m
}

function Deslizante({ linha, analise }: { linha: Linha; analise: Analise }) {
  const numero = useBancada((s) => s.numero)
  const setArrastando = useBancada((s) => s.setArrastando)
  const opcoes = useBancada((s) => s.opcoes)
  const animando = useBancada((s) => !!s.animando[linha.id])
  const anima = useBancada((s) => s.anima)
  const v = analise.numero!.valor
  const min = Math.min(linha.opc.min ?? -5, v)
  const max = Math.max(linha.opc.max ?? 5, v)
  // passo redondo: o exato de a = 1,5 é 3/2; o de 1,485 é uma fração de cinco dígitos
  const passo = linha.opc.passo ?? passoRedondo(max - min)
  const editor = (lado: 'min' | 'max', val: number) => (
    <input
      type="number"
      aria-label={lado === 'min' ? 'Valor mínimo' : 'Valor máximo'}
      value={Number(val.toFixed(4))}
      onChange={(e) => {
        const n = Number(e.target.value)
        if (Number.isFinite(n) && e.target.value !== '') opcoes(linha.id, { [lado]: n })
      }}
      className="num h-6 w-12 shrink-0 rounded-[4px] bg-transparent text-center text-[11.5px] text-text-3 outline-none hover:bg-surface-3 focus:bg-surface-3 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
    />
  )
  return (
    <div className="flex items-center gap-1 px-2 pb-1.5">
      <BotaoIcone rotulo={animando ? 'Parar animação' : 'Animar valor'} ativo={animando} onClick={() => anima(linha.id, !animando)}>
        {animando ? Icone.pausa : Icone.play}
      </BotaoIcone>
      {editor('min', min)}
      <input
        type="range"
        className="deslize"
        aria-label={`Valor de ${analise.nome}`}
        min={min}
        max={max}
        step={passo}
        value={v}
        onChange={(e) => numero(linha.id, Number(e.target.value))}
        onPointerDown={() => setArrastando(true)}
        onPointerUp={() => setArrastando(false)}
        onBlur={() => setArrastando(false)}
      />
      {editor('max', max)}
    </div>
  )
}

function Ajustes({ linha, analise }: { linha: Linha; analise: Analise }) {
  const opcoes = useBancada((s) => s.opcoes)
  const cor = useBancada((s) => s.cor)
  const remove = useBancada((s) => s.remove)
  const move = useBancada((s) => s.move)
  const faixa = useBancada((s) => s.faixas[linha.id])
  const { opc } = linha
  const superficie = ['funcao', 'superficie', 'regiao', 'escalar'].includes(analise.tipo) || (analise.tipo === 'calculo' && analise.desenhos.some((d) => d.d === 'grafico' || d.d === 'solido' || d.d === 'riemann'))
  const campo = analise.desenhos.some((d) => d.d === 'campo')
  return (
    <div className="space-y-2.5 border-t border-line-soft px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Cor">
        {CORES.map((c, i) => (
          <button key={c} type="button" role="radio" aria-checked={linha.cor === i} aria-label={`Cor ${i + 1}`} onClick={() => cor(linha.id, i)} className={`h-[18px] w-[18px] rounded-full transition-transform duration-150 hover:scale-110 ${linha.cor === i ? 'ring-2 ring-text ring-offset-2 ring-offset-surface' : ''}`} style={{ background: c }} />
        ))}
        <span className="flex-1" />
        <BotaoIcone rotulo="Mover para cima" onClick={() => move(linha.id, -1)}>{Icone.cima}</BotaoIcone>
        <BotaoIcone rotulo="Mover para baixo" onClick={() => move(linha.id, 1)}>{Icone.baixo}</BotaoIcone>
        <BotaoIcone rotulo="Apagar expressão" onClick={() => remove(linha.id)}>{Icone.lixo}</BotaoIcone>
      </div>
      {superficie && (
        <>
          <label className="flex items-center gap-2 text-[12.5px] text-text-2">
            <span className="w-[74px]">Opacidade</span>
            <input type="range" className="deslize" min={0.1} max={1} step={0.01} value={opc.opacidade ?? 1} onChange={(e) => opcoes(linha.id, { opacidade: Number(e.target.value) })} />
          </label>
          <div className="flex flex-wrap gap-1.5">
            <Pilula ativo={opc.grade !== false} onClick={() => opcoes(linha.id, { grade: opc.grade === false })}>Grade</Pilula>
            <Pilula ativo={!!opc.contornos} onClick={() => opcoes(linha.id, { contornos: !opc.contornos })}>Curvas de nível</Pilula>
            <Pilula ativo={!!opc.mapa} onClick={() => opcoes(linha.id, { mapa: !opc.mapa })}>Cor por altura</Pilula>
          </div>
        </>
      )}
      {analise.tipo === 'escalar' && faixa && (
        <label className="flex items-center gap-2 text-[12.5px] text-text-2">
          <span className="w-[74px]">Nível</span>
          <input type="range" className="deslize" min={faixa[0]} max={faixa[1]} step={(faixa[1] - faixa[0]) / 200} value={opc.nivel ?? (faixa[0] + faixa[1]) / 2} onChange={(e) => opcoes(linha.id, { nivel: Number(e.target.value) })} />
          <span className="num w-10 text-right text-[12px]">{(opc.nivel ?? (faixa[0] + faixa[1]) / 2).toFixed(2)}</span>
        </label>
      )}
      {campo && (
        <>
          <div className="flex flex-wrap gap-1.5">
            <Pilula ativo={opc.setas !== false} onClick={() => opcoes(linha.id, { setas: opc.setas === false })}>Setas</Pilula>
            <Pilula ativo={!!opc.fluxo} onClick={() => opcoes(linha.id, { fluxo: !opc.fluxo })}>Linhas de fluxo</Pilula>
            <Pilula ativo={!!opc.particulas} onClick={() => opcoes(linha.id, { particulas: !opc.particulas })}>Partículas</Pilula>
            <Pilula ativo={!!opc.unitarias} onClick={() => opcoes(linha.id, { unitarias: !opc.unitarias })}>Mesmo tamanho</Pilula>
          </div>
          <label className="flex items-center gap-2 text-[12.5px] text-text-2">
            <span className="w-[74px]">Densidade</span>
            <input type="range" className="deslize" min={0.4} max={1.6} step={0.05} value={opc.densidade ?? 1} onChange={(e) => opcoes(linha.id, { densidade: Number(e.target.value) })} />
          </label>
        </>
      )}
    </div>
  )
}

function Acoes({ linha, analise }: { linha: Linha; analise: Analise }) {
  const resolvido = useBancada((s) => s.resolvido)
  const adicionaVarias = useBancada((s) => s.adicionaVarias)
  const atualiza = useBancada((s) => s.atualiza)
  const acoes = acoesDe(analise, resolvido)
  const renomeavel = !analise.nome && analise.tipo === 'superficie' ? comoFuncao(linha) : null
  if (!acoes.length && !renomeavel) return null
  return (
    <div className="border-t border-line-soft px-3 py-2.5">
      <p className="mb-1.5 text-[11.5px] font-semibold tracking-[0.05em] text-text-3 uppercase">Fazer com {analise.nome ?? 'esta expressão'}</p>
      <div className="flex flex-wrap gap-1.5">
        {acoes.map((a) => (
          <Pilula key={a.rotulo} title={a.dica} onClick={() => adicionaVarias(a.linhas, linha.id)}>{a.rotulo}</Pilula>
        ))}
        {renomeavel && <Pilula title="Reescreve como f(x, y), o que libera tangente, gradiente e pontos críticos" onClick={() => atualiza(linha.id, renomeavel)}>Dar nome de função</Pilula>}
      </div>
    </div>
  )
}

export const LinhaExpr = memo(function LinhaExpr({ linha, analise, indice }: { linha: Linha; analise: Analise; indice: number }) {
  const atualiza = useBancada((s) => s.atualiza)
  const adiciona = useBancada((s) => s.adiciona)
  const adicionaVarias = useBancada((s) => s.adicionaVarias)
  const remove = useBancada((s) => s.remove)
  const alterna = useBancada((s) => s.alterna)
  const seleciona = useBancada((s) => s.seleciona)
  const setFoco = useBancada((s) => s.setFoco)
  const selecionada = useBancada((s) => s.selecionada === linha.id)
  const foco = useBancada((s) => s.focoEm === linha.id)
  const resultado = useBancada((s) => s.resultados[linha.id])
  const vizinhos = useBancada((s) => s.linhas)
  const [abreAjustes, setAbreAjustes] = useState(false)
  // linha sem cabeçalho que está sendo digitada: "f(x,y)=" só trava quando o aluno sai dela
  const [livre, setLivre] = useState(false)
  const cab = livre ? null : separaCabeca(linha.fonte)
  const contexto = () => contextoDe(useBancada.getState().linhas.map((l) => l.fonte))
  const mudaCorpo = (corpo: string) => {
    if (!cab) return atualiza(linha.id, corpo)
    atualiza(linha.id, comCabeca(cab.nome, variaveisDe(corpo, cab.nome, cab.params, contexto()), corpo))
  }
  const sai = () => {
    setLivre(false)
    // cabeçalho escrito à mão: as variáveis passam a ser as do corpo, como nas outras linhas
    const fonte = useBancada.getState().linhas.find((l) => l.id === linha.id)?.fonte ?? ''
    const c = cabecaSolta(fonte)
    if (!c) return
    const ctx = contexto()
    // f já definida em outra linha: f(1, y) = z é uma equação com ela, não um cabeçalho
    if ((ctx.definicoes.get(c.nome) ?? 0) > 1) return
    // corpo sem variável conhecida (h(a, b) = a + b, f(1, 2) = 3): fica como foi escrito
    const vs = variaveisDe(c.corpo, c.nome, [], ctx)
    if (!vs.length) return
    const certa = comCabeca(c.nome, vs, c.corpo)
    if (certa !== fonte) atualiza(linha.id, certa)
  }
  const temDesenho = analise.desenhos.length > 0
  const foca = (delta: number) => {
    const i = vizinhos.findIndex((l) => l.id === linha.id)
    const v = vizinhos[i + delta]
    if (v) setFoco(v.id)
  }
  const criarControles = () => {
    adicionaVarias(analise.faltando.map((n) => ({ fonte: `${n}=1`, opc: { min: -5, max: 5 } })), linha.id)
  }
  return (
    <li className={`border-b border-line-soft transition-colors duration-150 ${selecionada ? 'bg-surface' : ''}`}>
      <div className="flex items-start gap-1 pl-2 pr-1">
        <button
          type="button"
          aria-label={linha.visivel ? 'Ocultar da cena' : 'Mostrar na cena'}
          aria-pressed={linha.visivel}
          title={linha.visivel ? 'Ocultar da cena' : 'Mostrar na cena'}
          disabled={!temDesenho}
          onClick={() => alterna(linha.id)}
          className="mt-1.5 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full disabled:cursor-default"
        >
          {temDesenho ? (
            <span className="h-3.5 w-3.5 rounded-full border-2 transition-colors duration-150" style={{ borderColor: CORES[linha.cor], background: linha.visivel ? CORES[linha.cor] : 'transparent' }} />
          ) : (
            <span className="num text-[11px] text-text-3">{indice + 1}</span>
          )}
        </button>
        <div className="flex min-w-0 flex-1 items-center" onClick={() => seleciona(linha.id)}>
          {cab && (
            <span
              className="shrink-0 pl-[2px] text-[16px] text-text-2 select-none"
              title="O nome e as variáveis vêm do site: as variáveis mudam conforme o que você escreve depois do ="
            >
              <Formula tex={cabecaTex(cab.nome, cab.params)} />
            </span>
          )}
          <div className="min-w-0 flex-1">
          <CampoMat
            key={cab ? 'corpo' : 'livre'}
            valor={cab ? cab.corpo : linha.fonte}
            rotulo={cab ? `Expressão ${indice + 1}, depois de ${cab.nome}(${cab.params.join(', ')}) =` : `Expressão ${indice + 1}`}
            exemplo={cab ? (cab.params.length === 1 ? ['(\\cos t,\\sin t,t)','(cos t, sen t, t)'] : cab.params[0] === 'u' ? ['(u,v,u^2)', '(u, v, u²)'] : ['x^2-y^2', 'x² − y²']) : undefined}
            foco={foco}
            aoMudar={mudaCorpo}
            aoEnter={() => adiciona('', linha.id)}
            aoApagarVazia={() => {
              foca(-1)
              remove(linha.id)
            }}
            aoSubir={() => foca(-1)}
            aoDescer={() => foca(1)}
            aoFocar={() => {
              seleciona(linha.id)
              setFoco(null)
              if (!cab) setLivre(true)
            }}
            aoSair={sai}
          />
          </div>
        </div>
        <BotaoIcone rotulo="Ajustes da expressão" ativo={abreAjustes} onClick={() => setAbreAjustes(!abreAjustes)} className="mt-0.5">{Icone.ajuste}</BotaoIcone>
      </div>
      {analise.rotulo && !analise.erro && analise.tipo !== 'numero' && <p className="truncate px-[42px] pb-1 text-[11.5px] text-text-3">{analise.rotulo}</p>}
      {analise.erro && <p role="alert" className="px-[42px] pb-2 text-[12.5px] leading-snug text-danger">{analise.erro}</p>}
      {analise.faltando.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-[42px] pb-2">
          <span className="text-[12.5px] text-text-3">Falta definir {analise.faltando.join(', ')}.</span>
          <Pilula onClick={criarControles}>Criar controle{analise.faltando.length > 1 ? 's' : ''}</Pilula>
        </div>
      )}
      {analise.numero?.literal && <Deslizante linha={linha} analise={analise} />}
      {resultado && analise.calcula && !analise.erro && !analise.faltando.length && <Cartao r={resultado} />}
      {abreAjustes && <Ajustes linha={linha} analise={analise} />}
      {selecionada && <Acoes linha={linha} analise={analise} />}
    </li>
  )
})

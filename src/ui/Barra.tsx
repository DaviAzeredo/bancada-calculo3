import { useState } from 'react'
import { pedeVisao, useHud } from '../cena/hud'
import { linkDe } from '../compartilha'
import { useBancada } from '../store'
import { BotaoIcone, Icone, Pilula } from './kit'

function Faixa() {
  const vista = useBancada((s) => s.vista)
  const setVista = useBancada((s) => s.setVista)
  const r = Math.max(Math.abs(vista.x[0]), Math.abs(vista.x[1]), Math.abs(vista.z[1]))
  const [aberto, setAberto] = useState(false)
  const define = (n: number) => {
    if (n > 0) setVista({ x: [-n, n], y: [-n, n], z: [-n, n] })
  }
  const eixo = (k: 'x' | 'y' | 'z') => (
    <div key={k} className="flex items-center gap-1.5">
      <span className="num w-3 text-[12px] text-text-3">{k}</span>
      {[0, 1].map((i) => (
        <input
          key={i}
          type="number"
          step="any"
          aria-label={`${k} ${i ? 'máximo' : 'mínimo'}`}
          value={vista[k][i]}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (!Number.isFinite(n) || e.target.value === '') return
            const novo: [number, number] = i ? [vista[k][0], n] : [n, vista[k][1]]
            if (novo[1] - novo[0] > 1e-3) setVista({ ...vista, [k]: novo })
          }}
          className="num h-7 w-[68px] rounded-[var(--radius-ctl)] border border-line bg-surface-2 px-1.5 text-[12.5px] text-text outline-none focus:border-accent"
        />
      ))}
    </div>
  )
  return (
    <div className="relative">
      <Pilula ativo={aberto} aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
        <span className="num">±{Number(r.toFixed(2))}</span>
      </Pilula>
      {aberto && (
        <div className="absolute top-9 right-0 z-30 w-[200px] space-y-2 rounded-[var(--radius-panel)] border border-line bg-surface p-3 shadow-lg">
          <p className="text-[12px] text-text-3">Caixa de visualização</p>
          <div className="flex flex-wrap gap-1">
            {[1, 2, 3, 5, 10, 20].map((n) => (
              <Pilula key={n} ativo={r === n} onClick={() => define(n)}><span className="num">±{n}</span></Pilula>
            ))}
          </div>
          {(['x', 'y', 'z'] as const).map(eixo)}
        </div>
      )}
    </div>
  )
}

export function Barra() {
  const cena = useBancada((s) => s.cena)
  const setCena = useBancada((s) => s.setCena)
  const tema = useBancada((s) => s.tema)
  const setTema = useBancada((s) => s.setTema)
  const capturar = useHud((s) => s.capturar)
  const setAviso = useBancada((s) => s.setAviso)
  const compartilha = async () => {
    const { linhas, vista, titulo } = useBancada.getState()
    const url = linkDe({ linhas: linhas.map(({ fonte, visivel, cor, opc }) => ({ fonte, visivel, cor, opc })), vista, titulo })
    try {
      await navigator.clipboard.writeText(url)
      setAviso('Link copiado: quem abrir vê esta mesma tela.')
    } catch {
      history.replaceState(null, '', url)
      setAviso('Copie o endereço da barra do navegador.')
    }
  }
  const lig = (k: 'eixos' | 'grade' | 'caixa' | 'giro') => setCena({ [k]: !cena[k] })
  return (
    <div className="pointer-events-none absolute top-2 right-2 left-2 z-20 flex items-start justify-end gap-1.5 max-md:overflow-x-auto max-md:[scrollbar-width:none]">
      <div className="pointer-events-auto flex shrink-0 items-center gap-0.5 rounded-[var(--radius-panel)] border border-line-soft bg-surface/90 p-1 backdrop-blur-sm">
        {(['iso', 'topo', 'frente', 'lado'] as const).map((v) => (
          <button key={v} type="button" onClick={() => pedeVisao(v)} className="h-8 rounded-[var(--radius-ctl)] px-2 text-[12.5px] font-medium text-text-2 transition-colors duration-150 hover:bg-surface-3 hover:text-text">
            {v === 'iso' ? '3D' : v === 'topo' ? 'xy' : v === 'frente' ? 'xz' : 'yz'}
          </button>
        ))}
      </div>
      <div className="pointer-events-auto flex shrink-0 items-center gap-0.5 rounded-[var(--radius-panel)] border border-line-soft bg-surface/90 p-1 backdrop-blur-sm">
        <Faixa />
        <BotaoIcone rotulo="Eixos" ativo={cena.eixos} onClick={() => lig('eixos')}>{Icone.eixos}</BotaoIcone>
        <BotaoIcone rotulo="Grade no plano xy" ativo={cena.grade} onClick={() => lig('grade')}>{Icone.grade}</BotaoIcone>
        <BotaoIcone rotulo="Caixa" ativo={cena.caixa} onClick={() => lig('caixa')}>{Icone.caixa}</BotaoIcone>
        <BotaoIcone rotulo="Girar sozinho" ativo={cena.giro} onClick={() => lig('giro')}>{Icone.giro}</BotaoIcone>
        <span className="mx-0.5 h-5 w-px bg-line" aria-hidden />
        <BotaoIcone rotulo="Salvar imagem" disabled={!capturar} onClick={() => capturar?.()}>{Icone.foto}</BotaoIcone>
        <BotaoIcone rotulo="Copiar link desta tela" onClick={compartilha}>{Icone.link}</BotaoIcone>
        <BotaoIcone rotulo={tema === 'escuro' ? 'Tema claro' : 'Tema escuro'} onClick={() => setTema(tema === 'escuro' ? 'claro' : 'escuro')}>{tema === 'escuro' ? Icone.sol : Icone.lua}</BotaoIcone>
      </div>
    </div>
  )
}

export function Medicao() {
  const m = useHud((s) => s.medida)
  if (!m) return null
  const tri = m.triangulos >= 1e6 ? `${(m.triangulos / 1e6).toFixed(1).replace('.', ',')} mi` : `${Math.round(m.triangulos / 1000)} mil`
  return (
    <p data-medida={JSON.stringify(m)} className="num pointer-events-none absolute right-2 bottom-2 max-w-[calc(100%-1rem)] rounded-[var(--radius-ctl)] border border-line-soft bg-surface/90 px-2 py-1 text-right text-[12px] text-text-2">
      <span className={m.fps >= 50 ? 'text-ok' : m.fps >= 30 ? 'text-accent' : 'text-danger'}>{Math.round(m.fps)} quadros/s</span> · {tri} triângulos · {m.largura}×{m.altura}
      <span className="block truncate text-[11px] text-text-3">{m.gpu}</span>
    </p>
  )
}

export function LeituraCursor() {
  const c = useHud((s) => s.cursor)
  if (!c) return null
  const f = (v: number) => v.toFixed(3).replace('-', '−').replace('.', ',')
  return (
    <p className="num pointer-events-none absolute bottom-2 left-2 rounded-[var(--radius-ctl)] border border-line-soft bg-surface/90 px-2 py-1 text-[12px] text-text-2">
      x {f(c[0])}  y {f(c[1])}  z {f(c[2])}
    </p>
  )
}

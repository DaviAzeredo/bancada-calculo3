import { Suspense, lazy, useEffect } from 'react'
import { decodifica } from './compartilha'
import { ligaMotor, usePecas } from './motor'
import { useBancada } from './store'
import { Barra, LeituraCursor } from './ui/Barra'
import { Painel } from './ui/Painel'

const Viewport = lazy(() => import('./cena/Viewport').then((m) => ({ default: m.Viewport })))

function Avisos() {
  const aviso = useBancada((s) => s.aviso)
  const setAviso = useBancada((s) => s.setAviso)
  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 3200)
    return () => clearTimeout(t)
  }, [aviso, setAviso])
  if (!aviso) return null
  return <p role="status" className="absolute bottom-3 left-1/2 z-30 -translate-x-1/2 rounded-[var(--radius-ctl)] border border-line bg-surface px-3 py-1.5 text-[13px] text-text shadow-lg">{aviso}</p>
}

function Carregando() {
  const prontas = usePecas((s) => s.prontas)
  if (prontas) return null
  return <p className="pulso pointer-events-none absolute inset-0 flex items-center justify-center text-[13px] text-text-3">Montando a cena…</p>
}

export function App() {
  const tema = useBancada((s) => s.tema)
  useEffect(() => {
    document.documentElement.dataset.tema = tema
  }, [tema])
  useEffect(() => {
    ligaMotor()
    const aoLink = () => {
      const e = decodifica(location.hash)
      if (e) useBancada.getState().carrega(e)
    }
    window.addEventListener('hashchange', aoLink)
    return () => window.removeEventListener('hashchange', aoLink)
  }, [])
  return (
    <div className="flex h-[calc(100dvh-var(--teclado,0px))] flex-col-reverse md:flex-row">
      <div className="flex min-h-0 w-full flex-[1.15_1_0] flex-col border-line-soft md:w-[380px] md:flex-none md:border-r">
        <Painel />
      </div>
      <main className="relative min-h-0 min-w-0 flex-1" aria-label="Cena 3D">
        <Suspense fallback={null}>
          <Viewport />
        </Suspense>
        <Carregando />
        <Barra />
        <LeituraCursor />
        <Avisos />
      </main>
    </div>
  )
}

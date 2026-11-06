import katex from 'katex'
import 'katex/dist/katex.min.css'
import { useMemo } from 'react'

const render = (tex: string, display: boolean) => katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: 'ignore', trust: false, output: 'html' })

export function Formula({ tex, bloco }: { tex: string; bloco?: boolean }) {
  const html = useMemo(() => render(tex, !!bloco), [tex, bloco])
  // o KaTeX escapa o texto e, com trust: false, recusa comandos que abririam links
  return <span className={bloco ? 'formula-rolavel block' : ''} dangerouslySetInnerHTML={{ __html: html }} />
}

/** Texto com trechos $…$. */
export function TextoComFormula({ texto }: { texto: string }) {
  const partes = texto.split('$')
  return (
    <>
      {partes.map((p, i) => (i % 2 ? <Formula key={i} tex={p} /> : <span key={i}>{p}</span>))}
    </>
  )
}

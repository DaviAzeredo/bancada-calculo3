import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import type { MathfieldElement } from 'mathlive'
import { COMANDOS } from '../lang/lexer'
import { Formula } from './Formula'

declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'math-field': React.DetailedHTMLProps<React.HTMLAttributes<MathfieldElement>, MathfieldElement>
    }
  }
}

let carregado: Promise<void> | null = null
let jaCarregou = false
let atalhos: Record<string, string> = {}

/** O editor pesa mais que o resto da interface, então só vem depois da primeira pintura. */
function carregaMathlive() {
  carregado ??= import('mathlive').then(({ MathfieldElement }) => {
    MathfieldElement.fontsDirectory = new URL('mathlive-fonts', document.baseURI).href
    MathfieldElement.soundsDirectory = null
    const teclado = window.mathVirtualKeyboard
    teclado?.addEventListener('geometrychange', () => {
      const h = teclado.visible ? teclado.boundingRect.height : 0
      document.documentElement.style.setProperty('--teclado', `${h}px`)
    })
    const nomes = ['sen', 'tg', 'cotg', 'cossec', 'arcsen', 'arctg', 'senh', ...COMANDOS.filter((c) => c.length > 2)]
    atalhos = {
      ...Object.fromEntries(nomes.map((n) => [n, `\\operatorname{${n}}`])),
      '<=': '\\le',
      '>=': '\\ge',
      theta: '\\theta',
      phi: '\\varphi',
      rho: '\\rho',
      inf: '\\infty',
      // sem o molde de limites: _ e ^ se digitam depois, como no papel
      int: '\\int',
      iint: '\\iint',
      iiint: '\\iiint',
      oint: '\\oint',
    }
    jaCarregou = true
  })
  return carregado
}

/**
 * Editores a criar, um por vez, nas folgas entre quadros. Cada editor custa de 3 a 8 ms aqui e
 * várias vezes isso num celular: abrir um exemplo de sete linhas criava todos no mesmo quadro e
 * travava a câmera que voava para o novo enquadramento. Até a vez dele, a fórmula aparece em
 * KaTeX, igual à vista.
 */
const fila: (() => void)[] = []
let rodando = false
const folga = (f: () => void) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(() => f(), { timeout: 250 }) : setTimeout(f, 16))
function naVez(f: () => void) {
  fila.push(f)
  if (rodando) return
  rodando = true
  const passo = () => {
    fila.shift()?.()
    if (fila.length) folga(passo)
    else rodando = false
  }
  folga(passo)
}

/**
 * Tela de toque: o editor do MathLive se foca ao primeiro contato, e arrastar a lista por cima de
 * uma expressão abria o teclado, que redimensiona a página e a cena. No toque, a expressão fica em
 * KaTeX e só vira editor num toque de verdade (click), voltando a KaTeX quando perde o foco. O
 * MathLive nem carrega antes da primeira edição.
 */
const TOQUE = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches

/** O cursor está num subscrito? Dentro de um ramo, getValue só devolve o texto desse ramo. */
function noSubscrito(mf: MathfieldElement) {
  if ((mf.getElementInfo(mf.position)?.depth ?? 0) < 1) return false
  const ramo = mf.getValue(0, mf.position, 'latex')
  return mf.value.includes(`_${ramo}`) || mf.value.includes(`_{${ramo}`)
}

type Props = {
  valor: string
  rotulo: string
  foco?: boolean
  aoMudar: (v: string) => void
  aoEnter?: () => void
  aoApagarVazia?: () => void
  aoSubir?: () => void
  aoDescer?: () => void
  aoFocar?: () => void
}

export function CampoMat({ valor, rotulo, foco, aoMudar, aoEnter, aoApagarVazia, aoSubir, aoDescer, aoFocar }: Props) {
  // linhas novas nascem com o editor pronto: o campo provisório roubaria o foco pedido
  const [pronto, setPronto] = useState(jaCarregou && !!foco)
  const ref = useRef<MathfieldElement>(null)
  // clicou na fórmula antes da vez dela: vira editor na hora e recebe o foco
  const querFoco = useRef(!!foco)
  const vivo = useRef(true)
  const cb = useRef({ aoMudar, aoEnter, aoApagarVazia, aoSubir, aoDescer, aoFocar })
  cb.current = { aoMudar, aoEnter, aoApagarVazia, aoSubir, aoDescer, aoFocar }

  useEffect(() => {
    vivo.current = true
    // no toque, o editor só nasce quando pedido: toque na fórmula ou linha nova
    if (!TOQUE || querFoco.current) {
      carregaMathlive().then(
        () => {
          if (!vivo.current) return
          if (querFoco.current) setPronto(true)
          else naVez(() => vivo.current && flushSync(() => setPronto(true)))
        },
        () => undefined,
      )
    }
    return () => {
      vivo.current = false
    }
  }, [])

  const acorda = () => {
    querFoco.current = true
    if (jaCarregou) setPronto(true)
    else carregaMathlive().then(() => vivo.current && setPronto(true), () => undefined)
  }

  useEffect(() => {
    const mf = ref.current
    if (!pronto || !mf) return
    mf.mathVirtualKeyboardPolicy = 'auto'
    mf.menuItems = []
    mf.smartFence = true
    mf.smartSuperscript = true
    mf.inlineShortcuts = { ...mf.inlineShortcuts, ...atalhos }
    mf.placeholder = '\\text{escreva, por exemplo, } z=x^2-y^2'
    mf.value = valor
    const aoInput = () => cb.current.aoMudar(mf.getValue('latex-without-placeholders'))
    const aoTecla = (e: KeyboardEvent) => {
      if (e.key === '^' && noSubscrito(mf)) {
        // ∫_0^1: o limite de cima sai do subscrito e vai para o expoente da integral
        e.preventDefault()
        e.stopPropagation()
        mf.executeCommand('moveAfterParent')
        mf.executeCommand('moveToSuperscript')
      } else if (e.key === 'Enter') {
        e.preventDefault()
        cb.current.aoEnter?.()
      } else if (e.key === 'Backspace' && !mf.value) {
        e.preventDefault()
        cb.current.aoApagarVazia?.()
      } else if (e.key === 'ArrowUp') cb.current.aoSubir?.()
      else if (e.key === 'ArrowDown') cb.current.aoDescer?.()
    }
    const aoFocus = () => cb.current.aoFocar?.()
    // no toque, sem foco o editor volta a ser fórmula: arrastar por cima dele não reabre o teclado
    let espera: ReturnType<typeof setTimeout> | undefined
    const aoBlur = () => {
      if (!TOQUE) return
      clearTimeout(espera)
      espera = setTimeout(() => {
        if (vivo.current && !mf.hasFocus()) setPronto(false)
      }, 250)
    }
    mf.addEventListener('input', aoInput)
    mf.addEventListener('keydown', aoTecla, { capture: true })
    mf.addEventListener('focus', aoFocus)
    mf.addEventListener('blur', aoBlur)
    return () => {
      clearTimeout(espera)
      mf.removeEventListener('input', aoInput)
      mf.removeEventListener('keydown', aoTecla, { capture: true })
      mf.removeEventListener('focus', aoFocus)
      mf.removeEventListener('blur', aoBlur)
    }
  }, [pronto]) // eslint-disable-line react-hooks/exhaustive-deps

  // texto que mudou de fora (controle deslizante, exemplo): sem roubar o cursor de quem digita
  useEffect(() => {
    const mf = ref.current
    if (mf && pronto && document.activeElement !== mf && mf.value !== valor) mf.value = valor
  }, [valor, pronto])

  useEffect(() => {
    if (foco && !pronto) acorda()
    if ((foco || querFoco.current) && pronto) {
      querFoco.current = false
      ref.current?.focus()
    }
  }, [foco, pronto]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!pronto) {
    return (
      <div
        role="textbox"
        tabIndex={0}
        aria-label={rotulo}
        // click, e não pointerdown: o começo de uma rolagem não é toque na expressão
        onClick={acorda}
        onFocus={TOQUE ? undefined : acorda}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            acorda()
          }
        }}
        className="flex min-h-[34px] w-full cursor-text items-center overflow-hidden px-[2px] py-[5px] text-[16px] text-text outline-none"
      >
        {valor ? <Formula tex={valor} /> : <span className="text-[14px] text-text-3">escreva, por exemplo, z = x² − y²</span>}
      </div>
    )
  }
  return <math-field ref={ref} aria-label={rotulo} />
}

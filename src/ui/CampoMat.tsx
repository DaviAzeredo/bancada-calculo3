import { useEffect, useRef, useState } from 'react'
import type { MathfieldElement } from 'mathlive'
import { COMANDOS } from '../lang/lexer'

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
  const [pronto, setPronto] = useState(jaCarregou)
  const ref = useRef<MathfieldElement>(null)
  const cb = useRef({ aoMudar, aoEnter, aoApagarVazia, aoSubir, aoDescer, aoFocar })
  cb.current = { aoMudar, aoEnter, aoApagarVazia, aoSubir, aoDescer, aoFocar }

  useEffect(() => {
    let vivo = true
    carregaMathlive().then(() => vivo && setPronto(true), () => undefined)
    return () => {
      vivo = false
    }
  }, [])

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
    mf.addEventListener('input', aoInput)
    mf.addEventListener('keydown', aoTecla, { capture: true })
    mf.addEventListener('focus', aoFocus)
    return () => {
      mf.removeEventListener('input', aoInput)
      mf.removeEventListener('keydown', aoTecla, { capture: true })
      mf.removeEventListener('focus', aoFocus)
    }
  }, [pronto]) // eslint-disable-line react-hooks/exhaustive-deps

  // texto que mudou de fora (controle deslizante, exemplo): sem roubar o cursor de quem digita
  useEffect(() => {
    const mf = ref.current
    if (mf && pronto && document.activeElement !== mf && mf.value !== valor) mf.value = valor
  }, [valor, pronto])

  useEffect(() => {
    if (foco && pronto) ref.current?.focus()
  }, [foco, pronto])

  if (!pronto) {
    return <input aria-label={rotulo} value={valor} onChange={(e) => aoMudar(e.target.value)} className="num h-[34px] w-full bg-transparent text-[14px] text-text outline-none" spellCheck={false} />
  }
  return <math-field ref={ref} aria-label={rotulo} />
}

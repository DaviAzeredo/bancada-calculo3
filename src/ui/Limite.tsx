import { Component, type ReactNode } from 'react'

type Props = { chave: string; titulo: string; dica: string; children: ReactNode }

/**
 * Um erro de desenho ou do painel derrubava a página inteira, que ficava em branco. Agora só a
 * parte que falhou mostra o aviso, e ela tenta de novo quando as expressões mudam.
 */
export class Limite extends Component<Props, { falhou: boolean }> {
  state = { falhou: false }

  static getDerivedStateFromError() {
    return { falhou: true }
  }

  componentDidCatch(e: unknown) {
    console.error(e)
  }

  componentDidUpdate(antes: Props) {
    if (this.state.falhou && antes.chave !== this.props.chave) this.setState({ falhou: false })
  }

  render() {
    if (!this.state.falhou) return this.props.children
    return (
      <div role="alert" className="flex h-full items-center justify-center p-6 text-center">
        <div className="max-w-[300px]">
          <p className="mb-1 text-[14px] font-semibold text-text">{this.props.titulo}</p>
          <p className="mb-3 text-[13px] text-text-2">{this.props.dica}</p>
          <button type="button" onClick={() => this.setState({ falhou: false })} className="h-8 rounded-[var(--radius-ctl)] border border-line px-3 text-[13px] text-text-2 hover:border-text-3 hover:text-text">
            Tentar de novo
          </button>
        </div>
      </div>
    )
  }
}

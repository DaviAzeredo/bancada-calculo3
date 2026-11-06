import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function BotaoIcone({ rotulo, children, ativo, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { rotulo: string; ativo?: boolean }) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={rotulo}
      aria-pressed={ativo}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-ctl)] text-text-2 transition-colors duration-150 hover:bg-surface-3 hover:text-text disabled:opacity-40 ${ativo ? 'bg-surface-3 text-accent' : ''} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Pilula({ children, ativo, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { ativo?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      className={`inline-flex min-h-7 items-center gap-1.5 rounded-[var(--radius-ctl)] border px-2.5 py-1 text-[12.5px] font-medium transition-colors duration-150 ${ativo ? 'border-accent bg-surface-3 text-accent' : 'border-line text-text-2 hover:border-text-3 hover:text-text'} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

const traco = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
const I = ({ children }: { children: ReactNode }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden {...traco}>
    {children}
  </svg>
)

export const Icone = {
  mais: <I><path d="M8 3v10M3 8h10" /></I>,
  fechar: <I><path d="M4 4l8 8M12 4l-8 8" /></I>,
  casa: <I><path d="M2.5 8 8 3l5.5 5" /><path d="M4 7v6h8V7" /></I>,
  olho: <I><path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z" /><circle cx="8" cy="8" r="1.8" /></I>,
  eixos: <I><path d="M3 13V3M3 13h10M3 13l7-5" /></I>,
  grade: <I><path d="M2.5 5.5h11M2.5 10.5h11M5.5 2.5v11M10.5 2.5v11" /></I>,
  caixa: <I><path d="M8 2 13.5 5v6L8 14 2.5 11V5zM8 8l5.500-3M8 8 2.5 5M8 8v6" /></I>,
  giro: <I><path d="M13 8a5 5 0 1 1-1.500-3.500" /><path d="M13 2.500V5h-2.500" /></I>,
  foto: <I><path d="M2.500 5h2.500l1-1.500h4L11 5h2.500v7.500h-11z" /><circle cx="8" cy="8.500" r="2.200" /></I>,
  link: <I><path d="M6.500 9.500a3 3 0 0 0 4.200 0l2-2a3 3 0 0 0-4.200-4.200l-.8.8" /><path d="M9.500 6.500a3 3 0 0 0-4.200 0l-2 2a3 3 0 0 0 4.200 4.200l.8-.8" /></I>,
  sol: <I><circle cx="8" cy="8" r="2.800" /><path d="M8 1.500v1.500M8 13v1.500M1.500 8H3M13 8h1.500M3.400 3.400l1 1M11.600 11.600l1 1M3.400 12.600l1-1M11.600 4.400l1-1" /></I>,
  lua: <I><path d="M13 9.500A5.500 5.500 0 1 1 6.500 3a4.500 4.500 0 0 0 6.500 6.500Z" /></I>,
  play: <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden><path d="M5 3.500v9l7-4.500z" fill="currentColor" /></svg>,
  pausa: <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden><path d="M5 3.500h2v9H5zM9 3.500h2v9H9z" fill="currentColor" /></svg>,
  ajuste: <I><path d="M2.500 5h6M11.500 5h2M2.500 11h2M7.500 11h6" /><circle cx="10" cy="5" r="1.500" /><circle cx="6" cy="11" r="1.500" /></I>,
  seta: <I><path d="M6 3.500 10.500 8 6 12.500" /></I>,
  lixo: <I><path d="M3 4.500h10M6.500 4.500V3h3v1.500M4.500 4.500l.6 8.500h5.800l.6-8.500" /></I>,
  cima: <I><path d="M8 13V3M4 7l4-4 4 4" /></I>,
  baixo: <I><path d="M8 3v10M4 9l4 4 4-4" /></I>,
}

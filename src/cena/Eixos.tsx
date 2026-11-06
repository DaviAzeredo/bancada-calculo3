import { useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { BoxGeometry, BufferGeometry, CanvasTexture, EdgesGeometry, Float32BufferAttribute, LinearFilter, SRGBColorSpace, Vector3 } from 'three'
import type { Vista } from '../lang/resolve'
import type { TemaCena } from './materiais'

const texturas = new Map<string, { tex: CanvasTexture; razao: number }>()

function textura(txt: string, cor: string, peso: number) {
  const k = `${txt}|${cor}|${peso}`
  const c = texturas.get(k)
  if (c) return c
  const px = 40
  const cv = document.createElement('canvas')
  const ctx = cv.getContext('2d')!
  const fonte = `${peso} ${px}px "JetBrains Mono Variable", ui-monospace, monospace`
  ctx.font = fonte
  const w = Math.ceil(ctx.measureText(txt).width) + 8
  cv.width = w
  cv.height = px + 12
  ctx.font = fonte
  ctx.textBaseline = 'middle'
  ctx.fillStyle = cor
  ctx.fillText(txt, 4, cv.height / 2 + 1)
  const tex = new CanvasTexture(cv)
  tex.colorSpace = SRGBColorSpace
  tex.minFilter = LinearFilter
  tex.generateMipmaps = false
  const r = { tex, razao: cv.width / cv.height }
  texturas.set(k, r)
  return r
}

/** Texto de tamanho constante na tela, sem DOM: dezenas de rótulos custam um sprite cada. */
export function Rotulo({ texto, pos, cor, px = 12, peso = 500, fundo = false }: { texto: string; pos: [number, number, number]; cor: string; px?: number; peso?: number; fundo?: boolean }) {
  const altura = useThree((s) => s.size.height)
  const fov = useThree((s) => (s.camera as { fov?: number }).fov ?? 32)
  const { tex, razao } = textura(texto, cor, peso)
  const h = ((px * 1.3) / altura) * 2 * Math.tan((fov * Math.PI) / 360)
  return (
    <sprite position={pos} scale={[h * razao, h, 1]} renderOrder={8}>
      <spriteMaterial map={tex} sizeAttenuation={false} depthTest={fundo} depthWrite={false} transparent />
    </sprite>
  )
}

export function passoBonito(faixa: number, alvo = 8) {
  const bruto = faixa / alvo
  const m = 10 ** Math.floor(Math.log10(bruto))
  const f = bruto / m
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * m
}

const fmt = (v: number) => {
  const r = Number(v.toFixed(6))
  return Object.is(r, -0) ? '0' : String(r).replace('-', '−').replace('.', ',')
}

function Grade({ vista, tema }: { vista: Vista; tema: TemaCena }) {
  const passo = passoBonito(Math.max(vista.x[1] - vista.x[0], vista.y[1] - vista.y[0]), 10)
  const { fina, forte } = useMemo(() => {
    const finas: number[] = []
    const fortes: number[] = []
    const [x0, x1] = vista.x
    const [y0, y1] = vista.y
    for (let k = Math.ceil(x0 / passo); k * passo <= x1 + 1e-9; k++) (k % 5 === 0 ? fortes : finas).push(k * passo, y0, 0, k * passo, y1, 0)
    for (let k = Math.ceil(y0 / passo); k * passo <= y1 + 1e-9; k++) (k % 5 === 0 ? fortes : finas).push(x0, k * passo, 0, x1, k * passo, 0)
    const g = (v: number[]) => new BufferGeometry().setAttribute('position', new Float32BufferAttribute(v, 3))
    return { fina: g(finas), forte: g(fortes) }
  }, [vista, passo])
  useEffect(() => () => {
    fina.dispose()
    forte.dispose()
  }, [fina, forte])
  return (
    <>
      <lineSegments geometry={fina} renderOrder={-2}>
        <lineBasicMaterial color={tema.grade} transparent opacity={0.8} depthWrite={false} />
      </lineSegments>
      <lineSegments geometry={forte} renderOrder={-2}>
        <lineBasicMaterial color={tema.gradeForte} transparent opacity={0.9} depthWrite={false} />
      </lineSegments>
    </>
  )
}

function Caixa({ vista, tema }: { vista: Vista; tema: TemaCena }) {
  const arestas = useMemo(() => new EdgesGeometry(new BoxGeometry(1, 1, 1)), [])
  useEffect(() => () => arestas.dispose(), [arestas])
  const c = (e: [number, number]) => (e[0] + e[1]) / 2
  const t = (e: [number, number]) => e[1] - e[0]
  return (
    <lineSegments geometry={arestas} position={[c(vista.x), c(vista.y), c(vista.z)]} scale={[t(vista.x), t(vista.y), t(vista.z)]}>
      <lineBasicMaterial color={tema.caixa} transparent opacity={0.7} depthWrite={false} />
    </lineSegments>
  )
}

const dentro = (v: number, e: [number, number]) => v >= e[0] && v <= e[1]

function Eixo({ de, ate, cor, raio }: { de: Vector3; ate: Vector3; cor: string; raio: number }) {
  const meio = de.clone().add(ate).multiplyScalar(0.5)
  const d = ate.clone().sub(de)
  const L = d.length()
  const rot: [number, number, number] = d.x ? [0, 0, -Math.PI / 2] : d.y ? [0, 0, 0] : [Math.PI / 2, 0, 0]
  return (
    <group>
      <mesh position={meio} rotation={rot} scale={[raio, L, raio]}>
        <cylinderGeometry args={[1, 1, 1, 8]} />
        <meshBasicMaterial color={cor} toneMapped={false} />
      </mesh>
      <mesh position={ate} rotation={rot} scale={[raio * 3.2, raio * 8, raio * 3.2]}>
        <coneGeometry args={[1, 1, 12]} />
        <meshBasicMaterial color={cor} toneMapped={false} />
      </mesh>
    </group>
  )
}

export function Eixos({ vista, tema, eixos, grade, caixa, rotulos }: { vista: Vista; tema: TemaCena; eixos: boolean; grade: boolean; caixa: boolean; rotulos: boolean }) {
  const diag = Math.hypot(vista.x[1] - vista.x[0], vista.y[1] - vista.y[0], vista.z[1] - vista.z[0])
  const raio = diag * 0.0011
  const nomes = ['x', 'y', 'z'] as const
  const marcas = useMemo(() => {
    const out: { eixo: number; v: number }[] = []
    nomes.forEach((n, i) => {
      const e = vista[n]
      const p = passoBonito(e[1] - e[0], 6)
      for (let k = Math.ceil(e[0] / p); k * p <= e[1] + 1e-9; k++) if (Math.abs(k) > 1e-9) out.push({ eixo: i, v: k * p })
    })
    return out
  }, [vista])
  const o = [dentro(0, vista.x) ? 0 : vista.x[0], dentro(0, vista.y) ? 0 : vista.y[0], dentro(0, vista.z) ? 0 : vista.z[0]]
  return (
    <group>
      {grade && <Grade vista={vista} tema={tema} />}
      {caixa && <Caixa vista={vista} tema={tema} />}
      {eixos &&
        nomes.map((n, i) => {
          const de = new Vector3(...o)
          const ate = new Vector3(...o)
          de.setComponent(i, vista[n][0])
          ate.setComponent(i, vista[n][1])
          const fim = ate.clone()
          fim.setComponent(i, vista[n][1] + diag * 0.03)
          return (
            <group key={n}>
              <Eixo de={de} ate={ate} cor={tema.eixos[i]} raio={raio} />
              <Rotulo texto={n} pos={fim.toArray()} cor={tema.eixos[i]} px={15} peso={700} />
            </group>
          )
        })}
      {eixos &&
        rotulos &&
        marcas.map(({ eixo, v }) => {
          const p: [number, number, number] = [o[0], o[1], o[2]]
          p[eixo] = v
          // deslocado para fora do eixo, para o número não cobrir o traço
          if (eixo === 2) p[0] += diag * 0.016
          else p[2] -= diag * 0.014
          // números ficam atrás das superfícies; nomes de eixo e de ponto, sempre à frente
          return <Rotulo key={`${eixo}${v}`} texto={fmt(v)} pos={p} cor={tema.texto} px={10.5} fundo />
        })}
    </group>
  )
}

import { useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { BufferGeometry, CanvasTexture, Color, ConeGeometry, CylinderGeometry, Float32BufferAttribute, InstancedBufferAttribute, InstancedBufferGeometry, LinearFilter, LineBasicMaterial, MeshBasicMaterial, SRGBColorSpace, Vector2, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
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

type ItemRotulo = { texto: string; pos: [number, number, number]; cor: string; px: number; peso: number }

/**
 * Todos os rótulos de um lote numa chamada de desenho: um atlas com os textos e um quadrado
 * instanciado por rótulo, com tamanho fixo em pixels como o sprite. No celular, cada chamada a
 * menos é CPU a menos por quadro; antes eram 20 sprites, um por número.
 */
function RotulosLote({ itens, fundo }: { itens: ItemRotulo[]; fundo: boolean }) {
  const tamanho = useThree((s) => s.size)
  const chave = itens.map((i) => `${i.texto}|${i.cor}|${i.px}|${i.peso}|${i.pos.join(',')}`).join(';')
  const { geo, mat, u } = useMemo(() => {
    // atlas: cada texto uma vez, em linhas de até 1024 px
    const PX = 40
    const ALT = PX + 12
    const medidor = document.createElement('canvas').getContext('2d')!
    const larguras = itens.map((i) => {
      medidor.font = `${i.peso} ${PX}px "JetBrains Mono Variable", ui-monospace, monospace`
      return Math.ceil(medidor.measureText(i.texto).width) + 8
    })
    const W = 1024
    const lugar: [number, number][] = []
    let x = 0
    let y = 0
    larguras.forEach((w) => {
      if (x + w > W) {
        x = 0
        y += ALT
      }
      lugar.push([x, y])
      x += w
    })
    const H = Math.max(ALT, y + ALT)
    const cv = document.createElement('canvas')
    cv.width = W
    cv.height = H
    const ctx = cv.getContext('2d')!
    ctx.textBaseline = 'middle'
    itens.forEach((it, k) => {
      ctx.font = `${it.peso} ${PX}px "JetBrains Mono Variable", ui-monospace, monospace`
      ctx.fillStyle = it.cor
      ctx.fillText(it.texto, lugar[k][0] + 4, lugar[k][1] + ALT / 2 + 1)
    })
    const tex = new CanvasTexture(cv)
    tex.colorSpace = SRGBColorSpace
    tex.minFilter = LinearFilter
    tex.generateMipmaps = false
    const n = itens.length
    const pos = new Float32Array(Math.max(1, n) * 3)
    const tam = new Float32Array(Math.max(1, n) * 2)
    const uv = new Float32Array(Math.max(1, n) * 4)
    itens.forEach((it, k) => {
      pos.set(it.pos, 3 * k)
      const h = it.px * 1.3
      tam[2 * k] = (h * larguras[k]) / ALT
      tam[2 * k + 1] = h
      // a textura de canvas vem invertida em y: v = 0 é a base do canvas
      uv.set([lugar[k][0] / W, 1 - (lugar[k][1] + ALT) / H, larguras[k] / W, ALT / H], 4 * k)
    })
    const geo = new InstancedBufferGeometry()
    geo.setAttribute('position', new Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3))
    geo.setAttribute('uv', new Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2))
    geo.setIndex([0, 1, 2, 0, 2, 3])
    geo.setAttribute('aPos', new InstancedBufferAttribute(pos, 3))
    geo.setAttribute('aTam', new InstancedBufferAttribute(tam, 2))
    geo.setAttribute('aUv', new InstancedBufferAttribute(uv, 4))
    geo.instanceCount = n
    const u = { uTela: { value: new Vector2(1, 1) } }
    const mat = new MeshBasicMaterial({ map: tex, transparent: true, depthTest: fundo, depthWrite: false })
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u)
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec3 aPos;\nattribute vec2 aTam;\nattribute vec4 aUv;\nuniform vec2 uTela;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\nvMapUv = aUv.xy + uv * aUv.zw;')
        .replace('#include <project_vertex>', 'vec4 mvPosition = modelViewMatrix * vec4(aPos, 1.0);\ngl_Position = projectionMatrix * mvPosition;\ngl_Position.xy += position.xy * aTam * 2.0 / uTela * gl_Position.w;')
    }
    mat.customProgramCacheKey = () => 'rotulos-1'
    return { geo, mat, u }
  }, [chave, fundo]) // eslint-disable-line react-hooks/exhaustive-deps
  u.uTela.value.set(tamanho.width, tamanho.height)
  useEffect(() => () => {
    geo.dispose()
    mat.map?.dispose()
    mat.dispose()
  }, [geo, mat])
  if (!itens.length) return null
  return <mesh geometry={geo} material={mat} frustumCulled={false} renderOrder={8} />
}

/** Grade do piso e arestas da caixa numa só chamada; cor e opacidade vão por vértice. */
function Tracos({ vista, tema, grade, caixa }: { vista: Vista; tema: TemaCena; grade: boolean; caixa: boolean }) {
  const passo = passoBonito(Math.max(vista.x[1] - vista.x[0], vista.y[1] - vista.y[0]), 10)
  const geo = useMemo(() => {
    const p: number[] = []
    const c: number[] = []
    const seg = (a: number[], b: number[], cor: Color, alfa: number) => {
      p.push(...a, ...b)
      c.push(cor.r, cor.g, cor.b, alfa, cor.r, cor.g, cor.b, alfa)
    }
    const [x0, x1] = vista.x
    const [y0, y1] = vista.y
    const [z0, z1] = vista.z
    if (grade) {
      const fina = new Color(tema.grade)
      const forte = new Color(tema.gradeForte)
      for (let k = Math.ceil(x0 / passo); k * passo <= x1 + 1e-9; k++) seg([k * passo, y0, 0], [k * passo, y1, 0], k % 5 === 0 ? forte : fina, k % 5 === 0 ? 0.9 : 0.8)
      for (let k = Math.ceil(y0 / passo); k * passo <= y1 + 1e-9; k++) seg([x0, k * passo, 0], [x1, k * passo, 0], k % 5 === 0 ? forte : fina, k % 5 === 0 ? 0.9 : 0.8)
    }
    if (caixa) {
      const cor = new Color(tema.caixa)
      const v = [x0, x1].flatMap((x) => [y0, y1].flatMap((y) => [z0, z1].map((z) => [x, y, z])))
      // arestas: pares de cantos que diferem em uma só coordenada
      for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) if ([0, 1, 2].filter((k) => v[i][k] !== v[j][k]).length === 1) seg(v[i], v[j], cor, 0.7)
    }
    return new BufferGeometry().setAttribute('position', new Float32BufferAttribute(p, 3)).setAttribute('color', new Float32BufferAttribute(c, 4))
  }, [vista, passo, tema, grade, caixa])
  const mat = useMemo(() => new LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }), [])
  useEffect(() => () => geo.dispose(), [geo])
  useEffect(() => () => mat.dispose(), [mat])
  return <lineSegments geometry={geo} material={mat} renderOrder={-2} />
}

const dentro = (v: number, e: [number, number]) => v >= e[0] && v <= e[1]

/** As três setas de eixo, haste e ponta, numa só malha com cor por vértice. */
function SetasEixos({ o, vista, tema, raio }: { o: number[]; vista: Vista; tema: TemaCena; raio: number }) {
  const geo = useMemo(() => {
    const partes: BufferGeometry[] = []
    const nomes = ['x', 'y', 'z'] as const
    nomes.forEach((n, i) => {
      const de = new Vector3(...o)
      const ate = new Vector3(...o)
      de.setComponent(i, vista[n][0])
      ate.setComponent(i, vista[n][1])
      const L = ate.clone().sub(de).length()
      const cor = new Color(tema.eixos[i])
      const pinta = (g: BufferGeometry) => {
        const k = g.attributes.position.count
        g.setAttribute('color', new Float32BufferAttribute(Array.from({ length: k }, () => [cor.r, cor.g, cor.b]).flat(), 3))
        g.deleteAttribute('uv')
        g.deleteAttribute('normal')
        return g
      }
      // cilindro e cone nascem ao longo de y: giram para o eixo e vão para o lugar
      const gira = (g: BufferGeometry) => (i === 0 ? g.rotateZ(-Math.PI / 2) : i === 2 ? g.rotateX(Math.PI / 2) : g)
      const meio = de.clone().add(ate).multiplyScalar(0.5)
      const haste = gira(new CylinderGeometry(1, 1, 1, 8).scale(raio, L, raio))
      haste.translate(meio.x, meio.y, meio.z)
      const ponta = gira(new ConeGeometry(1, 1, 12).scale(raio * 3.2, raio * 8, raio * 3.2))
      ponta.translate(ate.x, ate.y, ate.z)
      partes.push(pinta(haste.toNonIndexed()), pinta(ponta.toNonIndexed()))
    })
    return mergeGeometries(partes)
  }, [o, vista, tema, raio])
  const mat = useMemo(() => new MeshBasicMaterial({ vertexColors: true, toneMapped: false }), [])
  useEffect(() => () => geo.dispose(), [geo])
  useEffect(() => () => mat.dispose(), [mat])
  return <mesh geometry={geo} material={mat} />
}

export function Eixos({ vista, tema, eixos, grade, caixa, rotulos }: { vista: Vista; tema: TemaCena; eixos: boolean; grade: boolean; caixa: boolean; rotulos: boolean }) {
  const diag = Math.hypot(vista.x[1] - vista.x[0], vista.y[1] - vista.y[0], vista.z[1] - vista.z[0])
  const raio = diag * 0.0011
  const o = useMemo(() => [dentro(0, vista.x) ? 0 : vista.x[0], dentro(0, vista.y) ? 0 : vista.y[0], dentro(0, vista.z) ? 0 : vista.z[0]], [vista])
  // nomes de eixo sempre à frente; números atrás das superfícies
  const { nomes, numeros } = useMemo(() => {
    const nomes: ItemRotulo[] = []
    const numeros: ItemRotulo[] = []
    const ks = ['x', 'y', 'z'] as const
    ks.forEach((n, i) => {
      const fim = new Vector3(...o)
      fim.setComponent(i, vista[n][1] + diag * 0.03)
      nomes.push({ texto: n, pos: fim.toArray(), cor: tema.eixos[i], px: 15, peso: 700 })
      const e = vista[n]
      const p = passoBonito(e[1] - e[0], 6)
      for (let k = Math.ceil(e[0] / p); k * p <= e[1] + 1e-9; k++) {
        if (Math.abs(k) < 1e-9) continue
        const q: [number, number, number] = [o[0], o[1], o[2]]
        q[i] = k * p
        // deslocado para fora do eixo, para o número não cobrir o traço
        if (i === 2) q[0] += diag * 0.016
        else q[2] -= diag * 0.014
        numeros.push({ texto: fmt(k * p), pos: q, cor: tema.texto, px: 10.5, peso: 500 })
      }
    })
    return { nomes, numeros }
  }, [vista, tema, o, diag])
  return (
    <group>
      {(grade || caixa) && <Tracos vista={vista} tema={tema} grade={grade} caixa={caixa} />}
      {eixos && <SetasEixos o={o} vista={vista} tema={tema} raio={raio} />}
      {eixos && <RotulosLote itens={nomes} fundo={false} />}
      {eixos && rotulos && <RotulosLote itens={numeros} fundo />}
    </group>
  )
}

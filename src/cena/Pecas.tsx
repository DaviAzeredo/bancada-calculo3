import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture, Color, CylinderGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshLambertMaterial, NormalBlending, type Plane, Points, Quaternion, ShaderMaterial, Sprite, SpriteMaterial, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import type { Expr } from '../math/alg'
import { compila, executa, type Lote } from '../math/lote'
import type { Vista } from '../lang/resolve'
import type { Feito, MalhaLinhas, MalhaSetas, MalhaSup, Marcadores } from '../malha/malhas'
import { usePecas } from '../motor'
import { CORES, type Linha, useBancada } from '../store'
import { Rotulo, passoBonito } from './Eixos'
import { GeoDinamica, type MatSup, type TemaCena, geometriaSeta, materialSuperficie, rampa } from './materiais'

const diagDe = (v: Vista) => Math.hypot(v.x[1] - v.x[0], v.y[1] - v.y[0], v.z[1] - v.z[0])

function Superficie({ m, linha, planos, vista, tema }: { m: MalhaSup; linha: Linha; planos: Plane[]; vista: Vista; tema: TemaCena }) {
  const ref = useRef<Mesh>(null)
  const din = useMemo(() => new GeoDinamica(), [])
  const mat: MatSup = useMemo(() => materialSuperficie(planos), [planos])
  const invalida = useThree((s) => s.invalidate)
  useLayoutEffect(() => {
    din.atualiza(m, diagDe(vista))
    ref.current!.geometry = din.geo
    invalida()
  }, [m, din, vista, invalida])
  const { opacidade = 1, grade = true, contornos = false, mapa = false } = linha.opc
  useEffect(() => {
    mat.color.set(CORES[linha.cor])
    const transparente = opacidade < 0.995
    if (mat.transparent !== transparente) {
      mat.transparent = transparente
      mat.depthWrite = !transparente
      // uma passada só: a superfície tem uma cor, então a ordem da mistura dentro dela quase não
      // aparece, e as duas passadas (verso, depois frente) dobravam o custo de uma esfera na tela
      mat.forceSinglePass = transparente
      mat.needsUpdate = true
    }
    mat.opacity = opacidade
    const u = mat.u
    const eTubo = m.lin === undefined
    u.uLinhas.value = grade && !eTubo ? 0.34 : 0
    u.uCorLinha.value.set(tema.linha)
    if (m.lin === 'coord') {
      const px = passoBonito(vista.x[1] - vista.x[0], 10)
      const py = passoBonito(vista.y[1] - vista.y[0], 10)
      u.uPasso.value.set((vista.x[1] - vista.x[0]) / px, (vista.y[1] - vista.y[0]) / py)
    } else u.uPasso.value.set(20, 20)
    u.uContorno.value = contornos ? passoBonito(vista.z[1] - vista.z[0], 12) : 0
    u.uMapa.value = mapa ? 1 : 0
    u.uFaixa.value.set(vista.z[0], vista.z[1])
    invalida()
  }, [mat, linha.cor, opacidade, grade, contornos, mapa, vista, tema, m.lin, invalida])
  useEffect(() => () => {
    din.geo.dispose()
    mat.dispose()
  }, [din, mat])
  return <mesh ref={ref} material={mat} frustumCulled={false} userData={{ sup: linha.id }} renderOrder={opacidade < 0.995 ? 2 : 0} />
}

const Z = new Vector3(0, 0, 1)

/** Instâncias de uma só seta: mil setas custam uma chamada de desenho. */
function Setas({ m, linha, vista }: { m: MalhaSetas; linha: Linha; vista: Vista }) {
  const n = m.pos.length / 3
  const [cap, setCap] = useState(() => Math.max(n, 64))
  if (n > cap) setCap(Math.ceil(n * 1.3))
  const ref = useRef<InstancedMesh>(null)
  const invalida = useThree((s) => s.invalidate)
  const mat = useMemo(() => new MeshLambertMaterial(), [])
  const unit = linha.opc.unitarias
  useLayoutEffect(() => {
    const im = ref.current
    if (!im || n > cap) return
    const dim2 = Math.abs(m.pos[2] - m.pos[Math.min(m.pos.length - 1, 3 * (n - 1) + 2)]) < 1e-9
    const lado = (vista.x[1] - vista.x[0]) / (dim2 ? Math.sqrt(n) : Math.cbrt(n))
    const M = new Matrix4()
    const q = new Quaternion()
    const d = new Vector3()
    const p = new Vector3()
    const s = new Vector3()
    const c = new Color()
    for (let i = 0; i < n; i++) {
      d.set(m.dir[3 * i], m.dir[3 * i + 1], m.dir[3 * i + 2])
      const r = m.max > 0 ? m.mag[i] / m.max : 0
      const L = lado * 0.92 * (unit ? 0.8 : 0.22 + 0.78 * Math.sqrt(r))
      if (m.mag[i] <= 0) {
        s.set(0, 0, 0)
        q.identity()
      } else {
        q.setFromUnitVectors(Z, d)
        s.set(lado * 0.62, lado * 0.62, L)
      }
      p.set(m.pos[3 * i] - (d.x * L) / 2, m.pos[3 * i + 1] - (d.y * L) / 2, m.pos[3 * i + 2] - (d.z * L) / 2)
      M.compose(p, q, s)
      im.setMatrixAt(i, M)
      im.setColorAt(i, rampa(Math.sqrt(r), c))
    }
    im.count = n
    im.instanceMatrix.needsUpdate = true
    if (im.instanceColor) im.instanceColor.needsUpdate = true
    invalida()
  }, [m, n, cap, unit, vista, invalida])
  useEffect(() => () => mat.dispose(), [mat])
  return <instancedMesh key={cap} ref={ref} args={[geometriaSeta(), mat, cap]} frustumCulled={false} />
}

function Linhas({ m, planos, usarCor }: { m: MalhaLinhas; planos: Plane[]; usarCor: boolean }) {
  const invalida = useThree((s) => s.invalidate)
  const mat = useMemo(() => new LineMaterial({ linewidth: 1.5, vertexColors: true, transparent: true, opacity: 0.92, clippingPlanes: planos }), [planos])
  const obj = useMemo(() => {
    const o = new LineSegments2(new LineSegmentsGeometry(), mat)
    o.frustumCulled = false
    return o
  }, [mat])
  useLayoutEffect(() => {
    const g = new LineSegmentsGeometry()
    if (m.seg.length) {
      g.setPositions(m.seg)
      const n = m.val.length
      const cor = new Float32Array(n * 3)
      const c = new Color()
      const faixa = m.max - m.min || 1
      for (let i = 0; i < n; i++) {
        rampa((m.val[i] - m.min) / faixa, c)
        cor[3 * i] = c.r
        cor[3 * i + 1] = c.g
        cor[3 * i + 2] = c.b
      }
      g.setColors(cor)
    }
    // cada troca descarta a anterior na hora; o limite é o ritmo do worker
    obj.geometry.dispose()
    obj.geometry = g
    invalida()
  }, [m, obj, invalida, usarCor])
  useEffect(() => () => {
    obj.geometry.dispose()
    mat.dispose()
  }, [obj, mat])
  return <primitive object={obj} />
}

function Seta({ p, v, cor, escala, rotulo, tema }: { p: [number, number, number]; v: [number, number, number]; cor: string; escala: number; rotulo?: string; tema: TemaCena }) {
  const d = new Vector3(...v)
  const L = d.length()
  if (L < 1e-9) return null
  const q = new Quaternion().setFromUnitVectors(Z, d.clone().normalize())
  // vetor de verdade quando cabe; só o desenho encurta se passar muito da caixa
  const C = Math.min(L, escala * 16)
  const fim: [number, number, number] = [p[0] + (d.x / L) * C * 1.08, p[1] + (d.y / L) * C * 1.08, p[2] + (d.z / L) * C * 1.08]
  return (
    <group>
      <mesh position={p} quaternion={q} scale={[escala, escala, C]} geometry={geometriaSeta()}>
        <meshLambertMaterial color={cor} />
      </mesh>
      {rotulo && <Rotulo texto={rotulo} pos={fim} cor={tema.texto} px={13} peso={600} />}
    </group>
  )
}

/** Pá de rotacional: gira em torno de ∇×F, a metade do módulo em rad/s. */
function Pa({ p, v, cor, escala }: { p: [number, number, number]; v: [number, number, number]; cor: string; escala: number }) {
  const ref = useRef<Group>(null)
  const giro = useRef<Group>(null)
  const eixo = useMemo(() => new Vector3(...v), [v])
  const w = eixo.length() / 2
  const q = useMemo(() => new Quaternion().setFromUnitVectors(Z, eixo.lengthSq() > 1e-12 ? eixo.clone().normalize() : Z), [eixo])
  useFrame((st, dt) => {
    if (giro.current && w > 1e-6) {
      giro.current.rotation.z += Math.min(dt, 0.05) * w * 2
      st.invalidate()
    }
  })
  // quatro pás e o eixo numa malha só: era uma chamada de desenho por peça, por quadro, girando
  const geo = useMemo(() => {
    const partes: BufferGeometry[] = [0, 1, 2, 3].map((i) => {
      const a = (i * Math.PI) / 2
      return new BoxGeometry(1, 1, 1).scale(escala * 2.6, escala * 0.14, escala * 1.6).rotateZ(a).translate(Math.cos(a) * escala * 1.4, Math.sin(a) * escala * 1.4, 0)
    })
    partes.push(new CylinderGeometry(1, 1, 1, 10).scale(escala * 0.12, escala * 3.2, escala * 0.12).rotateX(Math.PI / 2))
    const m = mergeGeometries(partes.map((g) => g.toNonIndexed()))
    for (const g of partes) g.dispose()
    return m
  }, [escala])
  useEffect(() => () => geo.dispose(), [geo])
  return (
    <group ref={ref} position={p} quaternion={q}>
      <group ref={giro}>
        <mesh geometry={geo}>
          <meshLambertMaterial color={cor} />
        </mesh>
      </group>
    </group>
  )
}

const CORES_PAPEL: Record<string, string> = { T: '#e8766f', N: '#68c98c', B: '#6fa6ee' }

function Marcas({ m, linha, vista, tema }: { m: Marcadores; linha: Linha; vista: Vista; tema: TemaCena }) {
  const diag = diagDe(vista)
  const cor = CORES[linha.cor]
  return (
    <>
      {m.itens.map((it, i) => {
        if (it.forma === 'ponto') {
          return (
            <group key={i}>
              <mesh position={it.p} scale={diag * 0.0085}>
                <sphereGeometry args={[1, 16, 12]} />
                <meshLambertMaterial color={cor} />
              </mesh>
              {it.rotulo && <Rotulo texto={it.rotulo} pos={[it.p[0], it.p[1], it.p[2] + diag * 0.024]} cor={tema.texto} px={13} peso={600} />}
            </group>
          )
        }
        if (it.forma === 'seta') return <Seta key={i} p={it.p} v={it.v!} cor={(it.papel && CORES_PAPEL[it.papel]) ?? cor} escala={diag * 0.045} rotulo={it.rotulo} tema={tema} />
        return <Pa key={i} p={it.p} v={it.v!} cor={cor} escala={diag * 0.018} />
      })}
    </>
  )
}

const VERT_PART = `
attribute float aFade;
varying float vFade;
uniform float uTam;
void main() {
  vFade = aFade;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uTam * (0.45 + 0.55 * aFade);
}`
const FRAG_PART = `
varying float vFade;
uniform vec3 uCor;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  gl_FragColor = vec4(uCor, vFade * smoothstep(0.5, 0.2, d));
}`

const CAUDA = 5
// esmaecimento da cauda, calculado uma vez: eram cinco potências por partícula por quadro
const DESBOTA = Array.from({ length: CAUDA }, (_, k) => (1 - k / CAUDA) ** 1.6)
const TOQUE = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches

/** Partículas no próprio campo: o programa em lote dá conta de milhares por quadro. */
function Particulas({ F, dim, linha, vista, tema }: { F: Expr[]; dim: 2 | 3; linha: Linha; vista: Vista; tema: TemaCena }) {
  // no celular a integração das partículas é a maior conta de CPU por quadro
  const N = Math.round((dim === 2 ? 900 : 1500) * (TOQUE ? 0.45 : 1))
  const total = N * CAUDA
  const nums = useBancada((s) => s.resolvido.numeros)
  const prog = useMemo(() => compila(F, ['x', 'y', 'z', ...Object.keys(nums)]), [F, nums])
  const valores = useMemo(() => Object.values(nums), [nums])
  const dpr = useThree((s) => s.viewport.dpr)
  const tamanho = 5.2 * dpr
  const { geo, pos, fade } = useMemo(() => {
    const pos = new Float32Array(total * 3)
    const fade = new Float32Array(total)
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(pos, 3))
    geo.setAttribute('aFade', new BufferAttribute(fade, 1))
    return { geo, pos, fade }
  }, [total])
  const mat = useMemo(() => new ShaderMaterial({ vertexShader: VERT_PART, fragmentShader: FRAG_PART, transparent: true, depthWrite: false, blending: NormalBlending, uniforms: { uCor: { value: new Color() }, uTam: { value: 5 } } }), [])
  mat.uniforms.uTam.value = tamanho
  mat.uniforms.uCor.value.set(tema.fundo === '#12151c' ? '#f4f6fb' : CORES[linha.cor])
  const st = useRef({ x: new Float64Array(N), y: new Float64Array(N), z: new Float64Array(N), v: new Float64Array(N), lote: undefined as Lote | undefined, escala: 1 })
  const reduz = useMemo(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, [])
  const semeia = (i: number) => {
    const s = st.current
    s.x[i] = vista.x[0] + Math.random() * (vista.x[1] - vista.x[0])
    s.y[i] = vista.y[0] + Math.random() * (vista.y[1] - vista.y[0])
    s.z[i] = dim === 2 ? 0 : vista.z[0] + Math.random() * (vista.z[1] - vista.z[0])
    s.v[i] = Math.random() * 4
    for (let k = 0; k < CAUDA; k++) {
      pos[3 * (i * CAUDA + k)] = s.x[i]
      pos[3 * (i * CAUDA + k) + 1] = s.y[i]
      pos[3 * (i * CAUDA + k) + 2] = s.z[i]
    }
  }
  useLayoutEffect(() => {
    for (let i = 0; i < N; i++) semeia(i)
    const s = st.current
    const r = executa(prog, [s.x.slice(), s.y.slice(), s.z.slice(), ...valores], N)
    let soma = 0
    let cont = 0
    for (let i = 0; i < N; i++) {
      const m = Math.hypot(r.saidas[0][i], r.saidas[1][i], r.saidas[2][i])
      if (Number.isFinite(m)) {
        soma += m
        cont++
      }
    }
    // a média dá uma travessia da caixa em uns 10 s, qualquer que seja a escala do campo
    s.escala = cont && soma > 0 ? diagDe(vista) / 10 / (soma / cont) : 1
  }, [prog, valores, vista, N]) // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((three, dtReal) => {
    if (reduz) return
    const dt = Math.min(dtReal, 0.05)
    const s = st.current
    const r = executa(prog, [s.x, s.y, s.z, ...valores], N, s.lote)
    s.lote = r.lote
    const [U, V, W] = r.saidas
    for (let i = 0; i < N; i++) {
      s.v[i] -= dt
      const b = i * CAUDA
      for (let k = CAUDA - 1; k > 0; k--) {
        pos[3 * (b + k)] = pos[3 * (b + k - 1)]
        pos[3 * (b + k) + 1] = pos[3 * (b + k - 1) + 1]
        pos[3 * (b + k) + 2] = pos[3 * (b + k - 1) + 2]
      }
      s.x[i] += U[i] * s.escala * dt
      s.y[i] += V[i] * s.escala * dt
      s.z[i] += dim === 2 ? 0 : W[i] * s.escala * dt
      const fora = !(s.x[i] >= vista.x[0] && s.x[i] <= vista.x[1] && s.y[i] >= vista.y[0] && s.y[i] <= vista.y[1] && s.z[i] >= vista.z[0] && s.z[i] <= vista.z[1])
      if (fora || s.v[i] <= 0) semeia(i)
      pos[3 * b] = s.x[i]
      pos[3 * b + 1] = s.y[i]
      pos[3 * b + 2] = s.z[i]
      const vida = Math.min(1, s.v[i] * 2.2, (4 - s.v[i]) * 2.2)
      const v0 = Math.max(0, vida)
      for (let k = 0; k < CAUDA; k++) fade[b + k] = v0 * DESBOTA[k]
    }
    geo.attributes.position.needsUpdate = true
    geo.attributes.aFade.needsUpdate = true
    three.invalidate()
  })
  useEffect(() => () => {
    geo.dispose()
    mat.dispose()
  }, [geo, mat])
  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={4} />
}

function Peca({ f, linha, planos, vista, tema }: { f: Feito; linha: Linha; planos: Plane[]; vista: Vista; tema: TemaCena }) {
  switch (f.tipo) {
    case 'sup': return <Superficie m={f} linha={linha} planos={planos} vista={vista} tema={tema} />
    case 'setas': return linha.opc.setas === false ? null : <Setas m={f} linha={linha} vista={vista} />
    case 'linhas': return <Linhas m={f} planos={planos} usarCor />
    case 'marcas': return <Marcas m={f} linha={linha} vista={vista} tema={tema} />
  }
}

/** Materiais do aquecimento: ficam vivos para o programa de cada um continuar no cache da placa. */
const aquecidos: unknown[] = []

/**
 * Compila de antemão, em paralelo e fora da tela, um programa de cada tipo de peça. Sem isso, o
 * primeiro exemplo com superfície transparente, seta ou partícula compilava no meio da animação
 * e travava o quadro por dezenas de milissegundos. Os objetos ficam na camada 31, que a câmera
 * não desenha; a compilação olha só se estão visíveis.
 */
export function Aquecimento({ planos }: { planos: Plane[] }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    // sem compilação paralela, aquecer travaria a página na abertura: fica a compilação sob demanda
    if (!gl.extensions.has('KHR_parallel_shader_compile')) return
    const g = new Group()
    const tri = new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array(9), 3))
    const opaca = materialSuperficie(planos)
    const transparente = materialSuperficie(planos)
    transparente.transparent = true
    transparente.depthWrite = false
    transparente.opacity = 0.5
    const setas = new InstancedMesh(geometriaSeta(), new MeshLambertMaterial(), 1)
    setas.setColorAt(0, new Color())
    const linhas = new LineSegments2(new LineSegmentsGeometry(), new LineMaterial({ linewidth: 1.5, vertexColors: true, transparent: true, opacity: 0.92, clippingPlanes: planos }))
    const pontos = new Points(tri, new ShaderMaterial({ vertexShader: VERT_PART, fragmentShader: FRAG_PART, transparent: true, depthWrite: false, blending: NormalBlending, uniforms: { uCor: { value: new Color() }, uTam: { value: 5 } } }))
    const cv = document.createElement('canvas')
    cv.width = cv.height = 4
    const rotulo = new Sprite(new SpriteMaterial({ map: new CanvasTexture(cv), sizeAttenuation: false, depthWrite: false, transparent: true }))
    const objs = [new Mesh(tri, opaca), new Mesh(tri, transparente), setas, new Mesh(tri, new MeshLambertMaterial()), linhas, pontos, rotulo]
    for (const o of objs) {
      o.layers.set(31)
      o.frustumCulled = false
      g.add(o)
    }
    scene.add(g)
    let vivo = true
    gl.compileAsync(scene, camera)
      .catch(() => undefined)
      .finally(() => {
        scene.remove(g)
        if (vivo) aquecidos.push(...objs.map((o) => o.material))
      })
    return () => {
      vivo = false
      scene.remove(g)
    }
  }, [gl, scene, camera, planos])
  return null
}

export function Pecas({ planos, vista, tema }: { planos: Plane[]; vista: Vista; tema: TemaCena }) {
  const pecas = usePecas((s) => s.pecas)
  const linhas = useBancada((s) => s.linhas)
  const analises = useBancada((s) => s.resolvido.analises)
  const setFaixa = useBancada((s) => s.setFaixa)
  useEffect(() => {
    for (const p of Object.values(pecas)) {
      const f = p.feitos[0]
      if (f?.tipo === 'sup' && f.faixa) setFaixa(p.id, f.faixa)
    }
  }, [pecas, setFaixa])
  return (
    <>
      {Object.entries(pecas).map(([k, p]) => {
        const l = linhas.find((x) => x.id === p.id)
        if (!l?.visivel) return null
        return p.feitos.map((f, i) => <Peca key={`${k}.${i}.${f.tipo}`} f={f} linha={l} planos={planos} vista={vista} tema={tema} />)
      })}
      {linhas.map((l) => {
        if (!l.visivel || !l.opc.particulas) return null
        const a = analises.find((x) => x.id === l.id)
        const d = a?.desenhos.find((x) => x.d === 'campo')
        if (!d || d.d !== 'campo' || a?.faltando.length) return null
        return <Particulas key={l.id} F={d.F} dim={d.dim} linha={l} vista={vista} tema={tema} />
      })}
    </>
  )
}


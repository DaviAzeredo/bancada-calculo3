import { CameraControls } from '@react-three/drei'
import { Canvas, addAfterEffect, addEffect, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Mesh, MeshLambertMaterial, NeutralToneMapping, Plane, Raycaster, Vector2, Vector3 } from 'three'
import type { Vista } from '../lang/resolve'
import { useBancada } from '../store'
import { Eixos } from './Eixos'
import { ALVO, MEDIR, type Pedido, SEM_AA, SEM_RITMO, SINCRONO, useHud } from './hud'
import { TEMAS } from './materiais'
import { Aquecimento, Pecas } from './Pecas'

// a consulta é viva: ler .matches por quadro não refaz o matchMedia
const consultaMovimento = window.matchMedia?.('(prefers-reduced-motion: reduce)')
const movimentoReduzido = () => !!consultaMovimento?.matches

const DIRECOES: Record<Exclude<Pedido, 'ajusta'>, [number, number, number]> = {
  iso: [0.72, -1, 0.62],
  topo: [0, -0.0001, 1],
  frente: [0, -1, 0],
  lado: [1, 0, 0],
}

function centro(v: Vista): [number, number, number] {
  return [(v.x[0] + v.x[1]) / 2, (v.y[0] + v.y[1]) / 2, (v.z[0] + v.z[1]) / 2]
}

function Camera({ vista }: { vista: Vista }) {
  const ref = useRef<CameraControls>(null)
  const pedido = useHud((s) => s.pedido)
  const giro = useBancada((s) => s.cena.giro)
  const tamanho = useThree((s) => s.size)
  const invalida = useThree((s) => s.invalidate)
  const ultimaDir = useRef<[number, number, number]>(DIRECOES.iso)
  const primeira = useRef(true)

  const enquadra = (dir: [number, number, number], anima: boolean) => {
    const c = ref.current
    if (!c) return
    const R = Math.hypot(vista.x[1] - vista.x[0], vista.y[1] - vista.y[0], vista.z[1] - vista.z[0]) / 2
    const cam = c.camera as unknown as { fov: number; aspect: number }
    const f = (cam.fov * Math.PI) / 180
    const fH = 2 * Math.atan(Math.tan(f / 2) * cam.aspect)
    // a caixa não é a esfera que a envolve: 0,92 ainda não corta os cantos na vista 3D
    const dist = (R * 0.92) / Math.sin(Math.min(f, fH) / 2)
    const m = Math.hypot(...dir)
    const alvo = centro(vista)
    c.setLookAt(alvo[0] + (dir[0] / m) * dist, alvo[1] + (dir[1] / m) * dist, alvo[2] + (dir[2] / m) * dist, alvo[0], alvo[1], alvo[2], anima && !movimentoReduzido())
    c.minDistance = R * 0.15
    c.maxDistance = dist * 6
  }

  useEffect(() => {
    enquadra(ultimaDir.current, !primeira.current)
    primeira.current = false
  }, [vista, tamanho.width > tamanho.height]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!pedido) return
    if (pedido.tipo !== 'ajusta') ultimaDir.current = DIRECOES[pedido.tipo]
    enquadra(ultimaDir.current, true)
  }, [pedido]) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, dt) => {
    if (giro && ref.current && !movimentoReduzido()) {
      ref.current.azimuthAngle += Math.min(dt, 0.05) * 0.28
      invalida()
    }
  })
  return <CameraControls ref={ref} makeDefault smoothTime={0.28} draggingSmoothTime={0.08} />
}

/** Luz de céu e duas direcionais. Sem mapa de ambiente: ele pesava por pixel e só dava um brilho fraco. */
function Ambiente({ luz }: { luz: number }) {
  return (
    <>
      <hemisphereLight args={['#ffffff', '#6a7286', 1.05 * luz]} />
      <directionalLight position={[4, -6, 9]} intensity={1.45 * luz} />
      <directionalLight position={[-6, 5, -4]} intensity={0.45 * luz} />
    </>
  )
}

/** Coordenadas sob o cursor, com o raio limitado à caixa: o que está cortado não conta. */
function Cursor({ vista }: { vista: Vista }) {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const ray = new Raycaster()
    const p = new Vector2()
    const el = gl.domElement
    let ultimo = 0
    const mover = (e: PointerEvent) => {
      const t = performance.now()
      if (e.buttons || t - ultimo < 60) return
      ultimo = t
      const r = el.getBoundingClientRect()
      p.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(p, camera)
      const alvos: Mesh[] = []
      scene.traverse((o) => {
        if (o instanceof Mesh && o.userData.sup) alvos.push(o)
      })
      const hit = ray.intersectObjects(alvos, false).find(({ point: q }) => q.x >= vista.x[0] && q.x <= vista.x[1] && q.y >= vista.y[0] && q.y <= vista.y[1] && q.z >= vista.z[0] && q.z <= vista.z[1])
      useHud.setState({ cursor: hit ? [hit.point.x, hit.point.y, hit.point.z] : null })
    }
    const sair = () => useHud.setState({ cursor: null })
    el.addEventListener('pointermove', mover)
    el.addEventListener('pointerleave', sair)
    return () => {
      el.removeEventListener('pointermove', mover)
      el.removeEventListener('pointerleave', sair)
    }
  }, [gl, camera, scene, vista])
  return null
}

const TAXAS = [30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 240]
const TOQUE = !!window.matchMedia?.('(pointer: coarse)').matches
const DPR_MAX = Math.min(window.devicePixelRatio || 1, 2)
// celular começa mais baixo: errar para cima custa quadros perdidos logo no primeiro toque
const DPR_INICIAL = TOQUE ? Math.min(DPR_MAX, 1.5) : DPR_MAX
/** Telas densas e celulares dispensam o antisserrilhado da placa: o pixel já é pequeno, e ele custa caro. */
const AA = !SEM_AA && (window.devicePixelRatio || 1) < 1.5 && !TOQUE

/**
 * Um quadro por atualização da tela, em qualquer aparelho: 60, 90 ou 120 Hz.
 *
 * Com a cena em movimento, conta os quadros que perderam a vez (intervalo maior que 1,5 vez o da
 * tela). Quatro perdas em 20 quadros baixam a densidade de pixels em 18%, até 0,5; um segundo e
 * meio sem perda nenhuma sobe 10%, sem passar do último nível que falhou nos 8 s anteriores. Parada
 * por 500 ms, a cena desenha um quadro na densidade inteira; o movimento seguinte já começa na
 * densidade aprendida. No celular não há essa troca: cada uma realocava o canvas. O ritmo da tela
 * sai dos quadros mais rápidos, que o vsync prende a ele.
 *
 * Travas contra a espiral para baixo, cada uma nascida de um defeito medido no celular:
 * - só conta o intervalo até um quadro que o anterior pediu (câmera em movimento, animação). Peça
 *   de malha chegando ou teclado abrindo desenham quadros soltos, e a folga entre eles não é perda;
 * - depois de cada troca, 12 quadros não contam: realocar o canvas deixa o seguinte lento;
 * - quadro em que a CPU usou 60% do intervalo não conta: menos pixels não acelera JavaScript;
 * - baixou e o tempo médio do quadro não caiu 10%? O gargalo não era a placa: volta à densidade
 *   anterior e só tenta de novo depois de 10 s, dobrando a espera a cada erro, até 60 s. O teste é
 *   o tempo médio, e não a contagem de perdas: placa muito sobrecarregada segue perdendo quadro
 *   depois do primeiro passo, mas já desenha mais rápido.
 */
function Ritmo() {
  const setDpr = (v: number) => useHud.setState({ densidade: v })
  const invalida = useThree((s) => s.invalidate)
  const get = useThree((s) => s.get)
  // piso baixo para o caso extremo (16 superfícies transparentes): parada, a cena volta nítida
  const piso = Math.min(DPR_MAX, 0.5)
  const st = useRef({
    ultimo: 0,
    dpr: DPR_INICIAL,
    movimento: DPR_INICIAL,
    intervalo: 1000 / (ALVO || 60),
    deltas: [] as number[],
    n: 0,
    perdas: 0,
    grandes: 0,
    estavel: 0,
    teto: DPR_MAX,
    falhouEm: -1e9,
    carencia: 0,
    ini: 0,
    cpu: 0,
    esperado: false,
    soma: 0,
    conferindo: null as { dpr: number; media: number } | null,
    bloqueioAte: 0,
    espera: 10000,
  })
  // só com ?fps: estado do controle para diagnóstico
  if (MEDIR) Object.assign(window, { __ritmo: st.current })
  const aplica = (v: number) => {
    const s = st.current
    if (Math.abs(v - s.dpr) < 0.01) return
    s.dpr = v
    s.carencia = 12
    setDpr(v)
  }
  // tempo de CPU do quadro e se ele pediu o seguinte: na R3F sob demanda, um useFrame que invalida
  // deixa internal.frames acima de zero no fim do quadro
  useEffect(() => {
    const s = st.current
    const tira1 = addEffect(() => {
      s.ini = performance.now()
    })
    const tira2 = addAfterEffect(() => {
      s.cpu = performance.now() - s.ini
      const e = get()
      s.esperado = e.frameloop === 'always' || e.internal.frames > 0
    })
    return () => {
      tira1()
      tira2()
    }
  }, [get])
  const zera = () => {
    const s = st.current
    s.n = 0
    s.perdas = 0
    s.grandes = 0
    s.soma = 0
  }
  useFrame(() => {
    const s = st.current
    const t = performance.now()
    const dt = t - s.ultimo
    s.ultimo = t
    const esperado = s.esperado
    if (dt > 250) {
      // começo de movimento: sai da densidade de repouso para a que a tela aguenta
      zera()
      aplica(s.movimento)
      return
    }
    if (!esperado) return
    if (!ALVO) {
      s.deltas.push(dt)
      if (s.deltas.length >= 60) {
        const p = [...s.deltas].sort((a, b) => a - b)[6]
        const hz = TAXAS.reduce((m, r) => (Math.abs(1000 / r - p) < Math.abs(1000 / m - p) ? r : m))
        s.intervalo = 1000 / hz
        s.deltas.length = 0
      }
    }
    if (s.carencia > 0) {
      s.carencia--
      return
    }
    s.n++
    s.soma += dt
    // acima de 4 intervalos é pico isolado: compilação, envio de malha ou coleta de lixo, que a
    // resolução não resolve. Só conta como perda quando se repete (4 em 20 quadros).
    const culpaDaPlaca = s.cpu < s.intervalo * 0.6
    if (dt > s.intervalo * 4) {
      if (culpaDaPlaca) s.grandes++
    } else if (dt > s.intervalo * 1.5 && culpaDaPlaca) s.perdas++
    if (s.n < 20) return
    const perdas = s.perdas + (s.grandes >= 4 ? s.grandes : 0)
    const media = s.soma / s.n
    zera()
    if (s.conferindo) {
      const c = s.conferindo
      s.conferindo = null
      if (perdas > 0 && media > c.media * 0.9) {
        // menos pixels não ajudou: volta e espera antes de tentar outra vez
        s.movimento = c.dpr
        s.bloqueioAte = t + s.espera
        s.espera = Math.min(60000, s.espera * 2)
        aplica(c.dpr)
        return
      }
      s.espera = 10000
    }
    if (t - s.falhouEm > 8000) s.teto = DPR_MAX
    // placa sobrecarregada perde quase todo quadro; 4 em 20 separa isso de pico esporádico
    if (perdas >= 4 && s.movimento > piso && t > s.bloqueioAte) {
      s.conferindo = { dpr: s.movimento, media }
      s.teto = s.movimento
      s.falhouEm = t
      s.movimento = Math.max(piso, s.movimento * 0.82)
      s.estavel = 0
      aplica(s.movimento)
    } else if (perdas === 0) {
      s.estavel += 20
      const alvo = Math.min(DPR_MAX, s.movimento * 1.1, s.teto * 0.96)
      if (s.estavel >= Math.max(90, 1500 / s.intervalo) && alvo > s.movimento + 0.01) {
        s.movimento = alvo
        s.estavel = 0
        aplica(s.movimento)
      }
    } else s.estavel = 0
  })
  useEffect(() => {
    // no celular, trocar a densidade ao parar e ao voltar a mexer realocava o canvas a cada toque:
    // lá a cena fica na densidade aprendida, que sobe sozinha quando a placa aguenta
    if (TOQUE) return
    const id = setInterval(() => {
      const s = st.current
      if (s.dpr < DPR_MAX && performance.now() - s.ultimo > 500) {
        s.dpr = DPR_MAX
        setDpr(DPR_MAX)
        invalida()
      }
    }, 250)
    return () => clearInterval(id)
  }, [invalida]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

/** Quadros por segundo com a cena desenhando sem parar, mais a placa que o navegador usou. */
function Medidor() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const quadros = useRef(0)
  // só com ?fps: alça para diagnóstico pelo console
  useEffect(() => {
    Object.assign(window, { __cena: { scene, gl, MeshLambertMaterial, addEffect, addAfterEffect } })
  }, [scene, gl])
  useEffect(() => {
    if (!SINCRONO) return
    const ctx = gl.getContext()
    const px = new Uint8Array(4)
    return addAfterEffect(() => ctx.readPixels(0, 0, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, px))
  }, [gl])
  useFrame(() => {
    quadros.current++
  })
  useEffect(() => {
    const ctx = gl.getContext()
    const ext = ctx.getExtension('WEBGL_debug_renderer_info')
    const gpu = String(ext ? ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ctx.getParameter(ctx.RENDERER))
    let t0 = performance.now()
    const id = setInterval(() => {
      const t = performance.now()
      const el = gl.domElement
      useHud.setState({ medida: { fps: (quadros.current * 1000) / (t - t0), gpu, triangulos: gl.info.render.triangles, dpr: gl.getPixelRatio(), largura: el.width, altura: el.height } })
      quadros.current = 0
      t0 = t
    }, 1000)
    return () => clearInterval(id)
  }, [gl])
  return null
}

function Captura() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    useHud.setState({
      capturar: () => {
        // o buffer só vale logo depois do render: desenha e lê no mesmo instante
        gl.render(scene, camera)
        gl.domElement.toBlob((b) => {
          if (!b) return
          const a = document.createElement('a')
          a.href = URL.createObjectURL(b)
          a.download = 'bancada-calculo3.png'
          a.click()
          setTimeout(() => URL.revokeObjectURL(a.href), 2000)
        }, 'image/png')
      },
    })
    return () => useHud.setState({ capturar: null })
  }, [gl, scene, camera])
  return null
}

function planosDa(v: Vista) {
  const m = 1e-3 * Math.max(v.x[1] - v.x[0], v.y[1] - v.y[0], v.z[1] - v.z[0])
  return [
    new Plane(new Vector3(1, 0, 0), -v.x[0] + m),
    new Plane(new Vector3(-1, 0, 0), v.x[1] + m),
    new Plane(new Vector3(0, 1, 0), -v.y[0] + m),
    new Plane(new Vector3(0, -1, 0), v.y[1] + m),
    new Plane(new Vector3(0, 0, 1), -v.z[0] + m),
    new Plane(new Vector3(0, 0, -1), v.z[1] + m),
  ]
}

function temWebGL() {
  try {
    return !!document.createElement('canvas').getContext('webgl2')
  } catch {
    return false
  }
}

export function Viewport() {
  const temaNome = useBancada((s) => s.tema)
  const vista = useBancada((s) => s.vista)
  const cena = useBancada((s) => s.cena)
  const densidade = useHud((s) => s.densidade) ?? DPR_INICIAL
  const tema = TEMAS[temaNome]
  const planos = useMemo(() => planosDa(vista), [vista])
  const webgl = useMemo(temWebGL, [])
  if (!webgl) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-text-2">
        <p className="max-w-sm text-[13px] leading-relaxed">
          Este navegador não ofereceu WebGL 2, então a cena 3D não abre aqui. As fórmulas, derivadas e integrais do painel continuam funcionando.
        </p>
      </div>
    )
  }
  return (
    <Canvas
      frameloop={MEDIR ? 'always' : 'demand'}
      dpr={densidade}
      camera={{ fov: 30, near: 0.02, far: 4000, up: [0, 0, 1], position: [7, -10, 6] }}
      gl={{ antialias: AA, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        // a conferência de erro de shader espera a placa terminar de ligar o programa: só em desenvolvimento
        gl.debug.checkShaderErrors = import.meta.env.DEV
        gl.localClippingEnabled = true
        gl.toneMapping = NeutralToneMapping
        gl.toneMappingExposure = 1
      }}
      aria-label="Cena 3D: arraste para girar, role para aproximar"
    >
      <color attach="background" args={[tema.fundo]} />
      <Ambiente luz={tema.luz} />
      <Camera vista={vista} />
      <Eixos vista={vista} tema={tema} eixos={cena.eixos} grade={cena.grade} caixa={cena.caixa} rotulos={cena.rotulos} />
      <Pecas planos={planos} vista={vista} tema={tema} />
      <Aquecimento planos={planos} />
      <Cursor vista={vista} />
      <Captura />
      {!SEM_RITMO && <Ritmo />}
      {MEDIR && <Medidor />}
    </Canvas>
  )
}

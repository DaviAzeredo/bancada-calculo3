import { CameraControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Mesh, NeutralToneMapping, PMREMGenerator, Plane, Raycaster, Scene, Vector2, Vector3 } from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { Vista } from '../lang/resolve'
import { useBancada } from '../store'
import { Eixos } from './Eixos'
import { type Pedido, useHud } from './hud'
import { TEMAS } from './materiais'
import { Pecas } from './Pecas'

const movimentoReduzido = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

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

function Ambiente({ luz }: { luz: number }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const pm = new PMREMGenerator(gl)
    const salas = new RoomEnvironment()
    const rt = pm.fromScene(salas as unknown as Scene, 0.04)
    scene.environment = rt.texture
    salas.dispose?.()
    pm.dispose()
    return () => {
      scene.environment = null
      rt.dispose()
    }
  }, [gl, scene])
  return (
    <>
      <hemisphereLight args={['#ffffff', '#6a7286', 0.75 * luz]} />
      <directionalLight position={[4, -6, 9]} intensity={1.35 * luz} />
      <directionalLight position={[-6, 5, -4]} intensity={0.4 * luz} />
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
      frameloop="demand"
      dpr={[1, 2]}
      camera={{ fov: 30, near: 0.02, far: 4000, up: [0, 0, 1], position: [7, -10, 6] }}
      gl={{ antialias: true }}
      onCreated={({ gl }) => {
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
      <Cursor vista={vista} />
      <Captura />
    </Canvas>
  )
}

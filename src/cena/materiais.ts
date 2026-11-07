import { BufferAttribute, BufferGeometry, Color, ConeGeometry, CylinderGeometry, DoubleSide, MeshLambertMaterial, type Plane, Sphere, Vector2, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { MalhaSup } from '../malha/malhas'

export type TemaCena = {
  fundo: string
  grade: string
  gradeForte: string
  caixa: string
  texto: string
  eixos: [string, string, string]
  linha: string
  luz: number
}

export const TEMAS: Record<'escuro' | 'claro', TemaCena> = {
  escuro: { fundo: '#12151c', grade: '#2a2f3b', gradeForte: '#3a4150', caixa: '#404857', texto: '#aeb6c6', eixos: ['#e8766f', '#68c98c', '#6fa6ee'], linha: '#0d1016', luz: 1 },
  claro: { fundo: '#f4f5f8', grade: '#dcdfe6', gradeForte: '#c3c8d2', caixa: '#b4bac6', texto: '#4a5262', eixos: ['#c8413a', '#2f9a5a', '#2f6fd0'], linha: '#23272f', luz: 1.15 },
}

/** Mapa frio → quente, igual em setas, linhas e superfícies: a mesma cor quer dizer o mesmo módulo. */
const RAMPA = [
  [0.27, 0.42, 0.85],
  [0.2, 0.68, 0.76],
  [0.45, 0.8, 0.45],
  [0.95, 0.78, 0.3],
  [0.93, 0.36, 0.3],
]

export function rampa(t: number, c: Color) {
  const x = Math.min(0.9999, Math.max(0, t)) * (RAMPA.length - 1)
  const i = Math.floor(x)
  const f = x - i
  c.setRGB(RAMPA[i][0] + f * (RAMPA[i + 1][0] - RAMPA[i][0]), RAMPA[i][1] + f * (RAMPA[i + 1][1] - RAMPA[i][1]), RAMPA[i][2] + f * (RAMPA[i + 1][2] - RAMPA[i][2]))
  return c
}

const GLSL_RAMPA = `
vec3 rampaC(float t) {
  vec3 c0 = vec3(${RAMPA[0].join(',')}), c1 = vec3(${RAMPA[1].join(',')}), c2 = vec3(${RAMPA[2].join(',')}), c3 = vec3(${RAMPA[3].join(',')}), c4 = vec3(${RAMPA[4].join(',')});
  float x = clamp(t, 0.0, 0.9999) * 4.0;
  if (x < 1.0) return mix(c0, c1, x);
  if (x < 2.0) return mix(c1, c2, x - 1.0);
  if (x < 3.0) return mix(c2, c3, x - 2.0);
  return mix(c3, c4, x - 3.0);
}`

export type MatSup = MeshLambertMaterial & {
  u: {
    uLinhas: { value: number }
    uPasso: { value: Vector2 }
    uCorLinha: { value: Color }
    uContorno: { value: number }
    uMapa: { value: number }
    uFaixa: { value: Vector2 }
  }
}

/**
 * Um material por peça, sempre o mesmo objeto: trocar de material a cada quadro religaria
 * o shader. Linhas de grade e curvas de nível saem do fragment shader, com a espessura em
 * pixels: nenhuma geometria extra, e ficam iguais em qualquer zoom.
 *
 * Lambert, e não o material físico: com a meta de 120 quadros/s, o custo por pixel decide, e
 * o reflexo especular quase não aparecia numa superfície fosca.
 */
export function materialSuperficie(planos: Plane[]): MatSup {
  const m = new MeshLambertMaterial({ side: DoubleSide, clippingPlanes: planos }) as MatSup
  m.u = {
    uLinhas: { value: 0 },
    uPasso: { value: new Vector2(16, 16) },
    uCorLinha: { value: new Color('#000') },
    uContorno: { value: 0 },
    uMapa: { value: 0 },
    uFaixa: { value: new Vector2(-1, 1) },
  }
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, m.u)
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aUv;\nvarying vec2 vGrade;\nvarying vec3 vPosM;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGrade = aUv;\nvPosM = position;')
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec2 vGrade;
varying vec3 vPosM;
uniform float uLinhas, uContorno, uMapa;
uniform vec2 uPasso, uFaixa;
uniform vec3 uCorLinha;
${GLSL_RAMPA}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
if (uMapa > 0.5) diffuseColor.rgb = rampaC((vPosM.z - uFaixa.x) / (uFaixa.y - uFaixa.x));
// o verso sai mais escuro: dá para ver de que lado da superfície se está
if (!gl_FrontFacing) diffuseColor.rgb *= 0.72;
float traco = 0.0;
if (uLinhas > 0.0) {
  vec2 c = vGrade * uPasso;
  vec2 w = max(fwidth(c), vec2(1e-5));
  vec2 g = abs(fract(c - 0.5) - 0.5) / w;
  float nit = 1.0 - smoothstep(0.22, 0.55, max(w.x, w.y));
  traco = (1.0 - min(min(g.x, g.y), 1.0)) * uLinhas * nit;
}
if (uContorno > 0.0) {
  float c = vPosM.z / uContorno;
  float w = max(fwidth(c), 1e-5);
  float g = abs(fract(c - 0.5) - 0.5) / w;
  traco = max(traco, (1.0 - min(g / 1.15, 1.0)) * 0.75);
}
diffuseColor.rgb = mix(diffuseColor.rgb, uCorLinha, traco);`)
  }
  m.customProgramCacheKey = () => 'superficie-2'
  return m
}

/**
 * Geometria que só cresce. Trocar atributos deixaria os buffers antigos vivos até o
 * `dispose`, e a limpeza da R3F é ociosa: com a cena animando, ela não roda.
 */
export class GeoDinamica {
  geo = new BufferGeometry()
  capV = 0
  capI = 0
  idx: Uint32Array | null = null
  uv: Float32Array | null = null

  atualiza(m: MalhaSup, raio: number) {
    const nV = m.pos.length / 3
    const nI = m.idx.length
    if (nV > this.capV || nI > this.capI) {
      this.geo.dispose()
      this.geo = new BufferGeometry()
      this.capV = Math.ceil(nV * 1.2) + 16
      this.capI = Math.ceil(nI * 1.2) + 48
      this.geo.setAttribute('position', new BufferAttribute(new Float32Array(this.capV * 3), 3))
      this.geo.setAttribute('normal', new BufferAttribute(new Float32Array(this.capV * 3), 3))
      this.geo.setAttribute('aUv', new BufferAttribute(new Float32Array(this.capV * 2), 2))
      this.geo.setIndex(new BufferAttribute(new Uint32Array(this.capI), 1))
      this.idx = null
      this.uv = null
    }
    const a = this.geo.attributes
    const envia = (attr: BufferAttribute, v: ArrayLike<number>, tam: number) => {
      ;(attr.array as Float32Array).set(v)
      attr.clearUpdateRanges()
      attr.addUpdateRange(0, tam)
      attr.needsUpdate = true
    }
    envia(a.position as BufferAttribute, m.pos, m.pos.length)
    envia(a.normal as BufferAttribute, m.nor, m.nor.length)
    // escrever num buffer que a placa ainda lê faz o driver esperar: o que não mudou fica
    if (!iguais(this.uv, m.uv)) {
      envia(a.aUv as BufferAttribute, m.uv, m.uv.length)
      this.uv = m.uv.slice()
    }
    if (!iguais(this.idx, m.idx)) {
      envia(this.geo.index as BufferAttribute, m.idx, nI)
      this.idx = m.idx.slice()
    }
    this.geo.setDrawRange(0, nI)
    this.geo.boundingSphere = new Sphere(new Vector3(), raio)
  }
}

function iguais(a: ArrayLike<number> | null, b: ArrayLike<number>) {
  if (!a || a.length !== b.length) return false
  for (let i = 0; i < b.length; i++) if (a[i] !== b[i]) return false
  return true
}

let setaUnit: BufferGeometry | null = null
/** Seta de comprimento 1 ao longo de +Z, com a base na origem. */
export function geometriaSeta() {
  if (setaUnit) return setaUnit
  const haste = new CylinderGeometry(0.045, 0.045, 0.72, 6, 1, true)
  haste.rotateX(Math.PI / 2)
  haste.translate(0, 0, 0.36)
  const ponta = new ConeGeometry(0.13, 0.28, 8)
  ponta.rotateX(Math.PI / 2)
  ponta.translate(0, 0, 0.86)
  setaUnit = mergeGeometries([haste, ponta])
  return setaUnit
}


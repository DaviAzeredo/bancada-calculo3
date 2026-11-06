import { type Expr, S as Sim, ZERO, avalia, deNumero, dep, sub, subst } from '../math/alg'
import { cruz, deriva } from '../math/diff'
import { avaliaTudo, compila } from '../math/lote'
import type { Limite } from '../math/quad'
import { type Nums, fixa } from '../lang/calculos'
import { type Regiao, posicao, pullback } from '../lang/regiao'
import type { Desenho, Vista } from '../lang/resolve'

export type MalhaSup = { tipo: 'sup'; pos: Float32Array; nor: Float32Array; uv: Float32Array; idx: Uint32Array; faixa?: [number, number]; lin?: 'coord' | 'param' }
export type MalhaSetas = { tipo: 'setas'; pos: Float32Array; dir: Float32Array; mag: Float32Array; max: number }
export type MalhaLinhas = { tipo: 'linhas'; seg: Float32Array; val: Float32Array; min: number; max: number }
export type Marcadores = { tipo: 'marcas'; itens: { p: [number, number, number]; v?: [number, number, number]; rotulo?: string; papel?: string; forma: 'ponto' | 'seta' | 'pa' }[] }
export type Feito = MalhaSup | MalhaSetas | MalhaLinhas | Marcadores

export type Qualidade = { grade: number; implicita: number; desig: number; tubo: number }
export const QUALIDADE: Record<'alta' | 'media' | 'baixa', Qualidade> = {
  alta: { grade: 180, implicita: 88, desig: 72, tubo: 700 },
  media: { grade: 120, implicita: 64, desig: 52, tubo: 500 },
  baixa: { grade: 64, implicita: 40, desig: 36, tubo: 260 },
}

export type Opcoes = { nivel?: number; unitarias?: boolean; densidade?: number; linhasFluxo?: boolean }

type Ctx = { nums: Nums; vista: Vista; q: Qualidade; opc: Opcoes }

const diagonal = (v: Vista) => Math.hypot(v.x[1] - v.x[0], v.y[1] - v.y[0], v.z[1] - v.z[0])

function compilador(nums: Nums) {
  const nomes = Object.keys(nums)
  const vals = nomes.map((k) => nums[k])
  return (exprs: Expr[], entradas: string[]) => {
    const p = compila(exprs, [...entradas, ...nomes])
    return (ent: Float64Array[], n: number) => avaliaTudo(p, [...ent, ...vals], n)
  }
}

type Amostra = { P: Float64Array[]; N?: Float64Array[] }
type Amostrador = (s: Float64Array, t: Float64Array, n: number) => Amostra

const finito = (x: number, y: number, z: number) => Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z) && Math.abs(x) < 1e7 && Math.abs(y) < 1e7 && Math.abs(z) < 1e7

/**
 * Grade (s, t) em [0, 1]² para triângulos. Onde a função sai do domínio, a borda é achada
 * por bissecção ao longo das arestas: a semiesfera z = √(1 − x² − y²) termina num círculo
 * liso, e não numa escada. `saltoMax` corta as paredes falsas de polos como 1/x.
 */
function grade(am: Amostrador, nu: number, nv: number, saltoMax = Infinity, eixoSalto = 2): MalhaSup {
  const nV = (nu + 1) * (nv + 1)
  const S = new Float64Array(nV)
  const T = new Float64Array(nV)
  for (let j = 0, k = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++, k++) {
      S[k] = i / nu
      T[k] = j / nv
    }
  }
  const { P, N } = am(S, T, nV)
  const [X, Y, Z] = P
  const ok = new Uint8Array(nV)
  for (let k = 0; k < nV; k++) ok[k] = finito(X[k], Y[k], Z[k]) ? 1 : 0

  const mapa = new Int32Array(nV).fill(-1)
  const pos: number[] = []
  const nor: number[] = []
  const uv: number[] = []
  const semNormal: number[] = []
  const novoVertice = (x: number, y: number, z: number, nx: number, ny: number, nz: number, s: number, t: number) => {
    const id = pos.length / 3
    const m = Math.hypot(nx, ny, nz)
    pos.push(x, y, z)
    uv.push(s, t)
    if (Number.isFinite(m) && m > 1e-12) nor.push(nx / m, ny / m, nz / m)
    else {
      nor.push(0, 0, 0)
      semNormal.push(id)
    }
    return id
  }
  const vert = (k: number) => {
    if (mapa[k] >= 0) return mapa[k]
    mapa[k] = novoVertice(X[k], Y[k], Z[k], N ? N[0][k] : NaN, N ? N[1][k] : NaN, N ? N[2][k] : NaN, S[k], T[k])
    return mapa[k]
  }

  const idx: number[] = []
  const eixo = P[eixoSalto]
  const mistos: number[] = []
  const tri = (a: number, b: number, c: number) => {
    const v = ok[a] + ok[b] + ok[c]
    if (v === 0) return
    if (v < 3) {
      mistos.push(a, b, c)
      return
    }
    if (saltoMax < Infinity) {
      const lo = Math.min(eixo[a], eixo[b], eixo[c])
      const hi = Math.max(eixo[a], eixo[b], eixo[c])
      if (hi - lo > saltoMax) return
    }
    idx.push(vert(a), vert(b), vert(c))
  }
  const d2 = (a: number, b: number) => (X[a] - X[b]) ** 2 + (Y[a] - Y[b]) ** 2 + (Z[a] - Z[b]) ** 2
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i
      const b = a + 1
      const c = a + nu + 2
      const d = a + nu + 1
      // a diagonal mais curta acompanha cristas que a grade cruza na transversal
      if (d2(a, c) <= d2(b, d) || !Number.isFinite(d2(b, d))) {
        tri(a, b, c)
        tri(a, c, d)
      } else {
        tri(a, b, d)
        tri(b, c, d)
      }
    }
  }

  if (mistos.length) {
    // uma entrada por aresta válida → inválida, resolvidas juntas
    const arestas = new Map<number, number>()
    const lista: [number, number][] = []
    const aresta = (bom: number, ruim: number) => {
      const k = bom * nV + ruim
      let i = arestas.get(k)
      if (i === undefined) {
        i = lista.length
        arestas.set(k, i)
        lista.push([bom, ruim])
      }
      return i
    }
    const pedidos: { tipo: 1 | 2; a: number; b: number; e1: number; e2: number }[] = []
    for (let i = 0; i < mistos.length; i += 3) {
      let [a, b, c] = [mistos[i], mistos[i + 1], mistos[i + 2]]
      const v = ok[a] + ok[b] + ok[c]
      if (v === 1) {
        while (!ok[a]) [a, b, c] = [b, c, a]
        pedidos.push({ tipo: 1, a, b: 0, e1: aresta(a, b), e2: aresta(a, c) })
      } else {
        while (ok[c]) [a, b, c] = [b, c, a]
        pedidos.push({ tipo: 2, a, b, e1: aresta(b, c), e2: aresta(a, c) })
      }
    }
    const m = lista.length
    const [sa, ta, sb, tb] = [new Float64Array(m), new Float64Array(m), new Float64Array(m), new Float64Array(m)]
    lista.forEach(([bom, ruim], i) => {
      sa[i] = S[bom]
      ta[i] = T[bom]
      sb[i] = S[ruim]
      tb[i] = T[ruim]
    })
    const [sm, tm] = [new Float64Array(m), new Float64Array(m)]
    for (let it = 0; it < 22; it++) {
      for (let i = 0; i < m; i++) {
        sm[i] = (sa[i] + sb[i]) / 2
        tm[i] = (ta[i] + tb[i]) / 2
      }
      const r = am(sm, tm, m).P
      for (let i = 0; i < m; i++) {
        if (finito(r[0][i], r[1][i], r[2][i])) {
          sa[i] = sm[i]
          ta[i] = tm[i]
        } else {
          sb[i] = sm[i]
          tb[i] = tm[i]
        }
      }
    }
    const f = am(sa, ta, m)
    const novos = Array.from({ length: m }, (_, i) => novoVertice(f.P[0][i], f.P[1][i], f.P[2][i], f.N ? f.N[0][i] : NaN, f.N ? f.N[1][i] : NaN, f.N ? f.N[2][i] : NaN, sa[i], ta[i]))
    const alto = (e: number) => f.P[eixoSalto][e]
    for (const p of pedidos) {
      // perto de um polo a bissecção sobe até o limite numérico: isso também é parede
      if (saltoMax < Infinity) {
        const z = [eixo[p.a], alto(p.e1), alto(p.e2), ...(p.tipo === 2 ? [eixo[p.b]] : [])]
        if (Math.max(...z) - Math.min(...z) > saltoMax) continue
      }
      if (p.tipo === 1) idx.push(vert(p.a), novos[p.e1], novos[p.e2])
      else idx.push(vert(p.a), vert(p.b), novos[p.e1], vert(p.a), novos[p.e1], novos[p.e2])
    }
  }
  return fecha(pos, nor, uv, idx, semNormal)
}

/** Polos e bordas sem normal analítica herdam a média das faces em volta. */
function fecha(pos: number[], nor: number[], uv: number[], idx: number[], semNormal: number[]): MalhaSup {
  if (semNormal.length) {
    const falta = new Set(semNormal)
    for (let i = 0; i < idx.length; i += 3) {
      const [a, b, c] = [idx[i], idx[i + 1], idx[i + 2]]
      if (!falta.has(a) && !falta.has(b) && !falta.has(c)) continue
      const ux = pos[3 * b] - pos[3 * a]
      const uy = pos[3 * b + 1] - pos[3 * a + 1]
      const uz = pos[3 * b + 2] - pos[3 * a + 2]
      const vx = pos[3 * c] - pos[3 * a]
      const vy = pos[3 * c + 1] - pos[3 * a + 1]
      const vz = pos[3 * c + 2] - pos[3 * a + 2]
      const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]
      for (const k of [a, b, c]) if (falta.has(k)) for (let e = 0; e < 3; e++) nor[3 * k + e] += n[e]
    }
    for (const k of semNormal) {
      const m = Math.hypot(nor[3 * k], nor[3 * k + 1], nor[3 * k + 2]) || 1
      for (let e = 0; e < 3; e++) nor[3 * k + e] /= m
    }
  }
  return { tipo: 'sup', pos: Float32Array.from(pos), nor: Float32Array.from(nor), uv: Float32Array.from(uv), idx: Uint32Array.from(idx) }
}

/** Recorte por g ≤ 0, triângulo a triângulo, para a borda sair nítida e não em dentes. */
export function recorta(m: MalhaSup, g: (x: Float64Array, y: Float64Array, z: Float64Array, n: number) => Float64Array): MalhaSup {
  const n = m.pos.length / 3
  const x = new Float64Array(n)
  const y = new Float64Array(n)
  const z = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    x[i] = m.pos[3 * i]
    y[i] = m.pos[3 * i + 1]
    z[i] = m.pos[3 * i + 2]
  }
  const v = g(x, y, z, n)
  const pos = Array.from(m.pos)
  const nor = Array.from(m.nor)
  const uv = Array.from(m.uv)
  const idx: number[] = []
  const cache = new Map<number, number>()
  const corte = (a: number, b: number) => {
    const k = a < b ? a * n + b : b * n + a
    const c = cache.get(k)
    if (c !== undefined) return c
    const t = v[a] / (v[a] - v[b])
    const id = pos.length / 3
    for (let e = 0; e < 3; e++) {
      pos.push(m.pos[3 * a + e] + t * (m.pos[3 * b + e] - m.pos[3 * a + e]))
      nor.push(m.nor[3 * a + e] + t * (m.nor[3 * b + e] - m.nor[3 * a + e]))
    }
    for (let e = 0; e < 2; e++) uv.push(m.uv[2 * a + e] + t * (m.uv[2 * b + e] - m.uv[2 * a + e]))
    cache.set(k, id)
    return id
  }
  const dentro = (i: number) => v[i] <= 0
  for (let i = 0; i < m.idx.length; i += 3) {
    let [a, b, c] = [m.idx[i], m.idx[i + 1], m.idx[i + 2]]
    const q = (dentro(a) ? 1 : 0) + (dentro(b) ? 1 : 0) + (dentro(c) ? 1 : 0)
    if (q === 0 || Number.isNaN(v[a] + v[b] + v[c])) continue
    if (q === 3) {
      idx.push(a, b, c)
      continue
    }
    if (q === 1) {
      while (!dentro(a)) [a, b, c] = [b, c, a]
      idx.push(a, corte(a, b), corte(a, c))
    } else {
      while (dentro(c)) [a, b, c] = [b, c, a]
      const [p, r] = [corte(b, c), corte(a, c)]
      idx.push(a, b, p, a, p, r)
    }
  }
  return compacta(pos, nor, uv, idx, m.faixa)
}

/** Tira os vértices que o recorte deixou sem triângulo: a GPU não precisa deles. */
function compacta(pos: number[], nor: number[], uv: number[], idx: number[], faixa?: [number, number]): MalhaSup {
  const mapa = new Int32Array(pos.length / 3).fill(-1)
  let n = 0
  for (const i of idx) if (mapa[i] < 0) mapa[i] = n++
  const [P, N, U] = [new Float32Array(3 * n), new Float32Array(3 * n), new Float32Array(2 * n)]
  for (let i = 0; i < mapa.length; i++) {
    const k = mapa[i]
    if (k < 0) continue
    for (let e = 0; e < 3; e++) {
      P[3 * k + e] = pos[3 * i + e]
      N[3 * k + e] = nor[3 * i + e]
    }
    U[2 * k] = uv[2 * i]
    U[2 * k + 1] = uv[2 * i + 1]
  }
  return { tipo: 'sup', pos: P, nor: N, uv: U, idx: Uint32Array.from(idx, (i) => mapa[i]), faixa }
}

function restricao(gs: Expr[], nums: Nums) {
  const c = compilador(nums)
  return gs.map((g) => {
    const f = c([g], ['x', 'y', 'z'])
    return (x: Float64Array, y: Float64Array, z: Float64Array, n: number) => f([x, y, z], n)[0]
  })
}

function malhaGrafico(d: Extract<Desenho, { d: 'grafico' }>, c: Ctx): MalhaSup {
  const { vista: w, nums, q } = c
  // (a, b) em ordem cíclica: Pₐ × P_b aponta para o eixo do gráfico
  const [na, nb] = d.eixo === 'z' ? (['x', 'y'] as const) : d.eixo === 'x' ? (['y', 'z'] as const) : (['z', 'x'] as const)
  const [a0, a1] = w[na]
  const [b0, b1] = w[nb]
  const ev = compilador(nums)([d.f, deriva(d.f, na), deriva(d.f, nb)], [na, nb])
  const am: Amostrador = (s, t, n) => {
    const A = new Float64Array(n)
    const B = new Float64Array(n)
    for (let i = 0; i < n; i++) {
      A[i] = a0 + s[i] * (a1 - a0)
      B[i] = b0 + t[i] * (b1 - b0)
    }
    const [f, fa, fb] = ev([A, B], n)
    const nx = new Float64Array(n)
    const ny = new Float64Array(n)
    const nz = new Float64Array(n)
    const um = new Float64Array(n).fill(1)
    const [P, N] = d.eixo === 'z' ? [[A, B, f], [nx, ny, um]] : d.eixo === 'x' ? [[f, A, B], [um, ny, nz]] : [[B, f, A], [nx, um, nz]]
    for (let i = 0; i < n; i++) {
      const [e1, e2] = d.eixo === 'z' ? [nx, ny] : d.eixo === 'x' ? [ny, nz] : [nz, nx]
      e1[i] = -fa[i]
      e2[i] = -fb[i]
    }
    return { P, N }
  }
  const range = d.eixo === 'z' ? w.z : w[d.eixo]
  const eixoIdx = d.eixo === 'x' ? 0 : d.eixo === 'y' ? 1 : 2
  let m = grade(am, q.grade, q.grade, (range[1] - range[0]) * 3, eixoIdx)
  for (const g of restricao(d.restr, nums)) m = recorta(m, g)
  return m
}

function intervalo(l: Limite, nums: Nums): [number, number] {
  return [avalia(l.lo, nums), avalia(l.hi, nums)]
}

/** Superfície paramétrica; o limite de v pode depender de u, como nas regiões iteradas. */
function amostradorParam(Sx: Expr[], u: Limite, v: Limite, nums: Nums): Amostrador {
  const c = compilador(nums)
  const Su = Sx.map((e) => deriva(e, u.v))
  const Sv = Sx.map((e) => deriva(e, v.v))
  const N = cruz(Su, Sv)
  const ev = c([...Sx, ...N], [u.v, v.v])
  const lim = c([v.lo, v.hi], [u.v])
  const [u0, u1] = intervalo(u, nums)
  return (s, t, n) => {
    const U = new Float64Array(n)
    for (let i = 0; i < n; i++) U[i] = u0 + s[i] * (u1 - u0)
    const [lo, hi] = lim([U], n)
    const V = new Float64Array(n)
    for (let i = 0; i < n; i++) V[i] = lo[i] + t[i] * (hi[i] - lo[i])
    const r = ev([U, V], n)
    // com v decrescente (lo > hi) a grade inverte: o normal acompanha
    const inv = u1 < u0
    if (inv) for (let i = 3; i < 6; i++) for (let k = 0; k < n; k++) r[i][k] = -r[i][k]
    for (let k = 0; k < n; k++) {
      if (hi[k] < lo[k]) for (let i = 3; i < 6; i++) r[i][k] = -r[i][k]
    }
    return { P: r.slice(0, 3), N: r.slice(3, 6) }
  }
}

function malhaParam(Sx: Expr[], u: Limite, v: Limite, restr: Expr[], c: Ctx): MalhaSup {
  const am = amostradorParam(Sx, u, v, c.nums)
  const m0 = grade(am, c.q.grade, c.q.grade)
  let m = m0
  for (const g of restricao(restr, c.nums)) m = recorta(m, g)
  return m
}

/** Quebra do cubo em seis tetraedros em torno da diagonal 0–7: vizinhos sempre concordam. */
const TETRAS = [[0, 1, 3, 7], [0, 3, 2, 7], [0, 2, 6, 7], [0, 6, 4, 7], [0, 4, 5, 7], [0, 5, 1, 7]]

export function malhaIsosuperficie(f: Expr, nums: Nums, w: Vista, n: number): MalhaSup {
  const c = compilador(nums)
  const ev = c([f], ['x', 'y', 'z'])
  const grad = c([deriva(f, 'x'), deriva(f, 'y'), deriva(f, 'z')], ['x', 'y', 'z'])
  // células cúbicas de mesmo lado: uma caixa achatada não pode virar agulhas
  const L = [w.x[1] - w.x[0], w.y[1] - w.y[0], w.z[1] - w.z[0]]
  const lado = Math.max(...L) / n
  const [nx, ny, nz] = L.map((l) => Math.max(2, Math.round(l / lado)))
  const hx = L[0] / nx
  const hy = L[1] / ny
  const hz = L[2] / nz
  const nCam = (nx + 1) * (ny + 1)
  const X = new Float64Array(nCam)
  const Y = new Float64Array(nCam)
  for (let j = 0, k = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++, k++) {
      // deslocamento mínimo: evita tocar exatamente em zeros de planos coordenados
      X[k] = w.x[0] + i * hx + 1.37e-7 * L[0]
      Y[k] = w.y[0] + j * hy + 1.11e-7 * L[1]
    }
  }
  const camada = (k: number) => {
    const Z = new Float64Array(nCam).fill(w.z[0] + k * hz + 0.93e-7 * L[2])
    return ev([X, Y, Z], nCam)[0]
  }
  const nSem = (nx + 1) * (ny + 1) * (nz + 1)
  const id = (i: number, j: number, k: number) => k * nCam + j * (nx + 1) + i
  const pos: number[] = []
  const cache = new Map<number, number>()
  const idx: number[] = []
  let baixo = camada(0)
  const canto = new Float64Array(8)
  const ids = [0, 0, 0, 0, 0, 0, 0, 0]
  const coord = (g: number) => {
    const k = Math.floor(g / nCam)
    const r = g - k * nCam
    const j = Math.floor(r / (nx + 1))
    const i = r - j * (nx + 1)
    return [X[i], Y[j * (nx + 1)], w.z[0] + k * hz + 0.93e-7 * L[2]]
  }
  const vertice = (a: number, b: number, va: number, vb: number) => {
    const key = a < b ? a * nSem + b : b * nSem + a
    const c0 = cache.get(key)
    if (c0 !== undefined) return c0
    const t = va / (va - vb)
    const [pa, pb] = [coord(a), coord(b)]
    const i = pos.length / 3
    pos.push(pa[0] + t * (pb[0] - pa[0]), pa[1] + t * (pb[1] - pa[1]), pa[2] + t * (pb[2] - pa[2]))
    cache.set(key, i)
    return i
  }
  for (let k = 0; k < nz; k++) {
    const cima = camada(k + 1)
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const q = j * (nx + 1) + i
        canto[0] = baixo[q]
        canto[1] = baixo[q + 1]
        canto[2] = baixo[q + nx + 1]
        canto[3] = baixo[q + nx + 2]
        canto[4] = cima[q]
        canto[5] = cima[q + 1]
        canto[6] = cima[q + nx + 1]
        canto[7] = cima[q + nx + 2]
        let neg = 0
        let validos = 0
        for (let c1 = 0; c1 < 8; c1++) {
          if (canto[c1] < 0) neg++
          if (Number.isFinite(canto[c1])) validos++
        }
        if (validos < 8 || neg === 0 || neg === 8) continue
        for (let c1 = 0; c1 < 8; c1++) ids[c1] = id(i + (c1 & 1), j + ((c1 >> 1) & 1), k + ((c1 >> 2) & 1))
        for (const t of TETRAS) {
          const fora: number[] = []
          const dentro: number[] = []
          for (const v of t) (canto[v] < 0 ? dentro : fora).push(v)
          if (dentro.length === 0 || fora.length === 0) continue
          const v = (a: number, b: number) => vertice(ids[a], ids[b], canto[a], canto[b])
          if (dentro.length === 1 || fora.length === 1) {
            const [u, o] = dentro.length === 1 ? [dentro[0], fora] : [fora[0], dentro]
            idx.push(v(u, o[0]), v(u, o[1]), v(u, o[2]))
          } else {
            const [p, q2] = dentro
            const [r, s] = fora
            const [a, b, c1, d] = [v(p, r), v(p, s), v(q2, s), v(q2, r)]
            idx.push(a, b, c1, a, c1, d)
          }
        }
      }
    }
    baixo = cima
  }
  const m = pos.length / 3
  if (!m) return vazia()
  const px = new Float64Array(m)
  const py = new Float64Array(m)
  const pz = new Float64Array(m)
  for (let i = 0; i < m; i++) {
    px[i] = pos[3 * i]
    py[i] = pos[3 * i + 1]
    pz[i] = pos[3 * i + 2]
  }
  // Newton leva cada vértice à superfície de verdade: a grade grossa some do desenho
  for (let it = 0; it < 3; it++) {
    const v = ev([px, py, pz], m)[0]
    const [gx, gy, gz] = grad([px, py, pz], m)
    for (let i = 0; i < m; i++) {
      const g2 = gx[i] * gx[i] + gy[i] * gy[i] + gz[i] * gz[i]
      if (!(g2 > 1e-14) || !Number.isFinite(v[i])) continue
      const passo = v[i] / g2
      const dx = passo * gx[i]
      const dy = passo * gy[i]
      const dz = passo * gz[i]
      const d = Math.hypot(dx, dy, dz)
      const esc = d > lado ? lado / d : 1
      px[i] -= esc * dx
      py[i] -= esc * dy
      pz[i] -= esc * dz
    }
  }
  const [gx, gy, gz] = grad([px, py, pz], m)
  const nor = new Float32Array(3 * m)
  const P = new Float32Array(3 * m)
  for (let i = 0; i < m; i++) {
    const g = Math.hypot(gx[i], gy[i], gz[i])
    P[3 * i] = px[i]
    P[3 * i + 1] = py[i]
    P[3 * i + 2] = pz[i]
    if (g > 1e-12 && Number.isFinite(g)) {
      nor[3 * i] = gx[i] / g
      nor[3 * i + 1] = gy[i] / g
      nor[3 * i + 2] = gz[i] / g
    }
  }
  // a ordem dos vértices segue a normal: em DoubleSide, o shader decide pela face
  const I = Uint32Array.from(idx)
  for (let i = 0; i < I.length; i += 3) {
    const [a, b, c1] = [I[i], I[i + 1], I[i + 2]]
    const ux = P[3 * b] - P[3 * a]
    const uy = P[3 * b + 1] - P[3 * a + 1]
    const uz = P[3 * b + 2] - P[3 * a + 2]
    const vx = P[3 * c1] - P[3 * a]
    const vy = P[3 * c1 + 1] - P[3 * a + 1]
    const vz = P[3 * c1 + 2] - P[3 * a + 2]
    const d = (uy * vz - uz * vy) * nor[3 * a] + (uz * vx - ux * vz) * nor[3 * a + 1] + (ux * vy - uy * vx) * nor[3 * a + 2]
    if (d < 0) {
      I[i + 1] = c1
      I[i + 2] = b
    }
  }
  // sem coordenadas de superfície: as linhas de grade seguem x e y
  const uv = new Float32Array(2 * m)
  for (let i = 0; i < m; i++) {
    uv[2 * i] = (px[i] - w.x[0]) / L[0]
    uv[2 * i + 1] = (py[i] - w.y[0]) / L[1]
  }
  return { tipo: 'sup', pos: P, nor, uv, idx: I }
}

const vazia = (): MalhaSup => ({ tipo: 'sup', pos: new Float32Array(0), nor: new Float32Array(0), uv: new Float32Array(0), idx: new Uint32Array(0) })

export function junta(ms: MalhaSup[]): MalhaSup {
  const nv = ms.reduce((s, m) => s + m.pos.length / 3, 0)
  const ni = ms.reduce((s, m) => s + m.idx.length, 0)
  const pos = new Float32Array(3 * nv)
  const nor = new Float32Array(3 * nv)
  const uv = new Float32Array(2 * nv)
  const idx = new Uint32Array(ni)
  let v = 0
  let i = 0
  for (const m of ms) {
    pos.set(m.pos, 3 * v)
    nor.set(m.nor, 3 * v)
    uv.set(m.uv, 2 * v)
    for (let k = 0; k < m.idx.length; k++) idx[i + k] = m.idx[k] + v
    i += m.idx.length
    v += m.pos.length / 3
  }
  return { tipo: 'sup', pos, nor, uv, idx }
}

function malhaImplicita(f: Expr, restr: Expr[], c: Ctx): MalhaSup {
  let m = malhaIsosuperficie(f, c.nums, c.vista, c.q.implicita)
  for (const g of restricao(restr, c.nums)) m = recorta(m, g)
  return m
}

/** Cada fronteira gᵢ = 0 recortada pelas outras, mais as tampas onde a caixa corta o sólido. */
function malhaDesigualdade(gs: Expr[], c: Ctx): MalhaSup {
  const partes: MalhaSup[] = []
  const rs = restricao(gs, c.nums)
  gs.forEach((g, i) => {
    let m = malhaIsosuperficie(g, c.nums, c.vista, c.q.desig)
    rs.forEach((r, j) => {
      if (j !== i) m = recorta(m, r)
    })
    partes.push(m)
  })
  const w = c.vista
  const tampas: Extract<Desenho, { d: 'grafico' }>[] = [
    { d: 'grafico', eixo: 'z', f: deNumero(w.z[0]), restr: [] },
    { d: 'grafico', eixo: 'z', f: deNumero(w.z[1]), restr: [] },
    { d: 'grafico', eixo: 'x', f: deNumero(w.x[0]), restr: [] },
    { d: 'grafico', eixo: 'x', f: deNumero(w.x[1]), restr: [] },
    { d: 'grafico', eixo: 'y', f: deNumero(w.y[0]), restr: [] },
    { d: 'grafico', eixo: 'y', f: deNumero(w.y[1]), restr: [] },
  ]
  for (const t of tampas) {
    let m = malhaGrafico(t, { ...c, q: { ...c.q, grade: c.q.desig } })
    for (const r of rs) m = recorta(m, r)
    if (m.idx.length) partes.push(m)
  }
  return junta(partes)
}

type Face = { S: Expr[]; a: Limite; b: Limite }

function compoe(reg: Regiao, topo: Expr | undefined): { T: Expr[]; lim: Limite[] } {
  if (topo && reg.lim.length === 2) {
    const T = posicao(reg.coords, reg.coords === 'cart' ? 3 : 2)
    const alt = pullback(topo, reg)
    const lim = [...reg.lim, { v: 'z', lo: ZERO, hi: alt }]
    if (reg.coords === 'cart') return { T, lim }
    return { T: [T[0], T[1], Sim('z')], lim }
  }
  return { T: posicao(reg.coords, reg.lim.length), lim: reg.lim }
}

/** As seis faces de uma região iterada (uma, se for plana), sem as degeneradas. */
function facesDe(reg: Regiao, topo: Expr | undefined, nums: Nums): Face[] {
  const { T, lim } = compoe(reg, topo)
  if (lim.length === 2) return [{ S: T, a: lim[0], b: lim[1] }]
  const [u, v, w] = lim
  const fixaEm = (l: Limite, m: Record<string, Expr>): Limite => ({ v: l.v, lo: subst(l.lo, m), hi: subst(l.hi, m) })
  const emFace = (m: Record<string, Expr>) => T.map((e) => subst(e, m))
  const faces: Face[] = [
    { S: emFace({ [w.v]: w.lo }), a: u, b: v },
    { S: emFace({ [w.v]: w.hi }), a: u, b: v },
    { S: emFace({ [v.v]: v.lo }), a: u, b: fixaEm(w, { [v.v]: v.lo }) },
    { S: emFace({ [v.v]: v.hi }), a: u, b: fixaEm(w, { [v.v]: v.hi }) },
    { S: emFace({ [u.v]: u.lo }), a: fixaEm(v, { [u.v]: u.lo }), b: fixaEm(w, { [u.v]: u.lo }) },
    { S: emFace({ [u.v]: u.hi }), a: fixaEm(v, { [u.v]: u.hi }), b: fixaEm(w, { [u.v]: u.hi }) },
  ]
  const volta = reg.coords !== 'cart' ? lim.find((l) => l.v === 'theta') : undefined
  const fechado = volta ? Math.abs(avalia(fixa(sub(volta.hi, volta.lo), nums), nums) - 2 * Math.PI) < 1e-9 : false
  return faces.filter((f) => {
    // com θ de 0 a 2π, as faces θ = 0 e θ = 2π são a mesma parede interna
    if (fechado && volta && !f.S.some((e) => dep(e, 'theta')) && f.a.v !== 'theta' && f.b.v !== 'theta') return false
    return true
  })
}

function malhaSolido(reg: Regiao, topo: Expr | undefined, c: Ctx): MalhaSup {
  const faces = facesDe(reg, topo, c.nums)
  const passo = Math.round(c.q.grade * (faces.length > 1 ? 0.5 : 0.8))
  const partes = faces.map((f) => grade(amostradorParam(f.S, f.a, f.b, c.nums), passo, passo))
  return junta(partes.filter((m) => {
    if (!m.pos.length) return false
    let d = 0
    for (let i = 3; i < Math.min(m.pos.length, 3000); i += 3) d = Math.max(d, Math.abs(m.pos[i] - m.pos[0]) + Math.abs(m.pos[i + 1] - m.pos[1]) + Math.abs(m.pos[i + 2] - m.pos[2]))
    return d > 1e-9
  }))
}

/** Colunas da soma de Riemann: cada célula vira um prisma, em qualquer sistema de coordenadas. */
function malhaRiemann(reg: Regiao, f: Expr, nCel: Expr, c: Ctx): MalhaSup {
  const n = Math.max(1, Math.min(60, Math.round(avalia(fixa(nCel, c.nums), c.nums))))
  const [u, v] = reg.lim
  const T = posicao(reg.coords, 2)
  const alt = pullback(f, reg)
  const ev = compilador(c.nums)([T[0], T[1], alt], [u.v, v.v])
  const lim = compilador(c.nums)([v.lo, v.hi], [u.v])
  const [u0, u1] = intervalo(u, c.nums)
  const total = n * n
  const pts = 5 * total
  const U = new Float64Array(pts)
  const V = new Float64Array(pts)
  const us = new Float64Array(n + 1).map((_, i) => u0 + ((u1 - u0) * i) / n)
  const meios = new Float64Array(n).map((_, i) => u0 + ((u1 - u0) * (i + 0.5)) / n)
  const [lo, hi] = lim([meios], n)
  for (let i = 0, k = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const dv = (hi[i] - lo[i]) / n
      const b0 = lo[i] + j * dv
      const quad: [number, number][] = [[us[i], b0], [us[i + 1], b0], [us[i + 1], b0 + dv], [us[i], b0 + dv], [meios[i], b0 + dv / 2]]
      for (const [a, b] of quad) {
        U[k] = a
        V[k] = b
        k++
      }
    }
  }
  const [X, Y, Z] = ev([U, V], pts)
  const pos: number[] = []
  const nor: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  const face = (p: number[][]) => {
    const [a, b, d] = [p[0], p[1], p[3]]
    const n1 = [(b[1] - a[1]) * (d[2] - a[2]) - (b[2] - a[2]) * (d[1] - a[1]), (b[2] - a[2]) * (d[0] - a[0]) - (b[0] - a[0]) * (d[2] - a[2]), (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0])]
    const m = Math.hypot(...n1) || 1
    const i0 = pos.length / 3
    for (const q of p) {
      pos.push(...q)
      nor.push(n1[0] / m, n1[1] / m, n1[2] / m)
      uv.push(0, 0)
    }
    idx.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3)
  }
  for (let k = 0; k < total; k++) {
    const b = 5 * k
    const h = Z[b + 4]
    if (!Number.isFinite(h)) continue
    const base = [0, 1, 2, 3].map((q) => [X[b + q], Y[b + q]])
    const P0 = base.map(([x, y]) => [x, y, 0])
    const P1 = base.map(([x, y]) => [x, y, h])
    face(P1)
    face([P0[3], P0[2], P0[1], P0[0]])
    for (let q = 0; q < 4; q++) {
      const r = (q + 1) % 4
      face([P0[q], P0[r], P1[r], P1[q]])
    }
  }
  return { tipo: 'sup', pos: Float32Array.from(pos), nor: Float32Array.from(nor), uv: Float32Array.from(uv), idx: Uint32Array.from(idx) }
}

/** Tubo por transporte paralelo, com um cone a 60% do percurso para mostrar a orientação. */
function malhaCurva(r: Expr[], t: Limite, c: Ctx): MalhaSup {
  const [a, b] = intervalo(t, c.nums)
  const n = c.q.tubo
  const raio = diagonal(c.vista) * 0.0034
  const T = new Float64Array(n + 1).map((_, i) => a + ((b - a) * i) / n)
  const [X, Y, Z] = compilador(c.nums)(r, [t.v])([T], n + 1)
  const salto = diagonal(c.vista) * 0.5
  const pos: number[] = []
  const nor: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  const lados = 8
  let e1 = [0, 0, 0]
  const anel = (p: number[], d: number[], R: number, s: number) => {
    const m = pos.length / 3
    const dot = e1[0] * d[0] + e1[1] * d[1] + e1[2] * d[2]
    e1 = [e1[0] - dot * d[0], e1[1] - dot * d[1], e1[2] - dot * d[2]]
    const q = Math.hypot(...e1) || 1
    e1 = e1.map((x) => x / q)
    const e2 = [d[1] * e1[2] - d[2] * e1[1], d[2] * e1[0] - d[0] * e1[2], d[0] * e1[1] - d[1] * e1[0]]
    for (let k = 0; k < lados; k++) {
      const h = (2 * Math.PI * k) / lados
      const [co, si] = [Math.cos(h), Math.sin(h)]
      const nv = [co * e1[0] + si * e2[0], co * e1[1] + si * e2[1], co * e1[2] + si * e2[2]]
      pos.push(p[0] + R * nv[0], p[1] + R * nv[1], p[2] + R * nv[2])
      nor.push(nv[0], nv[1], nv[2])
      uv.push(s, k / lados)
    }
    return m
  }
  const liga = (m0: number, m1: number) => {
    for (let k = 0; k < lados; k++) {
      const l = (k + 1) % lados
      idx.push(m0 + k, m1 + k, m1 + l, m0 + k, m1 + l, m0 + l)
    }
  }
  let ant = -1
  let meio = -1
  let meioDir: number[] = []
  let meioP: number[] = []
  for (let i = 0; i <= n; i++) {
    const p = [X[i], Y[i], Z[i]]
    if (!finito(p[0], p[1], p[2])) {
      ant = -1
      continue
    }
    const j = i < n && finito(X[i + 1], Y[i + 1], Z[i + 1]) ? i + 1 : i
    const h = j === i ? i - 1 : i
    const q = j === i ? h : j
    const fim = j === i ? i : j
    if (q < 0 || !finito(X[h >= 0 ? h : 0], Y[h >= 0 ? h : 0], Z[h >= 0 ? h : 0])) {
      ant = -1
      continue
    }
    const dv = [X[fim] - X[h], Y[fim] - Y[h], Z[fim] - Z[h]]
    const m = Math.hypot(...dv)
    if (m < 1e-14) continue
    if (m > salto) {
      ant = -1
      continue
    }
    const d = dv.map((x) => x / m)
    if (ant < 0) {
      const ref = Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]
      e1 = [d[1] * ref[2] - d[2] * ref[1], d[2] * ref[0] - d[0] * ref[2], d[0] * ref[1] - d[1] * ref[0]]
    }
    const novo = anel(p, d, raio, i / n)
    if (ant >= 0) liga(ant, novo)
    ant = novo
    if (i >= n * 0.6 && meio < 0) {
      meio = i
      meioDir = d
      meioP = p
    }
  }
  if (meio >= 0) {
    const L = raio * 7
    const base = anel(meioP, meioDir, raio * 3.2, 0.6)
    const ponta = anel([meioP[0] + meioDir[0] * L, meioP[1] + meioDir[1] * L, meioP[2] + meioDir[2] * L], meioDir, 1e-5, 0.6)
    liga(base, ponta)
  }
  return { tipo: 'sup', pos: Float32Array.from(pos), nor: Float32Array.from(nor), uv: Float32Array.from(uv), idx: Uint32Array.from(idx) }
}

function grelhaCampo(w: Vista, n: number, dim: 2 | 3) {
  const nz = dim === 2 ? 1 : n
  const total = n * n * nz
  const X = new Float64Array(total)
  const Y = new Float64Array(total)
  const Z = new Float64Array(total)
  let k = 0
  for (let c = 0; c < nz; c++) {
    for (let b = 0; b < n; b++) {
      for (let a = 0; a < n; a++, k++) {
        X[k] = w.x[0] + ((w.x[1] - w.x[0]) * (a + 0.5)) / n
        Y[k] = w.y[0] + ((w.y[1] - w.y[0]) * (b + 0.5)) / n
        Z[k] = dim === 2 ? 0 : w.z[0] + ((w.z[1] - w.z[0]) * (c + 0.5)) / n
      }
    }
  }
  return { X, Y, Z, total }
}

function setasCampo(F: Expr[], dim: 2 | 3, c: Ctx): MalhaSetas {
  const n = Math.max(3, Math.round((c.opc.densidade ?? 1) * (dim === 2 ? 21 : 8)))
  const { X, Y, Z, total } = grelhaCampo(c.vista, n, dim)
  const [U, V, W] = compilador(c.nums)(F, ['x', 'y', 'z'])([X, Y, Z], total)
  const pos = new Float32Array(3 * total)
  const dir = new Float32Array(3 * total)
  const mag = new Float32Array(total)
  let max = 0
  for (let i = 0; i < total; i++) {
    const m = Math.hypot(U[i], V[i], W[i])
    pos[3 * i] = X[i]
    pos[3 * i + 1] = Y[i]
    pos[3 * i + 2] = Z[i]
    if (!Number.isFinite(m) || m < 1e-12) continue
    dir[3 * i] = U[i] / m
    dir[3 * i + 1] = V[i] / m
    dir[3 * i + 2] = W[i] / m
    mag[i] = m
    if (m > max) max = m
  }
  return { tipo: 'setas', pos, dir, mag, max }
}

/** Linhas de corrente por RK2 em comprimento de arco: seguem a direção, seja qual for |F|. */
function linhasDeFluxo(F: Expr[], dim: 2 | 3, c: Ctx): MalhaLinhas {
  const w = c.vista
  const sementes = grelhaCampo(w, dim === 2 ? 11 : 5, dim)
  const ev = compilador(c.nums)(F, ['x', 'y', 'z'])
  const passos = 90
  const ds = diagonal(w) / 110
  const seg: number[] = []
  const val: number[] = []
  let max = 0
  for (const sentido of [1, -1]) {
    const x = sementes.X.slice()
    const y = sementes.Y.slice()
    const z = sementes.Z.slice()
    const n = sementes.total
    const vivo = new Uint8Array(n).fill(1)
    const [mx, my, mz] = [new Float64Array(n), new Float64Array(n), new Float64Array(n)]
    for (let p = 0; p < passos; p++) {
      const [u, v, s] = ev([x, y, z], n)
      for (let i = 0; i < n; i++) {
        const m = Math.hypot(u[i], v[i], s[i])
        if (!(m > 1e-10) || !Number.isFinite(m)) vivo[i] = 0
        const h = (0.5 * ds * sentido) / (m || 1)
        mx[i] = x[i] + h * u[i]
        my[i] = y[i] + h * v[i]
        mz[i] = z[i] + h * s[i]
      }
      const [u2, v2, s2] = ev([mx, my, mz], n)
      for (let i = 0; i < n; i++) {
        if (!vivo[i]) continue
        const m = Math.hypot(u2[i], v2[i], s2[i])
        if (!(m > 1e-10) || !Number.isFinite(m)) {
          vivo[i] = 0
          continue
        }
        const h = (ds * sentido) / m
        const [nx, ny, nz] = [x[i] + h * u2[i], y[i] + h * v2[i], z[i] + h * s2[i]]
        seg.push(x[i], y[i], z[i], nx, ny, nz)
        val.push(m, m)
        if (m > max) max = m
        x[i] = nx
        y[i] = ny
        z[i] = nz
        if (nx < w.x[0] || nx > w.x[1] || ny < w.y[0] || ny > w.y[1] || nz < w.z[0] || nz > w.z[1]) vivo[i] = 0
      }
    }
  }
  return { tipo: 'linhas', seg: Float32Array.from(seg), val: Float32Array.from(val), min: 0, max }
}

/** Curvas de nível por quadrados em marcha, projetadas no piso da caixa. */
function curvasDeNivel(f: Expr, c: Ctx): MalhaLinhas {
  const w = c.vista
  const n = 150
  const total = (n + 1) * (n + 1)
  const X = new Float64Array(total)
  const Y = new Float64Array(total)
  for (let j = 0, k = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++, k++) {
      X[k] = w.x[0] + ((w.x[1] - w.x[0]) * i) / n
      Y[k] = w.y[0] + ((w.y[1] - w.y[0]) * j) / n
    }
  }
  const [V] = compilador(c.nums)([f], ['x', 'y'])([X, Y], total)
  const ord = Array.from(V).filter(Number.isFinite).sort((a, b) => a - b)
  if (!ord.length) return { tipo: 'linhas', seg: new Float32Array(0), val: new Float32Array(0), min: 0, max: 0 }
  const lo = ord[Math.floor(ord.length * 0.02)]
  const hi = ord[Math.floor(ord.length * 0.98)]
  const niveis = 15
  const seg: number[] = []
  const val: number[] = []
  const z = w.z[0]
  for (let l = 1; l < niveis; l++) {
    const c0 = lo + ((hi - lo) * l) / niveis
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const a = j * (n + 1) + i
        const q = [a, a + 1, a + n + 2, a + n + 1]
        const pts: number[][] = []
        for (let e = 0; e < 4; e++) {
          const [p, r] = [q[e], q[(e + 1) % 4]]
          const [vp, vr] = [V[p] - c0, V[r] - c0]
          if (!Number.isFinite(vp + vr) || vp * vr >= 0) continue
          const t = vp / (vp - vr)
          pts.push([X[p] + t * (X[r] - X[p]), Y[p] + t * (Y[r] - Y[p])])
        }
        if (pts.length >= 2) {
          seg.push(pts[0][0], pts[0][1], z, pts[1][0], pts[1][1], z)
          val.push(c0, c0)
        }
        if (pts.length === 4) {
          seg.push(pts[2][0], pts[2][1], z, pts[3][0], pts[3][1], z)
          val.push(c0, c0)
        }
      }
    }
  }
  return { tipo: 'linhas', seg: Float32Array.from(seg), val: Float32Array.from(val), min: lo, max: hi }
}

function ladoCampoEscalar(f: Expr, c: Ctx): [number, number] {
  const { X, Y, Z, total } = grelhaCampo(c.vista, 24, 3)
  const [V] = compilador(c.nums)([f], ['x', 'y', 'z'])([X, Y, Z], total)
  const ord = Array.from(V).filter(Number.isFinite).sort((a, b) => a - b)
  if (!ord.length) return [0, 1]
  return [ord[Math.floor(ord.length * 0.02)], ord[Math.floor(ord.length * 0.98)]]
}

const numV = (v: Expr[], nums: Nums) => v.map((e) => avalia(e, nums)) as [number, number, number]

export function constroi(d: Desenho, c: Ctx): Feito[] {
  switch (d.d) {
    case 'grafico': return [{ ...malhaGrafico(d, c), lin: d.eixo === 'z' ? 'coord' : 'param' }]
    case 'param': return [{ ...malhaParam(d.S, d.u, d.v, d.restr, c), lin: 'param' }]
    case 'implicita': return [{ ...malhaImplicita(d.f, d.restr, c), lin: 'coord' }]
    case 'desigualdade': return [malhaDesigualdade(d.gs, c)]
    case 'curva': return [malhaCurva(d.r, d.t, c)]
    case 'campo': return c.opc.linhasFluxo ? [setasCampo(d.F, d.dim, c), linhasDeFluxo(d.F, d.dim, c)] : [setasCampo(d.F, d.dim, c)]
    case 'solido': return [{ ...malhaSolido(d.reg, d.topo, c), lin: 'param' }]
    case 'riemann': return [malhaRiemann(d.reg, d.f, d.n, c)]
    case 'niveis': return [curvasDeNivel(d.f, c)]
    case 'escalar': {
      const faixa = ladoCampoEscalar(d.f, c)
      const nivel = c.opc.nivel ?? (faixa[0] + faixa[1]) / 2
      const m = malhaIsosuperficie(sub(d.f, deNumero(nivel)), c.nums, c.vista, c.q.implicita)
      return [{ ...m, faixa, lin: 'coord' }]
    }
    case 'ponto': {
      const p = numV(d.p, c.nums)
      return p.every(Number.isFinite) ? [{ tipo: 'marcas', itens: [{ p, rotulo: d.rotulo, forma: 'ponto' }] }] : []
    }
    case 'seta': {
      const [o, v] = [numV(d.o, c.nums), numV(d.v, c.nums)]
      return [...o, ...v].every(Number.isFinite) ? [{ tipo: 'marcas', itens: [{ p: o, v, rotulo: d.rotulo, papel: d.papel, forma: 'seta' }] }] : []
    }
    case 'sonda': {
      const p = numV(d.p, c.nums)
      const G = d.F.length === 2 ? [...d.F, ZERO] : d.F
      const m = { x: p[0], y: p[1], z: p[2], ...c.nums }
      const R = [sub(deriva(G[2], 'y'), deriva(G[1], 'z')), sub(deriva(G[0], 'z'), deriva(G[2], 'x')), sub(deriva(G[1], 'x'), deriva(G[0], 'y'))]
      return [{ tipo: 'marcas', itens: [{ p, v: numV(R, m), forma: 'pa' }] }]
    }
  }
}

/** Assinatura do que muda o desenho: o texto simbólico e só os números que ele usa. */
export function assinatura(d: Desenho, nums: Nums): string {
  const j = JSON.stringify(d, (_k, v) => (typeof v === 'bigint' ? String(v) : v))
  const usados = Object.keys(nums).filter((k) => j.includes(`"s":"${k}"`)).map((k) => `${k}=${nums[k]}`)
  return `${j}|${usados.join(',')}`
}


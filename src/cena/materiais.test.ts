import { expect, it } from 'vitest'
import type { MalhaSup } from '../malha/malhas'
import { GeoDinamica } from './materiais'

const malha = (nV: number, nI: number) => ({ pos: new Float32Array(nV * 3), nor: new Float32Array(nV * 3), uv: new Float32Array(nV * 2), idx: new Uint32Array(nI) }) as unknown as MalhaSup

it('malha vazia na primeira vez não derruba a cena', () => {
  // f(u, v) com tangente(f, a, b) dava um plano sem vértices, e a página inteira ficava em branco
  const g = new GeoDinamica()
  expect(() => g.atualiza(malha(0, 0), 1)).not.toThrow()
  expect(() => g.atualiza(malha(30, 90), 1)).not.toThrow()
  expect(() => g.atualiza(malha(0, 0), 1)).not.toThrow()
  expect(g.geo.drawRange.count).toBe(0)
})

import { measurements } from '@jscad/modeling'
import { describe, expect, it } from 'vitest'
import { h } from '../evaluation/jsx'
import { evaluateDocumentEntry } from '../execution/userModule'
import { experiment, structure } from './v2'

const sourceHash = 'a'.repeat(64)

describe('Structure/Experiment v2 definitions', () => {
  it('rejects external key, shape, and range errors before geometry runs', () => {
    let geometryCalls = 0
    const definition = structure({
      lengthUnit: 'mm',
      varsSchema: { size: { min: [10, 10, 10], max: [20, 20, 20] } },
      geometry: ({ vars }) => {
        geometryCalls += 1
        function Body() {
          return h('box', { size: vars.size })
        }
        return h(Body, { id: 'body' })
      },
    })

    expect(() => evaluateDocumentEntry(definition, 'structure', sourceHash, 1, { unknown: 1 })).toThrow(
      'Unknown Structure var: unknown',
    )
    expect(() => evaluateDocumentEntry(definition, 'structure', sourceHash, 1, { size: [10, 10] })).toThrow(
      'must have shape [3]',
    )
    expect(() => evaluateDocumentEntry(definition, 'structure', sourceHash, 1, { size: [21, 10, 10] })).toThrow(
      'less than or equal to 20',
    )
    expect(geometryCalls).toBe(0)
  })

  it('reuses one definition for deterministic evaluations and different external vars', () => {
    let geometryCalls = 0
    const definition = structure({
      lengthUnit: 'mm',
      varsSchema: {
        size: { min: [10, 10, 10], max: [100, 100, 100] },
        offset: { min: -10, max: 10 },
      },
      geometry: ({ vars }) => {
        geometryCalls += 1
        function Body() {
          return h('box', { pos: [vars.offset, 0, 0], size: vars.size })
        }
        return h(Body, { id: 'body' })
      },
    })
    const first = evaluateDocumentEntry(definition, 'structure', sourceHash, 100, {
      size: [20, 20, 20],
      offset: 2,
    })
    const repeated = evaluateDocumentEntry(definition, 'structure', sourceHash, 100, {
      size: [20, 20, 20],
      offset: 2,
    })
    const changed = evaluateDocumentEntry(definition, 'structure', sourceHash, 100, {
      size: [80, 30, 10],
      offset: -4,
    })

    expect(repeated).toEqual(first)
    expect(changed.variables).toEqual({ size: [80, 30, 10], offset: -4 })
    expect(measurements.measureBoundingBox(first.scene.parts[0].geometry)).not.toEqual(
      measurements.measureBoundingBox(changed.scene.parts[0].geometry),
    )
    expect(geometryCalls).toBe(3)
  })

  it('evaluates every Experiment callback exactly once for one snapshot', () => {
    const calls = {
      boundaryConditions: 0,
      geometry: 0,
      initializations: 0,
      parameters: 0,
      recordedData: 0,
    }
    const definition = experiment({
      lengthUnit: 'mm',
      varsSchema: { voltage: { min: 0, max: 10 } },
      solver: {
        name: 'test',
        version: '1',
        parameters: ({ vars }) => {
          calls.parameters += 1
          return { voltage: vars.voltage }
        },
      },
      geometry: () => {
        calls.geometry += 1
        function Probe() {
          return h('box', { size: [1, 1, 1] })
        }
        return h(Probe, { id: 'probe' })
      },
      initializations: () => {
        calls.initializations += 1
        return []
      },
      boundaryConditions: () => {
        calls.boundaryConditions += 1
        return []
      },
      recordedData: () => {
        calls.recordedData += 1
        return []
      },
    })

    const snapshot = evaluateDocumentEntry(definition, 'experiment', sourceHash, 9, { voltage: 4 })

    expect(snapshot.variables).toEqual({ voltage: 4 })
    expect(calls).toEqual({
      boundaryConditions: 1,
      geometry: 1,
      initializations: 1,
      parameters: 1,
      recordedData: 1,
    })
  })
})

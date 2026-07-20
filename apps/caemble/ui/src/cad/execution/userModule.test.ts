import { describe, expect, it, vi } from 'vitest'
import { transform } from 'esbuild'
import { booleans, geometries, measurements } from '@jscad/modeling'
import { defaultCode } from '../../defaultCode'
import { defaultExperimentCode } from '../../defaultExperimentCode'
import { caembleExamples } from '../../examples'
import { SolverController } from '../../solver'
import { dcCurrentDensitySolver } from '../../solver/modules/dcCurrentDensity'
import { executeCompiledCode, executeCompiledProject, requireCaembleModule } from './userModule'
import { identityCartesianBasis } from '../../quantitykind/identityBasis'
import { CAD_COMPILER_VERSION } from '../compiler/types'
import {
  assertEvaluatedDocumentSnapshotV2,
  serializeEvaluatedDocumentSnapshotV2,
} from './snapshot'

const validModule = `
const { Material, structure } = require('@caemble/core/v2')

function Root({ width }) {
  return h('box', { size: [width, 2, 2] })
}

const active = structure({
  lengthUnit: 'mm',
  geometry: ({ vars }) => h(Root, {
    id: 'root',
    width: vars.width,
    materials: [new Material('Core', { epsilon: vars.epsilon, color: '#2563eb' })],
  }),
  varsSchema: {
    width: { min: 4, max: 4 },
    epsilon: { min: 12, max: 12 },
  },
  geometryGroup: { body: ['root', 'missing'] },
  surfaceGroup: { face: ['root/surface-1'] },
})

module.exports.default = active
`

describe('compiled user module execution', () => {
  it('resolves @caemble/core/v2 and evaluates a structure definition', () => {
    expect(requireCaembleModule('@caemble/core/v2')).toHaveProperty('structure')
    expect(requireCaembleModule('@caemble/core/v2')).toHaveProperty('experiment')
    expect(requireCaembleModule('@caemble/core/v2')).toHaveProperty('Mat')
    expect(requireCaembleModule('@caemble/core/v2')).not.toHaveProperty('Sample')
    expect(requireCaembleModule('@caemble/core/v2')).not.toHaveProperty('IDENTITY_CARTESIAN_BASIS')
    const execution = executeCompiledCode(validModule)

    expect(execution).toMatchObject({
      variables: { width: 4, epsilon: 12 },
      scene: {
        lengthUnit: 'mm',
        parts: [{
          id: 'root',
          material: { symbol: 'Core', variables: { epsilon: 12, color: '#2563eb' } },
        }],
        tree: { label: 'Structure' },
        geometryGroups: [{ name: 'body', geometryIds: ['root'], missingMemberIds: ['missing'] }],
        surfaceGroups: [{ name: 'face', surfaceIds: ['root/surface-1'] }],
      },
    })
    expect(execution).not.toHaveProperty('experimentRules')
  })

  it('evaluates an experiment definition and validates rules under callback vars', async () => {
    expect(defaultExperimentCode).toContain("name: 'dc-current-density'")
    expect(defaultExperimentCode).not.toContain('lengthScaleToMeters')
    expect(defaultExperimentCode).not.toContain('conductivityVariable')
    expect(defaultExperimentCode).toContain('initializations: () => [')
    expect(defaultExperimentCode).not.toContain('initialConditions')
    expect(defaultExperimentCode).toContain('boundaryConditions: ({ vars }) => [')
    expect(defaultExperimentCode).toContain('recordedData: () => [')
    expect(defaultExperimentCode).toContain("methodId: 'dc.current-density'")
    expect(defaultExperimentCode).toContain(
      "{ name: 'cross-section v', unit: 'm', quantityKind: 'Length' }",
    )
    expect(defaultExperimentCode).toContain(
      "{ name: 'cross-section u', unit: 'm', quantityKind: 'Length' }",
    )
    expect(defaultExperimentCode).toContain("quantityKind: 'electromagnetism.ElectricCurrent'")
    expect(defaultExperimentCode).not.toContain('IDENTITY_CARTESIAN_BASIS')
    expect(defaultExperimentCode).toContain("'structure.surface.sourceTerminal'")
    expect(defaultExperimentCode).toContain('export default experiment({')

    const compiled = await transform(defaultExperimentCode, {
      format: 'cjs',
      jsxFactory: 'h',
      jsxFragment: 'Fragment',
      loader: 'tsx',
      platform: 'browser',
      target: 'es2020',
    })
    expect(() => executeCompiledCode(compiled.code)).toThrow(
      'Structure Source must export default structure({...})',
    )
    const execution = executeCompiledCode(compiled.code, 'experiment', 'b'.repeat(64))
    const snapshot = serializeEvaluatedDocumentSnapshotV2(execution)
    expect(() => assertEvaluatedDocumentSnapshotV2(snapshot)).not.toThrow()
    const { experimentRules, scene, solver, variables } = execution

    expect(solver).toEqual({
      name: 'dc-current-density',
      version: '2.0.0',
      parameters: {
        relativeTolerance: {
          dtype: 'float64', value: 1e-8, unit: '{fraction}', quantityKind: 'DimensionlessRatio',
        },
        maxIterations: 2000,
      },
    })
    expect(experimentRules).toBeDefined()
    expect(variables).toMatchObject({
      electrodeOffset: 50.5,
      electrodeSize: [1, 14, 12],
      sourceVoltage: 1,
      referenceVoltage: 0,
    })
    expect(experimentRules?.initializations).toEqual([{
      target: ['structure.geometry.conductor'],
      label: 'Voxel grid',
      methodId: 'dc.voxel-grid',
      parameters: {
        gridShape: {
          dtype: 'int32',
          axes: [{ length: 3, name: 'axis 0', ticks: [0, 1, 2] }],
          value: [100, 41, 41],
        },
      },
    }])
    expect(experimentRules?.boundaryConditions.map((rule) => rule.methodId)).toEqual([
      'dc.source-potential',
      'dc.reference-potential',
    ])
    expect(experimentRules?.boundaryConditions.map((rule) => rule.parameters.voltage)).toEqual([
      { dtype: 'float64', value: 1, unit: 'mV', quantityKind: 'electromagnetism.Voltage' },
      { dtype: 'float64', value: 0, unit: 'mV', quantityKind: 'electromagnetism.Voltage' },
    ])
    expect(experimentRules?.recordedData[0].result).toEqual({
      dtype: 'float64',
      unit: 'A.m-2',
      quantityKind: 'electromagnetism.ElectricCurrentDensity',
      basis: identityCartesianBasis,
      axes: [
        { name: 'cross-section v', unit: 'm', quantityKind: 'Length' },
        { name: 'cross-section u', unit: 'm', quantityKind: 'Length' },
      ],
    })
    expect(experimentRules?.recordedData.map((rule) => rule.label)).toEqual([
      'Current density',
      'Total current',
    ])
    expect(experimentRules?.recordedData.map((rule) => rule.parameters)).toEqual([
      {
        crossSectionPosition: {
          dtype: 'float64', value: 0.35, unit: '{fraction}', quantityKind: 'DimensionlessRatio',
        },
      },
      {
        crossSectionPosition: {
          dtype: 'float64', value: 0.35, unit: '{fraction}', quantityKind: 'DimensionlessRatio',
        },
      },
    ])
    expect(experimentRules?.recordedData[1].result).toEqual({
      dtype: 'float64',
      unit: 'A',
      quantityKind: 'electromagnetism.ElectricCurrent',
    })
    expect(scene.tree).toMatchObject({ key: 'experiment', label: 'Experiment' })
    expect(scene.parts).toHaveLength(2)
    expect(scene.parts.map((part) => part.id)).toEqual(['source-electrode', 'reference-electrode'])
    expect(scene.geometryGroups[0]).toMatchObject({
      name: 'terminals',
      geometryIds: ['source-electrode', 'reference-electrode'],
    })
    expect(scene.surfaceGroups).toEqual([])
  })

  it('compiles and evaluates the editor default TSX through the Worker module format', async () => {
    expect(defaultCode).toContain("new Material('Copper', 'reference'")
    expect(defaultCode).toContain("unit: 'S.m-1'")
    expect(defaultCode).toContain("quantityKind: 'electromagnetism.ElectricConductivity'")
    expect(defaultCode).toContain('value: Mat(vars.electricalConductivity)')
    expect(defaultCode).not.toContain('IDENTITY_CARTESIAN_BASIS')
    expect(defaultCode).toContain('errorRate: 0.001')
    expect(defaultCode).toContain('conductorSize: { min: [100, 12, 10], max: [100, 12, 10] }')
    expect(defaultCode).toContain('notchSize: { min: [20, 4, 5], max: [40, 6, 7] }')
    expect(defaultCode).toContain('notchPosition: { min: [-10, 4, 2.5], max: [10, 5, 3.5] }')
    expect(defaultCode).toContain("geometryGroup: {\n    conductor: ['conductor']")
    expect(defaultCode).toContain("sourceTerminal: ['conductor/surface-1']")

    const compiled = await transform(defaultCode, {
      format: 'cjs',
      jsxFactory: 'h',
      jsxFragment: 'Fragment',
      loader: 'tsx',
      platform: 'browser',
      target: 'es2020',
    })
    const { geometryGroups, parts, surfaceGroups } = executeCompiledCode(compiled.code).scene
    expect(parts).toHaveLength(1)
    expect(parts[0]).toMatchObject({
      id: 'conductor',
      material: {
        symbol: 'Copper',
        version: 'reference',
        variables: {
          electricalConductivity: {
            dtype: 'float64',
            value: expect.any(Array),
            unit: 'S.m-1',
            quantityKind: 'electromagnetism.ElectricConductivity',
            basis: identityCartesianBasis,
          },
          color: '#d97706',
        },
      },
    })
    const conductivity = parts[0].material?.variables.electricalConductivity as unknown as {
      value: readonly (readonly number[])[]
    }
    const diagonal = [conductivity.value[0][0], conductivity.value[1][1], conductivity.value[2][2]]
    expect(diagonal[0]).toBeGreaterThanOrEqual(5.96e7 * (1 - 0.001))
    expect(diagonal[0]).toBeLessThanOrEqual(5.96e7 * (1 + 0.001))
    expect(diagonal).toEqual([diagonal[0], diagonal[0], diagonal[0]])
    expect(conductivity.value.flat().filter((_value, index) => ![0, 4, 8].includes(index))).toEqual([0, 0, 0, 0, 0, 0])
    expect(conductivity).not.toHaveProperty('errorRate')
    expect(geometryGroups[0]).toMatchObject({ name: 'conductor', geometryIds: ['conductor'] })
    expect(surfaceGroups.map((group) => group.name)).toEqual(['sourceTerminal', 'referenceTerminal'])
    if (!geometries.geom3.isA(parts[0].geometry)) throw new Error('Expected the default conductor to be a geom3 solid.')
    const polygons = geometries.geom3.toPolygons(parts[0].geometry)
    const sourceSurface = parts[0].surfaces.find(({ id }) => id === 'conductor/surface-1')!
    const referenceSurface = parts[0].surfaces.find(({ id }) => id === 'conductor/surface-2')!
    const sourceX = sourceSurface.polygonIndices.flatMap((index) => polygons[index].vertices.map((vertex) => vertex[0]))
    const referenceX = referenceSurface.polygonIndices.flatMap((index) => polygons[index].vertices.map((vertex) => vertex[0]))
    expect(sourceX.every((x) => Math.abs(x + 50) < 1e-3)).toBe(true)
    expect(referenceX.every((x) => Math.abs(x - 50) < 1e-3)).toBe(true)
    expect(geometries.poly3.plane(polygons[sourceSurface.polygonIndices[0]])[0]).toBeCloseTo(-1, 8)
    expect(geometries.poly3.plane(polygons[referenceSurface.polygonIndices[0]])[0]).toBeCloseTo(1, 8)
    parts.forEach((part) => {
      expect(() => geometries.geom3.validate(part.geometry)).not.toThrow()
      expect(measurements.measureVolume(part.geometry)).toBeGreaterThan(0)
    })
  })

  it('accepts external vars without rewriting or recompiling the default source', async () => {
    const compiled = await transform(defaultCode, {
      format: 'cjs',
      jsxFactory: 'h',
      jsxFragment: 'Fragment',
      loader: 'tsx',
      platform: 'browser',
      target: 'es2020',
    })
    for (const value of [0, 1]) {
      const expectedNotchSize = value === 0 ? [20, 4, 5] : [40, 6, 7]
      const expectedNotchPosition = value === 0 ? [-10, 4, 2.5] : [10, 5, 3.5]
      const { scene, variables } = executeCompiledCode(
        compiled.code,
        'structure',
        'default-source-hash',
        101,
        {
          conductorSize: [100, 12, 10],
          electricalConductivity: 5.96e7,
          notchPosition: expectedNotchPosition,
          notchSize: expectedNotchSize,
        },
      )
      const part = scene.parts[0]

      expect(variables.notchSize).toEqual(expectedNotchSize)
      expect(variables.notchPosition).toEqual(expectedNotchPosition)
      expect(scene.surfaceGroups.map((group) => group.name)).toEqual(['sourceTerminal', 'referenceTerminal'])
      expect(() => geometries.geom3.validate(part.geometry)).not.toThrow()
      expect(measurements.measureVolume(part.geometry)).toBeGreaterThan(0)
    }
  })

  it('keeps example IDs unique and validates every registered example snapshot', async () => {
    expect(new Set(caembleExamples.map(({ id }) => id)).size).toBe(caembleExamples.length)
    expect(caembleExamples[0].code).toBe(defaultCode)
    expect(caembleExamples.filter(({ mode }) => mode === 'simulation').map(({ id }) => id)).toEqual([
      'dc-conductor',
    ])

    const experimentCompiled = await transform(defaultExperimentCode, {
      format: 'cjs',
      jsxFactory: 'h',
      jsxFragment: 'Fragment',
      loader: 'tsx',
      platform: 'browser',
      target: 'es2020',
    })
    const experimentExecution = executeCompiledCode(
      experimentCompiled.code,
      'experiment',
      'b'.repeat(64),
      11,
    )
    if (!experimentExecution.experimentRules || !experimentExecution.solver) {
      throw new Error('Expected the default Experiment to produce rules and Solver metadata.')
    }
    const experimentSnapshot = serializeEvaluatedDocumentSnapshotV2(experimentExecution)
    expect(() => assertEvaluatedDocumentSnapshotV2(experimentSnapshot)).not.toThrow()
    const solverController = new SolverController([dcCurrentDensitySolver])

    for (const example of caembleExamples) {
      const compiled = await transform(example.code, {
        format: 'cjs',
        jsxFactory: 'h',
        jsxFragment: 'Fragment',
        loader: 'tsx',
        platform: 'browser',
        target: 'es2020',
      })
      const execution = executeCompiledCode(compiled.code, 'structure', 'a'.repeat(64), 7)
      const snapshot = serializeEvaluatedDocumentSnapshotV2(execution)

      expect(snapshot.scene.parts.length).toBeGreaterThan(0)
      expect(() => assertEvaluatedDocumentSnapshotV2(snapshot), example.title).not.toThrow()

      const preflight = solverController.preflight({
        structure: { scene: execution.scene },
        experiment: {
          scene: experimentExecution.scene,
          rules: experimentExecution.experimentRules,
          solver: experimentExecution.solver,
        },
      })
      expect(preflight.complete, example.title).toBe(true)
      if (example.mode === 'simulation') {
        expect(preflight.issues, example.title).toEqual([])
      } else {
        expect(preflight.issues.length, example.title).toBeGreaterThan(0)
        expect(preflight.issues.some((issue) => issue.message.includes('missing structure.')), example.title).toBe(true)
      }
    }
  })

  it('creates non-overlapping signed shell cutaways in core-to-outer order', async () => {
    const example = caembleExamples.find(({ id }) => id === 'shell-cutaways')
    expect(example).toBeDefined()
    expect(example!.code).toContain('offsets={[-0.5, 0.5, 1]}')

    const compiled = await transform(example!.code, {
      format: 'cjs',
      jsxFactory: 'h',
      jsxFragment: 'Fragment',
      loader: 'tsx',
      platform: 'browser',
      target: 'es2020',
    })
    const { parts } = executeCompiledCode(compiled.code).scene

    expect(parts.map((part) => part.material?.symbol)).toEqual([
      'Core', 'Layer 1',
      'Core', 'Layer 1', 'Layer 2',
      'Core', 'Layer 1', 'Layer 2', 'Layer 3',
    ])
    expect(parts.map((part) => part.id)).toEqual([
      'cylinder.$part-1', 'cylinder.$part-2',
      'sphere.$part-1', 'sphere.$part-2', 'sphere.$part-3',
      'fiber.$part-1', 'fiber.$part-2', 'fiber.$part-3', 'fiber.$part-4',
    ])
    parts.forEach((part, index) => {
      expect(() => geometries.geom3.validate(part.geometry), `part ${index}`).not.toThrow()
      expect(measurements.measureVolume(part.geometry)).toBeGreaterThan(0)
      expect(measurements.measureBoundingBox(part.geometry)[0][1]).toBeGreaterThanOrEqual(-1e-5)
    })

    const cadIntersect = booleans.intersect as unknown as (...geometries: unknown[]) => unknown
    const fiberOverlap = cadIntersect(parts[5].geometry, parts[6].geometry)
    expect(Math.max(0, measurements.measureVolume(fiberOverlap))).toBeCloseTo(0, 6)

    const cadUnion = booleans.union as unknown as (...geometries: unknown[]) => unknown
    const fiberCoreAndLayer = cadUnion(parts[5].geometry, parts[6].geometry)
    const overlapByVolume = measurements.measureVolume(parts[5].geometry)
      + measurements.measureVolume(parts[6].geometry)
      - measurements.measureVolume(fiberCoreAndLayer)
    expect(Math.max(0, overlapByVolume)).toBeCloseTo(0, 6)
  })

  it('creates independently randomized cells in the curved cylinder array example', async () => {
    const example = caembleExamples.find(({ id }) => id === 'random-curved-edge-cylinder-array')
    expect(example).toBeDefined()

    let randomIndex = 0
    const random = vi.spyOn(Math, 'random').mockImplementation(() => ((randomIndex++ * 37) % 101) / 101)

    try {
      const compiled = await transform(example!.code, {
        format: 'cjs',
        jsxFactory: 'h',
        jsxFragment: 'Fragment',
        loader: 'tsx',
        platform: 'browser',
        target: 'es2020',
      })
      const { parts } = executeCompiledCode(compiled.code).scene
      const volumes = parts.map((part) => measurements.measureVolume(part.geometry))

      expect(parts).toHaveLength(16)
      expect(parts[0].id).toBe('$cell-0-0-0.cell')
      expect(parts[15].id).toBe('$cell-3-3-0.cell')
      parts.forEach((part) => {
        expect(() => geometries.geom3.validate(part.geometry)).not.toThrow()
      })
      expect(volumes.every((volume) => volume > 0)).toBe(true)
      expect(new Set(volumes.map((volume) => volume.toFixed(6))).size).toBeGreaterThan(1)
    } finally {
      random.mockRestore()
    }
  })

  it('creates independently randomized curved spheres on an HCP lattice', async () => {
    const example = caembleExamples.find(({ id }) => id === 'random-curved-surface-sphere-hcp-array')
    expect(example).toBeDefined()

    let randomIndex = 0
    const random = vi.spyOn(Math, 'random').mockImplementation(() => ((randomIndex++ * 43) % 103) / 103)

    try {
      const compiled = await transform(example!.code, {
        format: 'cjs',
        jsxFactory: 'h',
        jsxFragment: 'Fragment',
        loader: 'tsx',
        platform: 'browser',
        target: 'es2020',
      })
      const { parts } = executeCompiledCode(compiled.code).scene
      const volumes = parts.map((part) => measurements.measureVolume(part.geometry))

      expect(parts).toHaveLength(48)
      expect(parts[0].id).toBe('$cell-0-0-0.particle')
      expect(parts[47].id).toBe('$cell-3-3-2.particle')
      parts.forEach((part) => {
        expect(() => geometries.geom3.validate(part.geometry)).not.toThrow()
      })
      expect(volumes.every((volume) => volume > 0)).toBe(true)
      expect(new Set(volumes.map((volume) => volume.toFixed(6))).size).toBeGreaterThan(1)
    } finally {
      random.mockRestore()
    }
  })

  it('rejects direct module loads outside @caemble/core/v2', () => {
    expect(() => requireCaembleModule('./Core')).toThrow('Only @caemble/core/v2 can be imported')
    expect(() => executeCompiledCode(`require('other-package')`)).toThrow('Only @caemble/core/v2 can be imported')
  })

  it('loads relative modules inside one validated compiled virtual project', () => {
    const execution = executeCompiledProject({
      apiVersion: 2,
      compilerVersion: CAD_COMPILER_VERSION,
      entryFile: 'structure.tsx',
      modules: {
        'helpers/size.ts': { code: 'exports.size = [3, 4, 5]' },
        'structure.tsx': { code: `
const { structure } = require('@caemble/core/v2')
const { size } = require('./helpers/size')
function Body() { return h('box', { size }) }
module.exports.default = structure({
  lengthUnit: 'mm',
  varsSchema: {},
  geometry: () => h(Body, { id: 'body' }),
})
` },
      },
      sourceHash: 'e'.repeat(64),
    }, 'structure', 4)

    expect(execution.scene.parts).toHaveLength(1)
    expect(measurements.measureBoundingBox(execution.scene.parts[0].geometry)).toEqual([
      [-1.5, -2, -2.5],
      [1.5, 2, 2.5],
    ])
  })

  it('requires a matching lowercase factory default export', () => {
    expect(() => executeCompiledCode('module.exports.default = () => null')).toThrow(
      'Structure Source must export default structure({...})',
    )
    expect(() => executeCompiledCode(validModule, 'experiment')).toThrow(
      'Experiment Source must export default experiment({...})',
    )
  })
})

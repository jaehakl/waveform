import { describe, expect, it, vi } from 'vitest'
import { transform } from 'esbuild'
import { booleans, geometries, measurements } from '@jscad/modeling'
import { defaultCode } from '../../defaultCode'
import { defaultExperimentCode } from '../../defaultExperimentCode'
import { caembleExamples } from '../../examples'
import { executeCompiledCode, requireCaembleModule } from './userModule'

const validModule = `
const { Material, Sample, Structure } = require('@caemble/core')

function Root({ materials }) {
  return h('box', { size: [vars.width, 2, 2] })
}

const structure = new Structure({
  lengthUnit: 'mm',
  geometry: () => h(Root, {
    id: 'root',
    materials: [new Material('Core', { epsilon: vars.epsilon, color: '#2563eb' })],
  }),
  varsSchema: {
    width: { shape: [], default: 4 },
    epsilon: { shape: [], default: 12 },
  },
  geometryGroup: { body: ['root', 'missing'] },
  surfaceGroup: { face: ['root/surface-1'] },
})

module.exports.default = new Sample(structure)
`

describe('compiled user module execution', () => {
  it('resolves @caemble/core and evaluates a default Sample', () => {
    expect(requireCaembleModule('@caemble/core')).toHaveProperty('Sample')
    expect(requireCaembleModule('@caemble/core')).toHaveProperty('Setup')
    expect(requireCaembleModule('@caemble/core')).toHaveProperty('Experiment')
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

  it('evaluates a default Setup and validates Experiment rules under Setup vars', async () => {
    expect(defaultExperimentCode).toContain("name: 'dc-current-density'")
    expect(defaultExperimentCode).not.toContain('lengthScaleToMeters')
    expect(defaultExperimentCode).toContain("conductivityVariable: 'electricalConductivity'")
    expect(defaultExperimentCode).toContain('initializations: () => [')
    expect(defaultExperimentCode).not.toContain('initialConditions')
    expect(defaultExperimentCode).toContain('boundaryConditions: () => [')
    expect(defaultExperimentCode).toContain('recordedData: () => [')
    expect(defaultExperimentCode).toContain("methodId: 'dc.current-density'")
    expect(defaultExperimentCode).toContain("{ name: 'cross-section v', unit: 'm' }")
    expect(defaultExperimentCode).toContain("{ name: 'cross-section u', unit: 'm' }")
    expect(defaultExperimentCode).toContain("dtype: 'float64', unit: 'A' }")
    expect(defaultExperimentCode).toContain("'structure.surface.sourceTerminal'")
    expect(defaultExperimentCode).toContain('export default new Setup(experiment)')

    const compiled = await transform(defaultExperimentCode, {
      format: 'cjs',
      jsxFactory: 'h',
      jsxFragment: 'Fragment',
      loader: 'tsx',
      platform: 'browser',
      target: 'es2020',
    })
    expect(() => executeCompiledCode(compiled.code)).toThrow(
      'default export must be a Sample instance',
    )
    const execution = executeCompiledCode(compiled.code, 'experiment')
    const { experimentRules, scene, solver, variables } = execution

    expect(solver).toEqual({
      name: 'dc-current-density',
      version: '1.0.0',
      parameters: {
        conductivityVariable: 'electricalConductivity',
        relativeTolerance: { type: 'float', value: 1e-8 },
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
          type: 'tensor',
          dimension: 1,
          shape: [3],
          dtype: 'int32',
          axes: [{ name: 'grid axis', ticks: ['s', 'u', 'v'] }],
          value: [100, 41, 41],
        },
      },
    }])
    expect(experimentRules?.boundaryConditions.map((rule) => rule.methodId)).toEqual([
      'dc.source-potential',
      'dc.reference-potential',
    ])
    expect(experimentRules?.boundaryConditions.map((rule) => rule.parameters.voltage)).toEqual([
      { type: 'float', value: 1, unit: 'mV' },
      { type: 'float', value: 0, unit: 'mV' },
    ])
    expect(experimentRules?.recordedData[0].result).toEqual({
      type: 'tensor',
      dimension: 2,
      shape: [-1, -1],
      dtype: 'float64',
      unit: 'A/m2',
      axes: [
        { name: 'cross-section v', unit: 'm' },
        { name: 'cross-section u', unit: 'm' },
      ],
    })
    expect(experimentRules?.recordedData.map((rule) => rule.label)).toEqual([
      'Current density',
      'Total current',
    ])
    expect(experimentRules?.recordedData.map((rule) => rule.parameters)).toEqual([
      { crossSectionPosition: { type: 'float', value: 0.35 } },
      { crossSectionPosition: { type: 'float', value: 0.35 } },
    ])
    expect(experimentRules?.recordedData[1].result).toEqual({
      type: 'tensor',
      dimension: 0,
      shape: [],
      dtype: 'float64',
      unit: 'A',
      axes: [],
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
    expect(defaultCode).toContain("unit: 'S/m'")
    expect(defaultCode).toContain('conductorSize: { shape: [3], default: [100, 12, 10] }')
    expect(defaultCode).toContain('notchSize: { shape: [3], default: [30, 5, 5] }')
    expect(defaultCode).toContain('notchPosition: { shape: [3], default: [0, 4.5, 2.5] }')
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
          electricalConductivity: { type: 'float', value: 5.96e7, unit: 'S/m' },
          color: '#d97706',
        },
      },
    })
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

  it('keeps example IDs unique and compiles every registered example', async () => {
    expect(new Set(caembleExamples.map(({ id }) => id)).size).toBe(caembleExamples.length)
    expect(caembleExamples[0].code).toBe(defaultCode)

    for (const example of caembleExamples) {
      const compiled = await transform(example.code, {
        format: 'cjs',
        jsxFactory: 'h',
        jsxFragment: 'Fragment',
        loader: 'tsx',
        platform: 'browser',
        target: 'es2020',
      })
      expect(executeCompiledCode(compiled.code).scene.parts.length).toBeGreaterThan(0)
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

  it('rejects relative and external modules', () => {
    expect(() => requireCaembleModule('./Core')).toThrow('Only @caemble/core can be imported')
    expect(() => executeCompiledCode(`require('other-package')`)).toThrow('Only @caemble/core can be imported')
  })

  it('requires the default export to be a Sample object', () => {
    expect(() => executeCompiledCode('module.exports.default = () => null')).toThrow(
      'default export must be a Sample instance',
    )
    expect(() => executeCompiledCode(validModule, 'experiment')).toThrow(
      'default export must be a Setup instance',
    )
  })
})

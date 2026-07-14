import { describe, expect, it, vi } from 'vitest'
import { transform } from 'esbuild'
import { booleans, geometries, measurements } from '@jscad/modeling'
import { defaultCode } from '../../defaultCode'
import { caembleExamples } from '../../examples'
import { executeCompiledCode, requireCaembleModule } from './userModule'

const validModule = `
const { Material, Sample, Structure } = require('@caemble/core')

function Root({ materials }) {
  return h('box', { size: [vars.width, 2, 2] })
}

const structure = new Structure({
  geometry: () => h(Root, {
    materials: [new Material('Core', { epsilon: vars.epsilon }, '#2563eb')],
  }),
  varsSchema: {
    width: { shape: [], default: 4 },
    epsilon: { shape: [], default: 12 },
  },
})

module.exports.default = new Sample(structure)
`

describe('compiled user module execution', () => {
  it('resolves @caemble/core and evaluates a default Sample', () => {
    expect(requireCaembleModule('@caemble/core')).toHaveProperty('Sample')
    expect(executeCompiledCode(validModule)).toMatchObject([
      { materialName: 'Core', displayColor: '#2563eb' },
    ])
  })

  it('compiles and evaluates the editor default TSX through the Worker module format', async () => {
    expect(defaultCode).toContain('<fiber')
    expect(defaultCode).toContain('basePath={basePath}')
    expect(defaultCode).toContain('radius={(s) =>')
    expect(defaultCode).toContain('radius: (_u, theta) =>')
    expect(defaultCode).toContain('fourier={fourier}')
    expect(defaultCode).toContain('fourierModes')
    expect(defaultCode).toContain('const randomVars = structure.randomVars()')

    const compiled = await transform(defaultCode, {
      format: 'cjs',
      jsxFactory: 'h',
      jsxFragment: 'Fragment',
      loader: 'tsx',
      platform: 'browser',
      target: 'es2020',
    })
    const parts = executeCompiledCode(compiled.code)

    expect(parts).toHaveLength(3)
    expect(parts.every((part) => part.materialName === 'Tapered Fiber')).toBe(true)
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
      expect(executeCompiledCode(compiled.code).length).toBeGreaterThan(0)
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
    const parts = executeCompiledCode(compiled.code)

    expect(parts.map((part) => part.materialName)).toEqual([
      'Core', 'Layer 1',
      'Core', 'Layer 1', 'Layer 2',
      'Core', 'Layer 1', 'Layer 2', 'Layer 3',
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
      const parts = executeCompiledCode(compiled.code)
      const volumes = parts.map((part) => measurements.measureVolume(part.geometry))

      expect(parts).toHaveLength(16)
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
      const parts = executeCompiledCode(compiled.code)
      const volumes = parts.map((part) => measurements.measureVolume(part.geometry))

      expect(parts).toHaveLength(48)
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
  })
})

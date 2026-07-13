import { describe, expect, it } from 'vitest'
import { transform } from 'esbuild'
import { geometries, measurements } from '@jscad/modeling'
import { defaultCode } from '../../defaultCode'
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



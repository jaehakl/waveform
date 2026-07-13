import { describe, expect, it } from 'vitest'
import { transform } from 'esbuild'
import { measurements } from '@jscad/modeling'
import { defaultCode } from '../defaultCode'
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
    ;['union', 'subtract', 'intersect'].forEach((tag) => {
      expect(defaultCode).toContain(`<${tag}`)
    })
    expect(defaultCode).toContain('rotate={{')
    expect(defaultCode).toContain('scale={[')
    expect(defaultCode).toContain('<array')
    expect(defaultCode).toContain('shape={[3, 3, 3]}')
    expect(defaultCode).toContain('period={[')
    expect(defaultCode).toContain('y: [0.5, Math.sqrt(3) / 2, 0]')
    expect(defaultCode).toContain('const layerPeriod = Math.sqrt(2 / 3) * latticePeriod')
    expect(defaultCode).toContain('pos: layerPosTensor')
    expect(defaultCode).toContain('inject={{')
    expect(defaultCode).toContain('rotationAzimuth')
    expect(defaultCode).toContain('rotationCosPolar')
    expect(defaultCode).toContain('rotationAngle')
    expect(defaultCode).toContain('const randomRotationVars = structure.randomVars()')
    expect(defaultCode).not.toMatch(/<(rotate|scale)\b/)
    expect(defaultCode).not.toMatch(/\b(angles|factors)=/)

    const compiled = await transform(defaultCode, {
      format: 'cjs',
      jsxFactory: 'h',
      jsxFragment: 'Fragment',
      loader: 'tsx',
      platform: 'browser',
      target: 'es2020',
    })
    const parts = executeCompiledCode(compiled.code)

    expect(parts).toHaveLength(28)
    expect(parts.slice(0, 27).every((part) => part.materialName === 'Core')).toBe(true)
    expect(parts[27].materialName).toBe('Cladding')
    parts.slice(0, 27).forEach((part) => {
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

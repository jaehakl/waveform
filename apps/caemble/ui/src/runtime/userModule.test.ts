import { describe, expect, it } from 'vitest'
import { transform } from 'esbuild'
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
    const compiled = await transform(defaultCode, {
      format: 'cjs',
      jsxFactory: 'h',
      jsxFragment: 'Fragment',
      loader: 'tsx',
      platform: 'browser',
      target: 'es2020',
    })
    const parts = executeCompiledCode(compiled.code)

    expect(parts.map((part) => part.materialName)).toEqual(['Core', 'Cladding'])
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

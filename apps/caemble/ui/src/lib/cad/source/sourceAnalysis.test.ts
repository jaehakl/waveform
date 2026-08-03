import { describe, expect, it } from 'vitest'
import { analyzeCadSourceV2, parseCadSourceV2, staticCadSourceImportsV2 } from './sourceAnalysis'

describe('SourceAnalysisV2 policy', () => {
  it('resolves one lowercase factory through direct top-level const bindings', () => {
    const source = `import { structure as define } from '@caemble/core/v2'
import { size } from './size'
const options = { lengthUnit: 'mm', varsSchema: {}, geometry: () => <box size={size} /> }
const active = define(options)
export default active
`
    const analysis = analyzeCadSourceV2(source, 'structure')

    expect(analysis.factoryName).toBe('structure')
    expect(analysis.options.type).toBe('ObjectExpression')
    expect(staticCadSourceImportsV2(source)).toEqual(['@caemble/core/v2', './size'])
  })

  it('requires exactly one matching default factory export', () => {
    expect(() => analyzeCadSourceV2(`import { structure } from '@caemble/core/v2'
export default structure({})
export default structure({})`, 'structure')).toThrow('Exactly one default export')
    expect(() => analyzeCadSourceV2(`import { structure } from '@caemble/core/v2'
export default class Model {}`, 'structure')).toThrow('must resolve to structure({...})')
    expect(() => analyzeCadSourceV2(`import { structure } from '@caemble/core/v2'
export default structure({})`, 'experiment')).toThrow('experiment must be a named import')
  })

  it('allows v3 kernel imports only for Experiment Programs', () => {
    const program = `import { experiment } from '@caemble/core/v3'
import { dcCurrentDensity } from '@caemble/kernels/v1'
export default experiment({ kernel: dcCurrentDensity })`

    expect(analyzeCadSourceV2(program, 'experiment').factoryName).toBe('experiment')
    expect(() => analyzeCadSourceV2(program, 'structure')).toThrow(
      'Structure Source can only use @caemble/core/v2',
    )
  })

  it('rejects external, URL, dynamic, and source-level require imports', () => {
    expect(() => parseCadSourceV2("import value from 'other-package'"))
      .toThrow('Import is not allowed')
    expect(() => parseCadSourceV2("import value from 'https://example.com/value.ts'"))
      .toThrow('Import is not allowed')
    expect(() => parseCadSourceV2("const value = import('./value')"))
      .toThrow('Dynamic import is not supported')
    expect(() => parseCadSourceV2("const value = require('./value')"))
      .toThrow('Source-level require() is not supported')
  })
})

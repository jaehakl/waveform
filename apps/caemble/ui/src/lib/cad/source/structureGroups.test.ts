import { describe, expect, it } from 'vitest'
import { updateModelGroupSource, updateStructureGroupSource } from './structureGroups'

describe('Structure group source synchronization', () => {
  it('inserts a group property into the structure used by the default export', () => {
    const source = `import { structure } from '@caemble/core'
const unused = structure({ lengthUnit: 'mm', geometry: () => null, varsSchema: {} })
const active = structure({ lengthUnit: 'mm',
  geometry: () => null,
  varsSchema: {},
})
export default active
`
    const updated = updateStructureGroupSource(source, 'geometryGroup', {
      body: ['assembly.frame', 'assembly.cells'],
    }).source

    expect(updated).toContain('geometryGroup: {\n    "body": ["assembly.frame", "assembly.cells"],\n  },')
    expect(updated.match(/geometryGroup/g)).toHaveLength(1)
    expect(updated).toContain("const unused = structure({ lengthUnit: 'mm', geometry: () => null, varsSchema: {} })")
  })

  it('traces an aliased factory and top-level options binding', () => {
    const source = `import { structure as defineStructure } from '@caemble/core'
const oldGroups = {}
const options = { geometry: () => null, varsSchema: {}, surfaceGroup: oldGroups }
const active = defineStructure(options)
export default active
`
    const updated = updateStructureGroupSource(source, 'surfaceGroup', {
      접촉면: ['assembly.frame/surface-1'],
    }).source

    expect(updated).toContain('surfaceGroup: oldGroups')
    expect(updated).toContain('const oldGroups = {\n  "접촉면": ["assembly.frame/surface-1"],\n}')
  })

  it('keeps an empty group property instead of removing it', () => {
    const source = `import { structure } from '@caemble/core'
export default structure({ lengthUnit: 'mm', geometry: () => null, varsSchema: {} })
`
    const updated = updateStructureGroupSource(source, 'geometryGroup', {}).source

    expect(updated).toContain('geometryGroup: {}')
  })

  it('rejects duplicate target properties without changing source', () => {
    const source = `import { structure } from '@caemble/core'
const active = structure({ lengthUnit: 'mm',
  geometry: () => null,
  varsSchema: {},
  geometryGroup: {},
  "geometryGroup": {},
})
export default active
`

    expect(() => updateStructureGroupSource(source, 'geometryGroup', {})).toThrow('duplicate geometryGroup properties')
  })

  it('rejects dynamic structure selection', () => {
    const source = `import { structure } from '@caemble/core'
const first = structure({ lengthUnit: 'mm', geometry: () => null, varsSchema: {} })
const second = structure({ lengthUnit: 'mm', geometry: () => null, varsSchema: {} })
export default Math.random() ? first : second
`

    expect(() => updateStructureGroupSource(source, 'surfaceGroup', {})).toThrow(
      'resolve statically to structure({...})',
    )
  })

  it('makes spread-based options read-only for round-trip edits', () => {
    const source = `import { structure } from '@caemble/core'
const common = { lengthUnit: 'mm', geometry: () => null, varsSchema: {} }
export default structure({ ...common })
`

    expect(() => updateStructureGroupSource(source, 'geometryGroup', {})).toThrow('spread or computed options')
  })
})

describe('Experiment group source synchronization', () => {
  it('updates only the experiment used by the default export', () => {
    const source = `import { defineKernelTask, experiment } from '@caemble/core'
const unusedTask = defineKernelTask({ name: 'unused', version: '1' }, {})
const activeTask = defineKernelTask({ name: 'active', version: '1' }, {})
const unused = experiment({ lengthUnit: 'mm',
  tasks: () => ({ unused: unusedTask }),
  recordedData: {},
  simulate: ({ sim }) => sim.initialState,
  geometry: () => null,
  varsSchema: {},
})
const active = experiment({ lengthUnit: 'mm',
  tasks: () => ({ active: activeTask }),
  recordedData: {},
  simulate: ({ sim }) => sim.initialState,
  geometry: () => null,
  varsSchema: {},
})
export default active
`
    const updated = updateModelGroupSource(source, 'experiment', 'geometryGroup', {
      domain: ['experiment-domain'],
    }).source

    expect(updated).toContain('geometryGroup: {\n    "domain": ["experiment-domain"],\n  },')
    expect(updated.match(/geometryGroup/g)).toHaveLength(1)
    expect(updated).toContain('tasks: () => ({ unused: unusedTask })')
  })

  it('traces an aliased experiment factory and options binding', () => {
    const source = `import { defineKernelTask, experiment as defineExperiment } from '@caemble/core'
const activeTask = defineKernelTask({ name: 'active', version: '1' }, {})
const oldGroups = {}
const options = {
  tasks: () => ({ active: activeTask }),
  recordedData: {},
  simulate: ({ sim }) => sim.initialState,
  geometry: () => null,
  varsSchema: {},
  surfaceGroup: oldGroups,
}
const active = defineExperiment(options)
export default active
`
    const updated = updateModelGroupSource(source, 'experiment', 'surfaceGroup', {
      외곽면: ['domain/surface-1'],
    }).source

    expect(updated).toContain('surfaceGroup: oldGroups')
    expect(updated).toContain('const oldGroups = {\n  "외곽면": ["domain/surface-1"],\n}')
  })

  it('requires the matching experiment factory entry path', () => {
    const source = `import { structure } from '@caemble/core'
export default structure({ lengthUnit: 'mm', geometry: () => null, varsSchema: {} })
`

    expect(() => updateModelGroupSource(source, 'experiment', 'geometryGroup', {})).toThrow(
      'experiment must be a named import',
    )
  })
})

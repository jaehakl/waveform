import { describe, expect, it } from 'vitest'
import { updateModelGroupSource, updateStructureGroupSource } from './structureGroups'

describe('Structure group source synchronization', () => {
  it('inserts a group property into the Structure used by the default Sample', () => {
    const source = `import { Sample, Structure } from '@caemble/core'
const unused = new Structure({ geometry: () => null, varsSchema: {} })
const active = new Structure({
  geometry: () => null,
  varsSchema: {},
})
export default new Sample(active)
`
    const updated = updateStructureGroupSource(source, 'geometryGroup', {
      body: ['assembly.frame', 'assembly.cells'],
    }).source

    expect(updated).toContain('geometryGroup: {\n    "body": ["assembly.frame", "assembly.cells"],\n  },')
    expect(updated.match(/geometryGroup/g)).toHaveLength(1)
    expect(updated).toContain('const unused = new Structure({ geometry: () => null, varsSchema: {} })')
  })

  it('traces aliased imports and top-level Sample and options bindings', () => {
const source = `import { Sample as ActiveSample, Structure as ActiveStructure } from '@caemble/core'
const options = { geometry: () => null, varsSchema: {}, surfaceGroup: oldGroups }
const structure = new ActiveStructure(options)
const sample = new ActiveSample(structure)
export default sample
`
    const updated = updateStructureGroupSource(source, 'surfaceGroup', {
      접촉면: ['assembly.frame/surface-1'],
    }).source

    expect(updated).toContain('surfaceGroup: {\n  "접촉면": ["assembly.frame/surface-1"],\n}')
    expect(updated).not.toContain('surfaceGroup: oldGroups')
  })

  it('keeps an empty group property instead of removing it', () => {
    const source = `import { Sample, Structure } from '@caemble/core'
export default new Sample(new Structure({ geometry: () => null, varsSchema: {} }))
`
    const updated = updateStructureGroupSource(source, 'geometryGroup', {}).source

    expect(updated).toContain('geometryGroup: {}')
  })

  it('rejects duplicate target properties without changing source', () => {
    const source = `import { Sample, Structure } from '@caemble/core'
const structure = new Structure({
  geometry: () => null,
  varsSchema: {},
  geometryGroup: {},
  "geometryGroup": {},
})
export default new Sample(structure)
`

    expect(() => updateStructureGroupSource(source, 'geometryGroup', {})).toThrow(
      'duplicate geometryGroup properties',
    )
  })

  it('rejects dynamic Structure selection', () => {
    const source = `import { Sample, Structure } from '@caemble/core'
const first = new Structure({ geometry: () => null, varsSchema: {} })
const second = new Structure({ geometry: () => null, varsSchema: {} })
export default new Sample(Math.random() ? first : second)
`

    expect(() => updateStructureGroupSource(source, 'surfaceGroup', {})).toThrow(
      'Structure constructor could not be traced statically',
    )
  })
})

describe('Experiment group source synchronization', () => {
  it('updates only the Experiment used by the default Setup', () => {
    const source = `import { Experiment, Setup } from '@caemble/core'
const unused = new Experiment({
  solver: { name: 'unused', version: '1', parameters: () => ({}) },
  geometry: () => null,
  varsSchema: {},
})
const active = new Experiment({
  solver: { name: 'active', version: '1', parameters: () => ({}) },
  geometry: () => null,
  varsSchema: {},
})
export default new Setup(active)
`
    const updated = updateModelGroupSource(source, 'experiment', 'geometryGroup', {
      domain: ['experiment-domain'],
    }).source

    expect(updated).toContain('geometryGroup: {\n    "domain": ["experiment-domain"],\n  },')
    expect(updated.match(/geometryGroup/g)).toHaveLength(1)
    expect(updated).toContain("solver: { name: 'unused', version: '1', parameters: () => ({}) }")
  })

  it('traces aliased Setup, Experiment, and options bindings', () => {
    const source = `import { Experiment as ActiveExperiment, Setup as ActiveSetup } from '@caemble/core'
const options = {
  solver: { name: 'active', version: '1', parameters: () => ({}) },
  geometry: () => null,
  varsSchema: {},
  surfaceGroup: oldGroups,
}
const experiment = new ActiveExperiment(options)
const setup = new ActiveSetup(experiment)
export default setup
`
    const updated = updateModelGroupSource(source, 'experiment', 'surfaceGroup', {
      외곽면: ['domain/surface-1'],
    }).source

    expect(updated).toContain('  surfaceGroup: {\n    "외곽면": ["domain/surface-1"],\n  },')
    expect(updated).not.toContain('surfaceGroup: oldGroups')
  })

  it('requires the matching Setup and Experiment entry path', () => {
    const source = `import { Sample, Structure } from '@caemble/core'
export default new Sample(new Structure({ geometry: () => null, varsSchema: {} }))
`

    expect(() => updateModelGroupSource(source, 'experiment', 'geometryGroup', {})).toThrow(
      'Setup and Experiment must be named imports',
    )
  })
})

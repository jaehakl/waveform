import { describe, expect, it } from 'vitest'
import { analyzeCadSourceV2 } from './sourceAnalysis'
import { migrateCadSourceV1ToV2 } from './codemodV2'

describe('static v1 to v2 CAD Source codemod', () => {
  it('migrates a static Structure wrapper and moves global vars into geometry context', () => {
    const source = `import { Material, Sample, Structure, type Vec3, vars } from '@caemble/core'
const structure = new Structure({
  lengthUnit: 'mm',
  varsSchema: { size: { min: [1, 1, 1], max: [10, 10, 10] } },
  geometry: () => <box size={vars.size as Vec3} />,
})
export default new Sample(structure)
`
    const result = migrateCadSourceV1ToV2(source, 'structure')

    expect(result.converted).toBe(true)
    expect(result.issues).toEqual([])
    expect(result.source).toContain("from '@caemble/core/v2'")
    expect(result.source).toContain('structure as defineStructureV2')
    expect(result.source).toContain('const structure = defineStructureV2({')
    expect(result.source).toContain('geometry: ({ vars }) =>')
    expect(result.source).toContain('size={vars.size}')
    expect(result.source).toContain('export default structure')
    expect(result.source).not.toContain('Sample')
    expect(result.source).not.toContain(' as Vec3}')
    expect(() => analyzeCadSourceV2(result.source, 'structure')).not.toThrow()
  })

  it('adds context parameters to every inline Experiment factory', () => {
    const source = `import { Experiment, Setup, vars } from '@caemble/core'
const experiment = new Experiment({
  lengthUnit: 'mm',
  varsSchema: { voltage: { min: 0, max: 10 } },
  geometry: () => <box size={[1, 1, 1]} />,
  solver: { name: 'test', version: '1', parameters: () => ({ voltage: vars.voltage }) },
  initializations: () => [],
  boundaryConditions: () => [{ target: ['structure.surface.face'], label: 'v', methodId: 'v', parameters: { voltage: vars.voltage } }],
  recordedData: () => [],
})
export default new Setup(experiment)
`
    const result = migrateCadSourceV1ToV2(source, 'experiment')

    expect(result.converted).toBe(true)
    expect(result.source.match(/\(\{ vars \}\) =>/g)).toHaveLength(5)
    expect(result.source).toContain('experiment as defineExperimentV2')
    expect(result.source).toContain('export default experiment')
    expect(() => analyzeCadSourceV2(result.source, 'experiment')).not.toThrow()
  })

  it('reports module-level global vars dependencies without applying partial edits', () => {
    const source = `import { Sample, Structure, vars } from '@caemble/core'
function size() { return vars.size }
const model = new Structure({
  lengthUnit: 'mm',
  varsSchema: { size: { min: [1, 1, 1], max: [2, 2, 2] } },
  geometry: () => <box size={size()} />,
})
export default new Sample(model)
`
    const result = migrateCadSourceV1ToV2(source, 'structure')

    expect(result.converted).toBe(false)
    expect(result.source).toBe(source)
    expect(result.issues[0]).toMatchObject({ line: 2 })
    expect(result.issues.map(({ message }) => message).join('\n')).toContain('Module-level vars dependency')
  })

  it('refuses wrapper partial vars that belong in external evaluation input', () => {
    const source = `import { Sample, Structure } from '@caemble/core'
const model = new Structure({ lengthUnit: 'mm', varsSchema: {}, geometry: () => null })
export default new Sample(model, { width: 2 })
`
    const result = migrateCadSourceV1ToV2(source, 'structure')

    expect(result.converted).toBe(false)
    expect(result.source).toBe(source)
    expect(result.issues.map(({ message }) => message).join('\n')).toContain('move fixed vars to external evaluation input')
  })

  it('preserves whole-declaration type imports without duplicating the type modifier', () => {
    const source = `import type { Vec3 } from '@caemble/core'
import { Sample, Structure } from '@caemble/core'
const model = new Structure({ lengthUnit: 'mm', varsSchema: {}, geometry: () => <box size={[1, 1, 1] as Vec3} /> })
export default new Sample(model)
`
    const result = migrateCadSourceV1ToV2(source, 'structure')

    expect(result.converted).toBe(true)
    expect(result.source).toContain("import type { Vec3 } from '@caemble/core/v2'")
    expect(result.source).not.toContain('type { type Vec3')
  })
})

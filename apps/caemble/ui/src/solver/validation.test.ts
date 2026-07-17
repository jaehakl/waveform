import { describe, expect, it } from 'vitest'
import type { SolverModule, SolverPreflightInput } from './types'
import { SolverRegistry } from './registry'
import type { SolverSpec } from './spec'
import { validateSolverContract } from './validation'
import { dcCurrentDensitySpec } from './modules/dcCurrentDensity'

function validInput(): SolverPreflightInput {
  return {
    structure: {
      scene: {
        lengthUnit: 'mm',
        tree: { key: 'root', label: 'root', children: [] },
        parts: [{
          id: 'conductor',
          geometry: {},
          surfaces: [
            { id: 'conductor/surface-1', name: 'surface-1', polygonIndices: [0] },
            { id: 'conductor/surface-2', name: 'surface-2', polygonIndices: [1] },
          ],
          material: {
            symbol: 'Copper',
            variables: {
              electricalConductivity: {
                type: 'float', value: 5.96e7,
                unit: 'S.m-1', quantityKind: 'ElectricConductivity',
              },
              futureMaterialParameter: 'preserved',
            },
          },
        }],
        geometryGroups: [{
          id: 'geometry-group-conductor',
          name: 'conductor',
          kind: 'geometry',
          memberIds: ['conductor'],
          geometryIds: ['conductor'],
          surfaceIds: [],
          missingMemberIds: [],
        }],
        surfaceGroups: [
          {
            id: 'surface-group-source',
            name: 'sourceTerminal',
            kind: 'surface',
            memberIds: ['conductor/surface-1'],
            geometryIds: ['conductor'],
            surfaceIds: ['conductor/surface-1'],
            missingMemberIds: [],
          },
          {
            id: 'surface-group-reference',
            name: 'referenceTerminal',
            kind: 'surface',
            memberIds: ['conductor/surface-2'],
            geometryIds: ['conductor'],
            surfaceIds: ['conductor/surface-2'],
            missingMemberIds: [],
          },
        ],
      },
    },
    experiment: {
      scene: {
        lengthUnit: 'mm',
        tree: { key: 'root', label: 'root', children: [] },
        parts: [],
        geometryGroups: [],
        surfaceGroups: [],
      },
      solver: {
        name: 'dc-current-density',
        version: '1.0.0',
        parameters: {
          relativeTolerance: {
            type: 'float', value: 0.000001,
            unit: '%', quantityKind: 'DimensionlessRatio',
          },
          maxIterations: 1000,
          futureSolverParameter: 'preserved',
        },
      },
      rules: {
        initializations: [{
          target: ['structure.geometry.conductor'],
          label: 'Grid',
          methodId: 'dc.voxel-grid',
          parameters: {
            gridShape: {
              type: 'tensor', dimension: 1, shape: [3], dtype: 'int32',
              axes: [{ name: 'grid axis', ticks: ['s', 'u', 'v'] }],
              value: [20, 11, 11],
            },
            futureMethodParameter: true,
          },
        }],
        boundaryConditions: [
          {
            target: ['structure.surface.sourceTerminal'],
            label: 'Source',
            methodId: 'dc.source-potential',
            parameters: {
              voltage: { type: 'float', value: 1, unit: 'mV', quantityKind: 'Voltage' },
            },
          },
          {
            target: ['structure.surface.referenceTerminal'],
            label: 'Reference',
            methodId: 'dc.reference-potential',
            parameters: {
              voltage: { type: 'float', value: 0, unit: 'mV', quantityKind: 'Voltage' },
            },
          },
        ],
        recordedData: [
          {
            target: ['structure.geometry.conductor'],
            label: 'Density',
            methodId: 'dc.current-density',
            parameters: {
              crossSectionPosition: {
                type: 'float', value: 0.5,
                unit: '{fraction}', quantityKind: 'DimensionlessRatio',
              },
            },
            result: {
              type: 'tensor', dimension: 2, shape: [-1, -1], dtype: 'float64',
              unit: 'A.m-2', quantityKind: 'ElectricCurrentDensity',
              axes: [
                { name: 'cross-section v', unit: 'm', quantityKind: 'Length' },
                { name: 'cross-section u', unit: 'm', quantityKind: 'Length' },
              ],
            },
          },
          {
            target: ['structure.geometry.conductor'],
            label: 'Current',
            methodId: 'dc.total-current',
            parameters: {
              crossSectionPosition: {
                type: 'float', value: 0.5,
                unit: '{fraction}', quantityKind: 'DimensionlessRatio',
              },
            },
            result: {
              type: 'tensor', dimension: 0, shape: [], dtype: 'float64',
              unit: 'A', quantityKind: 'ElectricCurrent', axes: [],
            },
          },
        ],
      },
    },
  } as SolverPreflightInput
}

function moduleFor(spec: SolverSpec): SolverModule {
  return { spec, solve: async () => ({}) }
}

describe('Solver spec validation', () => {
  it('accepts applicable units and preserves undeclared solver, method, and Material parameters', () => {
    const input = validInput()
    const result = validateSolverContract(dcCurrentDensitySpec, input)

    expect(result).toMatchObject({ complete: true, issues: [] })
    expect(input.experiment.solver.parameters.futureSolverParameter).toBe('preserved')
    expect(input.experiment.rules.initializations[0].parameters.futureMethodParameter).toBe(true)
    expect(input.structure?.scene.parts[0].material?.variables.futureMaterialParameter).toBe('preserved')
  })

  it('validates Experiment-only requirements before a Structure is available', () => {
    const { experiment } = validInput()
    const valid = validateSolverContract(dcCurrentDensitySpec, { experiment })
    expect(valid.complete).toBe(false)
    expect(valid.issues).toEqual([])

    const parameters = experiment.solver.parameters as Record<string, unknown>
    delete parameters.maxIterations
    const invalid = validateSolverContract(dcCurrentDensitySpec, { experiment })
    expect(invalid.issues).toContainEqual(expect.objectContaining({
      documentType: 'experiment',
      path: 'solver.parameters.maxIterations',
    }))

    const optionalSpec = structuredClone(dcCurrentDensitySpec) as unknown as {
      parameters: { maxIterations: { required?: boolean } }
    }
    optionalSpec.parameters.maxIterations.required = false
    expect(validateSolverContract(optionalSpec as unknown as SolverSpec, { experiment }).issues).toEqual([])
  })

  it('reports method, result, target, Material, Quantity Kind, and exact-unit violations', () => {
    const input = structuredClone(validInput()) as SolverPreflightInput
    const mutable = input as unknown as {
      structure: { scene: { parts: Array<{ material?: { variables: Record<string, unknown> } }> } }
      experiment: {
        rules: {
          initializations: Array<{ methodId: string; [key: string]: unknown }>
          boundaryConditions: Array<{ parameters: { voltage: Record<string, unknown> } }>
          recordedData: Array<{ result: { shape: number[] } }>
        }
      }
    }
    mutable.experiment.rules.initializations.push({
      ...mutable.experiment.rules.initializations[0],
      methodId: 'dc.unknown',
    })
    mutable.experiment.rules.boundaryConditions[0].parameters.voltage.quantityKind = 'Length'
    mutable.experiment.rules.recordedData[0].result.shape = [1, 1]
    mutable.structure.scene.parts[0].material!.variables.electricalConductivity = {
      type: 'float', value: 1, unit: 'S/m', quantityKind: 'ElectricConductivity',
    }

    const messages = validateSolverContract(dcCurrentDensitySpec, input).issues.map((issue) => issue.message)
    expect(messages.some((message) => message.includes('is not registered'))).toBe(true)
    expect(messages.some((message) => message.includes('must be Voltage'))).toBe(true)
    expect(messages.some((message) => message.includes('must be [-1,-1]'))).toBe(true)
    expect(messages.some((message) => message.includes('is not applicable'))).toBe(true)
  })

  it('rejects missing target Materials and unknown solver identities', () => {
    const input = structuredClone(validInput()) as SolverPreflightInput
    delete (input.structure!.scene.parts[0] as { material?: unknown }).material
    expect(validateSolverContract(dcCurrentDensitySpec, input).issues).toContainEqual(expect.objectContaining({
      documentType: 'structure',
      path: 'structure.parts.conductor.material',
    }))

    const registry = new SolverRegistry([moduleFor(structuredClone(dcCurrentDensitySpec))])
    const unknown = structuredClone(validInput()) as SolverPreflightInput
    ;(unknown.experiment.solver as { version: string }).version = '2.0.0'
    expect(registry.preflight(unknown).issues[0].message).toContain('No solver module is registered')
  })

  it('validates and deeply freezes registered specs', () => {
    const spec = structuredClone(dcCurrentDensitySpec)
    const registry = new SolverRegistry([moduleFor(spec)])
    expect(Object.isFrozen(registry.get(spec.name, spec.version)?.spec)).toBe(true)
    expect(Object.isFrozen(registry.get(spec.name, spec.version)?.spec.methods.recordedData)).toBe(true)
    expect(() => new SolverRegistry([moduleFor(spec), moduleFor(spec)])).toThrow('registered more than once')

    const invalidUnit = structuredClone(dcCurrentDensitySpec) as unknown as {
      parameters: { relativeTolerance: { value: { referenceUnit: string } } }
    }
    invalidUnit.parameters.relativeTolerance.value.referenceUnit = 'V'
    expect(() => new SolverRegistry([moduleFor(invalidUnit as unknown as SolverSpec)]))
      .toThrow('is not applicable')

    const emptyQuantityKind = structuredClone(dcCurrentDensitySpec) as unknown as {
      parameters: { relativeTolerance: { value: { quantityKind: string; referenceUnit: string } } }
    }
    emptyQuantityKind.parameters.relativeTolerance.value.quantityKind = 'APIGravity'
    emptyQuantityKind.parameters.relativeTolerance.value.referenceUnit = '1'
    expect(() => new SolverRegistry([moduleFor(emptyQuantityKind as unknown as SolverSpec)]))
      .toThrow('has no applicable UCUM units')
  })
})

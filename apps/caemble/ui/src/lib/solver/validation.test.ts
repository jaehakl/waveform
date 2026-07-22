import { describe, expect, it } from 'vitest'
import type { SolverModule, SolverPreflightInput } from './types'
import { SolverRegistry } from './registry'
import type { SolverSpec } from './spec'
import { validateSolverContract } from './validation'
import { dcCurrentDensitySpec } from './modules/dcCurrentDensity'
import { identityCartesianBasis } from '../quantitykind/identityBasis'

function validInput(): SolverPreflightInput {
  return {
    structure: {
      scene: {
        lengthUnit: 'mm',
        tree: { key: 'root', label: 'root', children: [] },
        parts: [
          {
            id: 'conductor',
            geometry: {},
            surfaces: [
              { id: 'conductor/surface-1', name: 'surface-1', polygonIndices: [0] },
              { id: 'conductor/surface-2', name: 'surface-2', polygonIndices: [1] },
            ],
            material: {
              name: 'Copper',
              variables: {
                'electrical.conductivity': {
                  dtype: 'float64',
                  value: [
                    [5.96e7, 0, 0],
                    [0, 5.96e7, 0],
                    [0, 0, 5.96e7],
                  ],
                  unit: 'S.m-1',
                  quantityKind: 'electromagnetism.ElectricConductivity',
                  basis: identityCartesianBasis,
                },
              },
            },
          },
        ],
        geometryGroups: [
          {
            id: 'geometry-group-conductor',
            name: 'conductor',
            kind: 'geometry',
            memberIds: ['conductor'],
            geometryIds: ['conductor'],
            surfaceIds: [],
            missingMemberIds: [],
          },
        ],
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
        version: '0.0.0',
        parameters: {
          relativeTolerance: {
            dtype: 'float64',
            value: 0.000001,
            unit: '%',
            quantityKind: 'DimensionlessRatio',
          },
          maxIterations: 1000,
          futureSolverParameter: 'preserved',
        },
      },
      rules: {
        initializations: [
          {
            target: ['structure.geometry.conductor'],
            label: 'Grid',
            methodId: 'dc.voxel-grid',
            parameters: {
              gridShape: {
                dtype: 'int32',
                axes: [{ length: 3 }],
                value: [20, 11, 11],
              },
              futureMethodParameter: true,
            },
          },
        ],
        boundaryConditions: [
          {
            target: ['structure.surface.sourceTerminal'],
            label: 'Source',
            methodId: 'dc.source-potential',
            parameters: {
              voltage: { dtype: 'float64', value: 1, unit: 'mV', quantityKind: 'electromagnetism.Voltage' },
            },
          },
          {
            target: ['structure.surface.referenceTerminal'],
            label: 'Reference',
            methodId: 'dc.reference-potential',
            parameters: {
              voltage: { dtype: 'float64', value: 0, unit: 'mV', quantityKind: 'electromagnetism.Voltage' },
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
                dtype: 'float64',
                value: 0.5,
                unit: '{fraction}',
                quantityKind: 'DimensionlessRatio',
              },
            },
            result: {
              dtype: 'float64',
              unit: 'A.m-2',
              quantityKind: 'electromagnetism.ElectricCurrentDensity',
              basis: identityCartesianBasis,
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
                dtype: 'float64',
                value: 0.5,
                unit: '{fraction}',
                quantityKind: 'DimensionlessRatio',
              },
            },
            result: {
              dtype: 'float64',
              unit: 'A',
              quantityKind: 'electromagnetism.ElectricCurrent',
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
  it('accepts applicable units and preserves undeclared solver and method parameters', () => {
    const input = validInput()
    const result = validateSolverContract(dcCurrentDensitySpec, input)

    expect(result).toMatchObject({ complete: true, issues: [] })
    expect(input.experiment.solver.parameters.futureSolverParameter).toBe('preserved')
    expect(input.experiment.rules.initializations[0].parameters.futureMethodParameter).toBe(true)
  })

  it('validates Experiment-only requirements before a Structure is available', () => {
    const { experiment } = validInput()
    const valid = validateSolverContract(dcCurrentDensitySpec, { experiment })
    expect(valid.complete).toBe(false)
    expect(valid.issues).toEqual([])

    const parameters = experiment.solver.parameters as Record<string, unknown>
    delete parameters.maxIterations
    const invalid = validateSolverContract(dcCurrentDensitySpec, { experiment })
    expect(invalid.issues).toContainEqual(
      expect.objectContaining({
        documentType: 'experiment',
        path: 'solver.parameters.maxIterations',
      }),
    )

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
          recordedData: Array<{ result: { axes: unknown[] } }>
        }
      }
    }
    mutable.experiment.rules.initializations.push({
      ...mutable.experiment.rules.initializations[0],
      methodId: 'dc.unknown',
    })
    mutable.experiment.rules.boundaryConditions[0].parameters.voltage.quantityKind = 'Length'
    mutable.experiment.rules.recordedData[0].result.axes = [{ name: 'only one axis' }]
    mutable.structure.scene.parts[0].material!.variables['electrical.conductivity'] = {
      dtype: 'float64',
      value: [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ],
      unit: 'V',
      quantityKind: 'electromagnetism.ElectricConductivity',
      basis: identityCartesianBasis,
    }

    const messages = validateSolverContract(dcCurrentDensitySpec, input).issues.map((issue) => issue.message)
    expect(messages.some((message) => message.includes('is not registered'))).toBe(true)
    expect(messages.some((message) => message.includes('must be electromagnetism.Voltage'))).toBe(true)
    expect(messages.some((message) => message.includes('must contain 2 axes'))).toBe(true)
    expect(messages.some((message) => message.includes('is not applicable'))).toBe(true)
  })

  it('rejects missing target Materials and unknown solver identities', () => {
    const input = structuredClone(validInput()) as SolverPreflightInput
    delete (input.structure!.scene.parts[0] as { material?: unknown }).material
    expect(validateSolverContract(dcCurrentDensitySpec, input).issues).toContainEqual(
      expect.objectContaining({
        documentType: 'structure',
        path: 'structure.parts.conductor.material',
      }),
    )

    const registry = new SolverRegistry([moduleFor(structuredClone(dcCurrentDensitySpec))])
    const unknown = structuredClone(validInput()) as SolverPreflightInput
    ;(unknown.experiment.solver as { version: string }).version = '1.0.0'
    expect(registry.preflight(unknown).issues[0].message).toContain('No solver module is registered')
  })

  it('accepts any valid tensor basis for controller-side rotation', () => {
    const rotated = structuredClone(validInput()) as SolverPreflightInput
    const conductivity = rotated.structure!.scene.parts[0].material!.variables[
      'electrical.conductivity'
    ] as unknown as { basis: number[][] }
    conductivity.basis = [
      [0, 1, 0],
      [-1, 0, 0],
      [0, 0, 1],
    ]

    expect(validateSolverContract(dcCurrentDensitySpec, rotated).issues).toEqual([])

    const missing = structuredClone(validInput()) as SolverPreflightInput
    delete (
      missing.structure!.scene.parts[0].material!.variables['electrical.conductivity'] as unknown as { basis?: unknown }
    ).basis
    expect(validateSolverContract(dcCurrentDensitySpec, missing).issues).toContainEqual(
      expect.objectContaining({
        path: 'structure.parts.conductor.material.variables.electrical.conductivity.basis',
        message: 'must be a valid Cartesian basis.',
      }),
    )
  })

  it('derives sampled-relation quantities from the model catalog', () => {
    const spec = structuredClone(dcCurrentDensitySpec) as unknown as {
      materials: Array<{ parameters: Record<string, unknown> }>
    }
    spec.materials[0].parameters = {
      'model.magnetic_hysteresis.b_h_curve': {
        description: 'B-H relation.',
        value: {
          kind: 'sampled_relation',
          input: { referenceUnit: 'A.m-1', referenceBasis: identityCartesianBasis },
          output: { referenceUnit: 'T', referenceBasis: identityCartesianBasis },
        },
      },
    }
    expect(() => new SolverRegistry([moduleFor(spec as unknown as SolverSpec)])).not.toThrow()

    const input = structuredClone(validInput()) as SolverPreflightInput
    const variables = input.structure!.scene.parts[0].material!.variables as Record<string, unknown>
    variables['model.magnetic_hysteresis.b_h_curve'] = {
      kind: 'sampled_relation',
      input: {
        unit: 'A.m-1',
        values: [
          [0, 0, 0],
          [100, 0, 0],
        ],
        basis: identityCartesianBasis,
      },
      output: {
        unit: 'T',
        values: [
          [0, 0, 0],
          [1.2, 0, 0],
        ],
        basis: identityCartesianBasis,
      },
    }
    expect(validateSolverContract(spec as unknown as SolverSpec, input).issues).toEqual([])

    ;(
      variables['model.magnetic_hysteresis.b_h_curve'] as {
        output: { basis: number[][] }
      }
    ).output.basis = [
      [0, 1, 0],
      [-1, 0, 0],
      [0, 0, 1],
    ]
    expect(validateSolverContract(spec as unknown as SolverSpec, input).issues).toContainEqual(
      expect.objectContaining({
        path: 'structure.parts.conductor.material.variables.model.magnetic_hysteresis.b_h_curve',
        message: expect.stringContaining('input and output must use the same Cartesian basis'),
      }),
    )

    const scalarBasis = structuredClone(spec) as typeof spec
    scalarBasis.materials[0].parameters = {
      'model.sorption.isotherm': {
        description: 'Sorption relation.',
        value: {
          kind: 'sampled_relation',
          input: { referenceUnit: '%', referenceBasis: identityCartesianBasis },
          output: { referenceUnit: '{fraction}' },
        },
      },
    }
    expect(() => new SolverRegistry([moduleFor(scalarBasis as unknown as SolverSpec)])).toThrow(
      'referenceBasis is forbidden for scalar Quantity Kind thermodynamics.RelativeHumidity',
    )
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
    expect(() => new SolverRegistry([moduleFor(invalidUnit as unknown as SolverSpec)])).toThrow('is not applicable')

    const inapplicableLengthUnit = structuredClone(dcCurrentDensitySpec) as unknown as {
      referenceLengthUnit: string
    }
    inapplicableLengthUnit.referenceLengthUnit = 's'
    expect(() => new SolverRegistry([moduleFor(inapplicableLengthUnit as unknown as SolverSpec)])).toThrow(
      'is not applicable to Length',
    )

    const missingLengthUnit = structuredClone(dcCurrentDensitySpec) as unknown as {
      referenceLengthUnit?: string
    }
    delete missingLengthUnit.referenceLengthUnit
    expect(() => new SolverRegistry([moduleFor(missingLengthUnit as unknown as SolverSpec)])).toThrow(
      'must be a non-empty UCUM code',
    )

    const missingReferenceBasis = structuredClone(dcCurrentDensitySpec) as unknown as {
      materials: Array<{ parameters: { 'electrical.conductivity': { value: { referenceBasis?: unknown } } } }>
    }
    delete missingReferenceBasis.materials[0].parameters['electrical.conductivity'].value.referenceBasis
    expect(() => new SolverRegistry([moduleFor(missingReferenceBasis as unknown as SolverSpec)])).toThrow(
      'referenceBasis must contain exactly three Cartesian basis vectors',
    )

    const conflictingMaterialBasis = structuredClone(dcCurrentDensitySpec) as unknown as {
      materials: Array<{
        role: string
        parameters: {
          'electrical.conductivity': { value: { referenceBasis: number[][] } }
        }
      }>
    }
    const secondRole = structuredClone(conflictingMaterialBasis.materials[0])
    secondRole.role = 'rotated conductor'
    secondRole.parameters['electrical.conductivity'].value.referenceBasis = [
      [0, 1, 0],
      [-1, 0, 0],
      [0, 0, 1],
    ]
    conflictingMaterialBasis.materials.push(secondRole)
    expect(() => new SolverRegistry([moduleFor(conflictingMaterialBasis as unknown as SolverSpec)])).toThrow(
      'must use one referenceBasis per Solver spec',
    )

    const conflictingMaterialUnit = structuredClone(dcCurrentDensitySpec) as unknown as {
      materials: Array<{
        role: string
        parameters: {
          'electrical.conductivity': { value: { referenceUnit: string } }
        }
      }>
    }
    const centimeterRole = structuredClone(conflictingMaterialUnit.materials[0])
    centimeterRole.role = 'centimeter conductor'
    centimeterRole.parameters['electrical.conductivity'].value.referenceUnit = 'S.cm-1'
    conflictingMaterialUnit.materials.push(centimeterRole)
    expect(() => new SolverRegistry([moduleFor(conflictingMaterialUnit as unknown as SolverSpec)])).toThrow(
      'must use one referenceUnit per Solver spec',
    )

    const localMaterialKey = structuredClone(dcCurrentDensitySpec) as unknown as {
      materials: Array<{ parameters: Record<string, unknown> }>
    }
    localMaterialKey.materials[0].parameters.electricalConductivity =
      localMaterialKey.materials[0].parameters['electrical.conductivity']
    delete localMaterialKey.materials[0].parameters['electrical.conductivity']
    expect(() => new SolverRegistry([moduleFor(localMaterialKey as unknown as SolverSpec)])).toThrow(
      'is not a registered Material catalog key',
    )

    const duplicateQuantityKind = structuredClone(dcCurrentDensitySpec) as unknown as {
      materials: Array<{
        parameters: { 'electrical.conductivity': { value: { quantityKind?: string } } }
      }>
    }
    duplicateQuantityKind.materials[0].parameters['electrical.conductivity'].value.quantityKind =
      'electromagnetism.ElectricConductivity'
    expect(() => new SolverRegistry([moduleFor(duplicateQuantityKind as unknown as SolverSpec)])).toThrow(
      'quantityKind is derived from Material catalog key electrical.conductivity',
    )

    const materialAxes = structuredClone(dcCurrentDensitySpec) as unknown as {
      materials: Array<{ parameters: { 'electrical.conductivity': { value: { axes?: unknown[] } } } }>
    }
    materialAxes.materials[0].parameters['electrical.conductivity'].value.axes = [{ length: 1 }]
    expect(() => new SolverRegistry([moduleFor(materialAxes as unknown as SolverSpec)])).toThrow(
      'axes is forbidden for a Material property',
    )

    const scalarReferenceBasis = structuredClone(dcCurrentDensitySpec) as unknown as {
      parameters: { relativeTolerance: { value: { referenceBasis?: unknown } } }
    }
    scalarReferenceBasis.parameters.relativeTolerance.value.referenceBasis = identityCartesianBasis
    expect(() => new SolverRegistry([moduleFor(scalarReferenceBasis as unknown as SolverSpec)])).toThrow(
      'referenceBasis is forbidden for scalar Quantity Kind DimensionlessRatio',
    )

    const obsoleteDimension = structuredClone(dcCurrentDensitySpec) as unknown as {
      methods: { initializations: Array<{ parameters: { gridShape: { value: { sampleDimension?: number } } } }> }
    }
    obsoleteDimension.methods.initializations[0].parameters.gridShape.value.sampleDimension = 1
    expect(() => new SolverRegistry([moduleFor(obsoleteDimension as unknown as SolverSpec)])).toThrow(
      'sampleDimension is obsolete in the dtype/axes contract',
    )
  })
})

import type { SolverSpec, SolverTargetSpec } from '../../spec'

const oneStructureGeometry = Object.freeze({
  source: 'structure',
  kind: 'geometry',
  minimumTargets: 1,
  maximumTargets: 1,
  minimumResolved: 1,
  maximumResolved: 1,
} as const satisfies SolverTargetSpec)

const oneStructureSurface = Object.freeze({
  source: 'structure',
  kind: 'surface',
  minimumTargets: 1,
  maximumTargets: 1,
  minimumResolved: 1,
  maximumResolved: 1,
} as const satisfies SolverTargetSpec)

const crossSectionPosition = Object.freeze({
  description: 'Normalized axial position of the sampled cross-section.',
  value: {
    type: 'float',
    quantityKind: 'DimensionlessRatio',
    referenceUnit: '{fraction}',
    minimum: 0,
    maximum: 1,
    exclusiveMinimum: true,
    exclusiveMaximum: true,
  },
} as const)

export const dcCurrentDensitySpec = Object.freeze({
  name: 'dc-current-density',
  version: '1.0.0',
  description: 'Solves steady-state electric potential, current density, and total current in one homogeneous conductor.',
  parameters: {
    relativeTolerance: {
      description: 'Relative convergence tolerance for the preconditioned conjugate-gradient solve.',
      value: {
        type: 'float',
        quantityKind: 'DimensionlessRatio',
        referenceUnit: '{fraction}',
        minimum: 0,
        maximum: 1,
        exclusiveMinimum: true,
        exclusiveMaximum: true,
      },
    },
    maxIterations: {
      description: 'Maximum number of solver iterations.',
      value: { type: 'integer', minimum: 1 },
    },
  },
  materials: [
    {
      role: 'conductor',
      description: 'The homogeneous isotropic conductor targeted by dc.voxel-grid.',
      target: { category: 'initializations', methodId: 'dc.voxel-grid' },
      parameters: {
        electricalConductivity: {
          description: 'Positive scalar electrical conductivity.',
          value: {
            type: 'float',
            quantityKind: 'ElectricConductivity',
            referenceUnit: 'S.m-1',
            minimum: 0,
            exclusiveMinimum: true,
          },
        },
      },
    },
  ],
  methods: {
    initializations: [
      {
        methodId: 'dc.voxel-grid',
        description: 'Defines the cell-centered conductor voxel grid in axial, u, and v order.',
        minimumOccurrences: 1,
        maximumOccurrences: 1,
        target: oneStructureGeometry,
        parameters: {
          gridShape: {
            description: 'Number of cells along the s, u, and v grid axes.',
            value: {
              type: 'tensor',
              dimension: 1,
              shape: [3],
              dtype: 'int32',
              axes: [{ name: 'grid axis', ticks: ['s', 'u', 'v'] }],
              element: { minimum: 3 },
            },
          },
        },
      },
    ],
    boundaryConditions: [
      {
        methodId: 'dc.source-potential',
        description: 'Applies the source terminal electric potential.',
        minimumOccurrences: 1,
        maximumOccurrences: 1,
        target: oneStructureSurface,
        parameters: {
          voltage: {
            description: 'Source terminal electric potential.',
            value: { type: 'float', quantityKind: 'Voltage', referenceUnit: 'V' },
          },
        },
      },
      {
        methodId: 'dc.reference-potential',
        description: 'Applies the reference terminal electric potential.',
        minimumOccurrences: 1,
        maximumOccurrences: 1,
        target: oneStructureSurface,
        parameters: {
          voltage: {
            description: 'Reference terminal electric potential.',
            value: { type: 'float', quantityKind: 'Voltage', referenceUnit: 'V' },
          },
        },
      },
    ],
    recordedData: [
      {
        methodId: 'dc.current-density',
        description: 'Records a two-dimensional current-density cross-section.',
        minimumOccurrences: 1,
        maximumOccurrences: 1,
        target: oneStructureGeometry,
        parameters: { crossSectionPosition },
        result: {
          type: 'tensor',
          dimension: 2,
          shape: [-1, -1],
          dtype: 'float64',
          quantityKind: 'ElectricCurrentDensity',
          referenceUnit: 'A.m-2',
          axes: [
            { name: 'cross-section v', quantityKind: 'Length', referenceUnit: 'm' },
            { name: 'cross-section u', quantityKind: 'Length', referenceUnit: 'm' },
          ],
        },
      },
      {
        methodId: 'dc.total-current',
        description: 'Records the absolute current integrated over the same cross-section.',
        minimumOccurrences: 1,
        maximumOccurrences: 1,
        target: oneStructureGeometry,
        parameters: { crossSectionPosition },
        result: {
          type: 'tensor',
          dimension: 0,
          shape: [],
          dtype: 'float64',
          quantityKind: 'ElectricCurrent',
          referenceUnit: 'A',
          axes: [],
        },
      },
    ],
  },
} as const satisfies SolverSpec)

import { dcUniformBarStructureCode } from './dcUniformBar'
import type { CaembleProgramExample } from './types'

export const dcResolutionStudyExperimentCode = `import { defineTask, experiment } from '@caemble/core/v3'
import { dcCurrentDensity } from '@caemble/kernels/v1'

function currentTask(
  gridShape: readonly [number, number, number],
  outputKey: string,
) {
  return defineTask(dcCurrentDensity, ({ vars }) => ({
    parameters: {
      relativeTolerance: {
        dtype: 'float64',
        value: 1e-10,
        unit: '{fraction}',
        quantityKind: 'DimensionlessRatio',
      },
      maxIterations: 1000,
    },

    initializations: [
      {
        target: ['structure.geometry.conductor'],
        methodId: 'dc.voxel-grid',
        parameters: {
          gridShape: {
            dtype: 'int32',
            axes: [{ length: 3 }],
            value: gridShape,
          },
        },
      },
    ],

    boundaryConditions: [
      {
        target: ['structure.surface.sourceTerminal'],
        methodId: 'dc.source-potential',
        parameters: {
          voltage: {
            dtype: 'float64',
            value: vars.sourceVoltage,
            unit: 'mV',
            quantityKind: 'electromagnetism.Voltage',
          },
        },
      },
      {
        target: ['structure.surface.referenceTerminal'],
        methodId: 'dc.reference-potential',
        parameters: {
          voltage: {
            dtype: 'float64',
            value: 0,
            unit: 'mV',
            quantityKind: 'electromagnetism.Voltage',
          },
        },
      },
    ],

    recordedData: [
      {
        key: outputKey,
        target: ['structure.geometry.conductor'],
        methodId: 'dc.total-current',
        parameters: {
          crossSectionPosition: {
            dtype: 'float64',
            value: 0.5,
            unit: '{fraction}',
            quantityKind: 'DimensionlessRatio',
          },
        },
      },
    ],
  }))
}

const solveCoarse = currentTask([10, 7, 7], 'coarseTotalCurrent')
const solveFine = currentTask([20, 11, 11], 'fineTotalCurrent')

function ConvergenceProbe() {
  return <box size={[2, 2, 2]} />
}

export default experiment({
  lengthUnit: 'mm',

  varsSchema: {
    sourceVoltage: { min: 1, max: 1 },
  },

  geometry: () => <ConvergenceProbe id="convergence-probe" pos={[0, -10, 0]} />,

  tasks: {
    solveCoarse,
    solveFine,
  },

  outputs: {
    coarseTotalCurrent: {
      dtype: 'float64',
      unit: 'A',
      quantityKind: 'electromagnetism.ElectricCurrent',
    },
    fineTotalCurrent: {
      dtype: 'float64',
      unit: 'A',
      quantityKind: 'electromagnetism.ElectricCurrent',
    },
  },

  simulate: async ({ sim, tasks, initialState }) => {
    const coarse = await sim.run(tasks.solveCoarse, {
      state: initialState,
    })
    sim.record('coarseTotalCurrent', coarse.artifacts.coarseTotalCurrent)

    const fine = await sim.run(tasks.solveFine, {
      state: coarse.state,
    })
    sim.record('fineTotalCurrent', fine.artifacts.fineTotalCurrent)

    return fine.state
  },
})
`

export const dcResolutionStudyExample = Object.freeze({
  id: 'dc-resolution-study',
  title: 'DC Resolution Study',
  description: '같은 물리 문제를 coarse/fine task로 연속 실행해 named task orchestration을 확인합니다.',
  concepts: Object.freeze([
    '재사용 가능한 task factory',
    '이전 result.state를 다음 sim.run()에 전달',
    '여러 task의 output과 trace 비교',
  ]),
  structureCode: dcUniformBarStructureCode,
  experimentCode: dcResolutionStudyExperimentCode,
  verification: Object.freeze({
    kernelTasks: Object.freeze(['solveCoarse', 'solveFine']),
    outputs: Object.freeze(['coarseTotalCurrent', 'fineTotalCurrent']),
    expectations: Object.freeze([
      'trace 순서 = solveCoarse → solveFine',
      'state revision = 0 → 1 → 2',
      '두 total current 모두 14.9 A ± 1e-6',
    ]),
  }),
}) satisfies CaembleProgramExample

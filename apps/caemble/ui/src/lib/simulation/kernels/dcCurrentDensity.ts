import { SolverController } from '../../solver'
import { dcCurrentDensitySolver } from '../../solver/modules/dcCurrentDensity'
import type {
  EvaluatedExperimentRules,
  ExperimentTarget,
  RecordedDataResult,
  RecordedDataRule,
} from '../../cad/model/descriptor'
import type { BuiltSetupV2 } from '../../cad/execution/realization'
import { identityCartesianBasis } from '../../quantitykind/identityBasis'
import { SimulationKernelErrorV3 } from '../errors'
import { kernelRefV3 } from '../authoring'
import type {
  DcCurrentDensityArtifactsV3,
  DcCurrentDensityTaskConfigV3,
  KernelModuleV3,
  KernelRefV3,
  SimulationOutputSpecV3,
} from '../types'

export const dcCurrentDensityKernelRef = kernelRefV3<DcCurrentDensityTaskConfigV3>(
  'dc-current-density',
  '0.0.0',
) as KernelRefV3<DcCurrentDensityTaskConfigV3, DcCurrentDensityArtifactsV3>

function recordedResult(
  key: string,
  explicit: RecordedDataResult | undefined,
  outputs: Readonly<Record<string, SimulationOutputSpecV3>>,
): RecordedDataResult {
  if (explicit) return explicit
  const output = outputs[key]
  if (!output) {
    throw new SimulationKernelErrorV3(
      'input',
      dcCurrentDensityKernelRef,
      `DC task recordedData key "${key}" must reference a declared Experiment output.`,
    )
  }
  return Object.freeze({
    dtype: output.dtype,
    ...(output.unit === undefined ? {} : { unit: output.unit }),
    ...(output.quantityKind === undefined ? {} : { quantityKind: output.quantityKind }),
    ...(output.basis === undefined ? {} : { basis: output.basis }),
    ...(output.axes === undefined
      ? {}
      : {
          axes: Object.freeze(output.axes.map((axis) => Object.freeze({
            ...(axis.length === undefined ? {} : { length: axis.length }),
            ...(axis.name === undefined ? {} : { name: axis.name }),
            ...(axis.ticks === undefined ? {} : { ticks: axis.ticks }),
            ...(axis.unit === undefined ? {} : { unit: axis.unit }),
            ...(axis.quantityKind === undefined ? {} : { quantityKind: axis.quantityKind }),
          }))),
        }),
  }) as RecordedDataResult
}

export const dcCurrentDensityKernel: KernelModuleV3 = Object.freeze({
  ref: dcCurrentDensityKernelRef,
  async execute(input, signal) {
    if (signal.aborted) {
      throw new SimulationKernelErrorV3('resource', dcCurrentDensityKernelRef, 'Simulation run was cancelled.')
    }
    const config = input.config as DcCurrentDensityTaskConfigV3
    const labels = new Map<string, string>()
    const recordedData = config.recordedData.map((rule): RecordedDataRule => {
      const label = rule.label?.trim() || rule.key
      if (labels.has(rule.key)) {
        throw new SimulationKernelErrorV3(
          'input',
          dcCurrentDensityKernelRef,
          `DC task recordedData key "${rule.key}" is duplicated.`,
        )
      }
      labels.set(rule.key, label)
      return Object.freeze({
        target: rule.target,
        methodId: rule.methodId,
        parameters: rule.parameters,
        label,
        result: recordedResult(rule.key, rule.result, input.outputs),
      })
    })
    const requestedMethods = new Set(recordedData.map((rule) => rule.methodId))
    const fallbackTarget = config.initializations.flatMap((rule) => rule.target).find(
      (target) => target.startsWith('structure.geometry.'),
    ) as ExperimentTarget | undefined
    if (!fallbackTarget) {
      throw new SimulationKernelErrorV3(
        'input',
        dcCurrentDensityKernelRef,
        'DC task requires a structure geometry target for its result requests.',
      )
    }
    if (!requestedMethods.has('dc.current-density')) {
      recordedData.push(Object.freeze({
        target: Object.freeze([fallbackTarget]),
        label: '__caemble_bridge_current_density',
        methodId: 'dc.current-density',
        parameters: Object.freeze({
          crossSectionPosition: Object.freeze({
            dtype: 'float64',
            value: 0.5,
            unit: '{fraction}',
            quantityKind: 'DimensionlessRatio',
          }),
        }),
        result: Object.freeze({
          dtype: 'float64',
          unit: 'A.m-2',
          quantityKind: 'electromagnetism.ElectricCurrentDensity',
          basis: identityCartesianBasis,
          axes: Object.freeze([
            Object.freeze({ name: 'cross-section v', unit: 'm', quantityKind: 'Length' }),
            Object.freeze({ name: 'cross-section u', unit: 'm', quantityKind: 'Length' }),
          ]),
        }),
      }))
    }
    if (!requestedMethods.has('dc.total-current')) {
      recordedData.push(Object.freeze({
        target: Object.freeze([fallbackTarget]),
        label: '__caemble_bridge_total_current',
        methodId: 'dc.total-current',
        parameters: Object.freeze({
          crossSectionPosition: Object.freeze({
            dtype: 'float64',
            value: 0.5,
            unit: '{fraction}',
            quantityKind: 'DimensionlessRatio',
          }),
        }),
        result: Object.freeze({
          dtype: 'float64',
          unit: 'A',
          quantityKind: 'electromagnetism.ElectricCurrent',
        }),
      }))
    }
    const rules: EvaluatedExperimentRules = Object.freeze({
      initializations: Object.freeze(config.initializations.map((rule) => Object.freeze({
        ...rule,
        label: rule.label?.trim() || rule.methodId,
      }))),
      boundaryConditions: Object.freeze(config.boundaryConditions.map((rule) => Object.freeze({
        ...rule,
        label: rule.label?.trim() || rule.methodId,
      }))),
      recordedData: Object.freeze(recordedData),
    })
    const baseSnapshot = { ...input.setup.experiment }
    delete baseSnapshot.simulationProgram
    delete baseSnapshot.experimentRules
    delete baseSnapshot.solver
    const setup: BuiltSetupV2 = Object.freeze({
      ...input.setup,
      experiment: Object.freeze({
        ...baseSnapshot,
        experimentRules: rules,
        solver: Object.freeze({
          name: dcCurrentDensityKernelRef.name,
          version: dcCurrentDensityKernelRef.version,
          parameters: config.parameters,
        }),
      }),
    })

    try {
      const result = await new SolverController([dcCurrentDensitySolver]).run(
        input.sample,
        setup,
        `${input.runId}:dc-current-density`,
      )
      return Object.freeze({
        artifacts: Object.freeze(Object.fromEntries(
          [...labels].map(([key, label]) => [key, result[label]]),
        )),
      })
    } catch (error) {
      throw new SimulationKernelErrorV3(
        error instanceof Error && /converg/i.test(error.message) ? 'convergence' : 'input',
        dcCurrentDensityKernelRef,
        error instanceof Error ? error.message : String(error),
      )
    }
  },
})

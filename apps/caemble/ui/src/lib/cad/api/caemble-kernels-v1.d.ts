// @caemble/kernels/v1 declaration version: 0.0.0
import type {
  ArtifactRef,
  KernelRef,
  KernelTask,
  SimulationObservation,
  SimulationWorld,
} from '@caemble/core/v3'
import type {
  DcCurrentDensityBoundaryConditionsRule,
  DcCurrentDensityInitializationsRule,
  DcCurrentDensityOptions,
  DcCurrentDensityRecordedDataRule,
  Tensor,
} from '@caemble/core/v2'

type OptionalLabel<Rule> = Rule extends unknown
  ? Omit<Rule, 'label'> & Readonly<{ label?: string }>
  : never

type RequestedResult<Rule> = Rule extends Readonly<{ result: infer Result }>
  ? Omit<Rule, 'label' | 'result'> & Readonly<{
      key: string
      label?: string
      result?: Result
    }>
  : never

type DcCurrentDensityParameters = ReturnType<
  DcCurrentDensityOptions<Readonly<Record<never, never>>>['solver']['parameters']
>

export type DcCurrentDensityTaskConfig = Readonly<{
  parameters: DcCurrentDensityParameters
  initializations: readonly OptionalLabel<DcCurrentDensityInitializationsRule>[]
  boundaryConditions: readonly OptionalLabel<DcCurrentDensityBoundaryConditionsRule>[]
  recordedData: readonly RequestedResult<DcCurrentDensityRecordedDataRule>[]
}>

export declare const dcCurrentDensity: KernelRef<
  DcCurrentDensityTaskConfig,
  Readonly<Record<string, ArtifactRef>>,
  Readonly<Record<string, SimulationObservation>>
>

declare module '@caemble/core/v3' {
  export function defineTask(
    kernel: typeof dcCurrentDensity,
    configure: (context: Readonly<{
      vars: Readonly<Record<string, Tensor>>
      world: SimulationWorld
    }>) => DcCurrentDensityTaskConfig,
  ): KernelTask<
    DcCurrentDensityTaskConfig,
    Readonly<Record<string, ArtifactRef>>,
    Readonly<Record<string, SimulationObservation>>
  >
}

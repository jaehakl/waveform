import type {
  DefinedKernelTaskV3,
  KernelRefV3,
  SimulationObservationV3,
  SimulationProgramManifestV3,
  SimulationOutputSpecV3,
} from './types'

export function kernelRefV3<TConfig = unknown>(name: string, version: string): KernelRefV3<TConfig> {
  if (!name.trim() || !version.trim()) throw new Error('Kernel name and version must be non-empty.')
  return Object.freeze({
    kind: 'caemble-kernel-ref-v3' as const,
    name: name.trim(),
    version: version.trim(),
  }) as KernelRefV3<TConfig>
}

export function defineTask<
  TConfig,
  TArtifacts extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>,
  TObservations extends Readonly<Record<string, SimulationObservationV3>> = Readonly<
    Record<string, SimulationObservationV3>
  >,
>(
  kernel: KernelRefV3<TConfig, TArtifacts, TObservations>,
  configure: (context: Parameters<DefinedKernelTaskV3<TConfig, TArtifacts, TObservations>['configure']>[0]) =>
    NoInfer<TConfig>,
): DefinedKernelTaskV3<TConfig, TArtifacts, TObservations> {
  if (kernel.kind !== 'caemble-kernel-ref-v3') throw new Error('defineTask requires a kernel capability reference.')
  if (typeof configure !== 'function') throw new Error('defineTask configure must be a function.')
  return Object.freeze({
    kind: 'caemble-kernel-task-v3' as const,
    kernel,
    configure,
  })
}

export function simulationProgramManifestV3(
  tasks: Readonly<Record<string, DefinedKernelTaskV3>>,
  outputs: Readonly<Record<string, SimulationOutputSpecV3>>,
): SimulationProgramManifestV3 {
  return Object.freeze({
    version: 3 as const,
    tasks: Object.freeze(Object.fromEntries(Object.entries(tasks).map(([name, task]) => [
      name,
      Object.freeze({ name: task.kernel.name, version: task.kernel.version }),
    ]))),
    outputs: Object.freeze({ ...outputs }),
  })
}

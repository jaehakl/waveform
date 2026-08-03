import { SimulationKernelErrorV3 } from './errors'
import type { KernelModuleV3, KernelRefV3 } from './types'

export class KernelRegistryV3 {
  private readonly modules = new Map<string, Map<string, KernelModuleV3>>()

  constructor(modules: readonly KernelModuleV3[]) {
    modules.forEach((module) => {
      const { name, version } = module.ref
      if (!name.trim() || !version.trim() || module.ref.kind !== 'caemble-kernel-ref-v3') {
        throw new Error('Kernel modules require a valid capability reference.')
      }
      const versions = this.modules.get(name) ?? new Map<string, KernelModuleV3>()
      if (versions.has(version)) throw new Error(`Kernel ${name}@${version} is registered more than once.`)
      versions.set(version, Object.freeze(module))
      this.modules.set(name, versions)
    })
  }

  get(ref: KernelRefV3) {
    return this.modules.get(ref.name)?.get(ref.version)
  }

  require(ref: KernelRefV3) {
    const module = this.get(ref)
    if (module) return module
    throw new SimulationKernelErrorV3(
      'backend',
      { name: ref.name, version: ref.version },
      `No kernel module is registered for ${ref.name}@${ref.version}.`,
    )
  }
}


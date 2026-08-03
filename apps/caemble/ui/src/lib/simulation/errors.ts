export type SimulationKernelErrorKind = 'input' | 'convergence' | 'backend' | 'resource'

export class SimulationKernelErrorV3 extends Error {
  readonly kind: SimulationKernelErrorKind
  readonly kernel: Readonly<{ name: string; version: string }>

  constructor(
    kind: SimulationKernelErrorKind,
    kernel: Readonly<{ name: string; version: string }>,
    message: string,
  ) {
    super(message)
    this.name = 'SimulationKernelErrorV3'
    this.kind = kind
    this.kernel = kernel
  }
}

export class SimulationFatalErrorV3 extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SimulationFatalErrorV3'
  }
}


import type { SolverModule } from '../../types'
import { solveDcCurrentDensity } from './solve'
import { dcCurrentDensitySpec } from './spec'

export { dcCurrentDensitySpec } from './spec'

export const dcCurrentDensitySolver = Object.freeze({
  spec: dcCurrentDensitySpec,
  solve: solveDcCurrentDensity,
}) satisfies SolverModule

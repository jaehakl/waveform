import { dcCurrentDensity, dcCurrentDensityKernel } from './dcCurrentDensity'

export {
  dcCurrentDensity,
  dcCurrentDensityDescriptor,
  dcCurrentDensityKernel,
  dcCurrentDensityKernelRef,
} from './dcCurrentDensity'

export type {
  DcArtifactTypes,
  DcCurrentDensityBoundaryCondition,
  DcCurrentDensityInitialization,
  DcCurrentDensityOutputRequest,
  DcCurrentDensityTaskConfig,
  PreparedDcInput,
  ResolvedSurface,
} from './dcCurrentDensity'

const productionKernelCatalog = Object.freeze([
  Object.freeze({
    authoringName: 'dcCurrentDensity',
    builder: dcCurrentDensity,
    definition: dcCurrentDensityKernel,
  }),
])

export const kernelModules = Object.freeze(productionKernelCatalog.map(({ definition }) => definition))

export const kernelAuthoring = Object.freeze(
  Object.fromEntries(productionKernelCatalog.map(({ authoringName, builder }) => [authoringName, builder])),
)

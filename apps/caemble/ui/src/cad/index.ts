export { evaluateCad, evaluateCadScene } from './evaluation/evaluator'
export { Fragment, h } from './evaluation/jsx'
export type { CadScene, CadScenePart, CadSceneSurface, CadSceneTreeNode } from './evaluation/types'
export {
  CadModelError,
  evaluateWithVars,
  Material,
  Sample,
  Structure,
  vars,
} from './model/core'
export type { Geometry, GeometryAttributes } from './model/core'
export type { Rotation, Tensor, Vars, Vec3 } from './model/types'
export type { ArrayAttributes } from './elements/operations/array/definition'
export type { ShellAttributes } from './elements/operations/shell/definition'
export type { BoxAttributes } from './elements/primitives/box/definition'
export type { CylinderAttributes } from './elements/primitives/cylinder/definition'
export type {
  CurvedEdgeCylinderAttributes,
  CurvedEdgeCylinderFourierMode,
  CurvedEdgeCylinderTaylorCurve,
} from './elements/primitives/curvedEdgeCylinder/definition'
export type {
  CurvedSurfaceSphereAttributes,
  CurvedSurfaceSphereFourierMode,
} from './elements/primitives/curvedSurfaceSphere/definition'
export type { FiberAttributes, FiberFourierMode, FiberHelix } from './elements/primitives/fiber/definition'
export type { SphereAttributes } from './elements/primitives/sphere/definition'
export type { CadWorkerErrorType, CadWorkerRequest, CadWorkerResponse } from './worker/protocol'

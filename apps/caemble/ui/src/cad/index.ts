export { evaluateCad } from './evaluation/evaluator'
export { Fragment, h } from './evaluation/jsx'
export type { CadScenePart } from './evaluation/types'
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
export type { ArrayAttributes } from './elements/array/definition'
export type { BoxAttributes } from './elements/box/definition'
export type { CylinderAttributes } from './elements/cylinder/definition'
export type {
  CurvedEdgeCylinderAttributes,
  CurvedEdgeCylinderFourierMode,
  CurvedEdgeCylinderTaylorCurve,
} from './elements/curvedEdgeCylinder/definition'
export type {
  CurvedSurfaceSphereAttributes,
  CurvedSurfaceSphereFourierMode,
} from './elements/curvedSurfaceSphere/definition'
export type { FiberAttributes, FiberFourierMode, FiberHelix } from './elements/fiber/definition'
export type { SphereAttributes } from './elements/sphere/definition'
export type { CadWorkerErrorType, CadWorkerRequest, CadWorkerResponse } from './worker/protocol'

export { evaluateCad, evaluateCadScene } from './evaluation/evaluator'
export { resolveCadSceneSelection } from './evaluation/selection'
export { applyCadSceneGroups } from './evaluation/groups'
export { Fragment, h } from './evaluation/jsx'
export type {
  CadScene,
  CadSceneGroup,
  CadSceneMaterial,
  CadScenePart,
  CadSceneSelection,
  CadSceneSurface,
  CadSceneTreeNode,
} from './evaluation/types'
export {
  CadModelError,
  evaluateWithVars,
  Experiment,
  Mat,
  Material,
  Sample,
  Setup,
  Structure,
  VariableObject,
  isFloatDType,
  vars,
} from './model/core'
export { assertUcumUnitComparable, convertUcumValue, normalizeUcumUnit } from './model/units'
export type {
  CartesianBasis,
  DataAxis,
  DataDType,
  DataValueDescriptor,
  EvaluatedExperimentRules,
  FloatDataDType,
  ExperimentParameter,
  ExperimentParameters,
  ExperimentRule,
  ExperimentSolver,
  ExperimentTarget,
  Geometry,
  GeometryAttributes,
  IntegerDataDType,
  MaterialDataValueDescriptor,
  MaterialVariable,
  MaterialVariables,
  MatrixValue,
  NonFloatDataDType,
  QuantityKindName,
  QuantityMetadata,
  ScalarQuantityKindName,
  TensorQuantityKindName,
  RecordedData,
  RecordedDataAxis,
  RecordedDataResult,
  RecordedDataResultAxis,
  RecordedDataRule,
  RecordedDataTensor,
  ResolvedExperimentSolver,
  ResolvedMaterialVariables,
  SolverParameters,
  SolverParameterValue,
  ScalarValue,
  StructureGroupMap,
  VarsSchemaEntry,
} from './model/core'
export type { UcumUnit } from './model/units'
export type { Rotation, Tensor, Vars, Vec3 } from './model/types'
export { normalizeRecordedData, normalizeRecordedDataTensor } from './model/recordedData'
export type { ResolvedRecordedTensor } from './model/recordedData'
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
export type { CadDocumentType, CadWorkerErrorType, CadWorkerRequest, CadWorkerResponse } from './worker/protocol'

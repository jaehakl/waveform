export { evaluateCad, evaluateCadScene } from './evaluation/evaluator'
export { cadElementCatalog } from './catalog'
export { resolveCadSceneSelection } from './evaluation/selection'
export { resolveCadSceneDraftSelection } from './evaluation/selection'
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
  Mat,
  Material,
  isFloatDType,
} from './model/core'
export {
  experiment,
  ExperimentDefinitionV2,
  structure,
  StructureDefinitionV2,
} from './model/v2'
export type {
  CadDefinitionV2,
  ExperimentDefinitionOptions,
  ExternalVars,
  InferVars,
  ModelContext,
  StructureDefinitionOptions,
  VarsSchemaDefinition,
} from './model/v2'
export { assertUcumUnitComparable, convertUcumValue, normalizeUcumUnit } from './model/units'
export { normalizeDataValueDescriptor } from './model/core'
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
  MaterialQuantitySeries,
  MaterialSampledRelation,
  MaterialVariable,
  MaterialVariables,
  MatrixValue,
  NonFloatDataDType,
  NormalizedMaterialVariables,
  QuantityKindDomain,
  QuantityKindName,
  QuantityKindNameForDomain,
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
export { createSolidPointTester } from './geometry/solid'
export type { SolidPointTester } from './geometry/solid'
export type {
  MaterialCatalogKey,
  MaterialModelDefinition,
  MaterialModelDefinitionFor,
  MaterialModelKey,
  MaterialPropertyDefinition,
  MaterialPropertyDefinitionFor,
  MaterialPropertyKey,
  MaterialPropertyQuantityKind,
} from '../material/data'
export {
  CAD_SOURCE_API_VERSION,
  CAD_SOURCE_FORMAT_VERSION,
  MAX_CAD_SOURCE_BYTES,
  MAX_CAD_SOURCE_FILES,
  assertCadSourceDocumentV2,
  cadEntrySource,
  cadProjectHash,
  createCadSourceDocumentV2,
  createRealizationSeed,
  rerollCadSourceDocument,
  updateCadEntrySource,
} from './source/document'
export type { CadEvaluationInputV2, CadSourceDocumentV2 } from './source/document'
export {
  CadDocumentEvaluationErrorV2,
  evaluateDocument,
} from './execution/evaluateDocument'
export type { EvaluateDocumentOptionsV2 } from './execution/evaluateDocument'
export {
  assertEvaluatedDocumentSnapshotV2,
} from './execution/snapshot'
export type { EvaluatedDocumentSnapshotV2 } from './execution/snapshot'
export {
  assertSerializableCadScene,
  deserializeCadScene,
  serializeCadScene,
} from './execution/mesh'
export type { SerializableCadMesh, SerializableCadScene, SerializableCadScenePart } from './execution/mesh'
export {
  StaleCadSourcePatchError,
  applyCadSourcePatchV2,
  createCadSourcePatchV2,
} from './source/sourcePatch'
export type { CadSourcePatchV2, CadSourceTextEditV2 } from './source/sourcePatch'
export { migrateCadSourceV1ToV2 } from './source/codemodV2'
export type { CadV1CodemodIssue, CadV1CodemodResult } from './source/codemodV2'
export { normalizeRecordedData, normalizeRecordedDataTensor } from './model/recordedData'
export type { ResolvedRecordedTensor } from './model/recordedData'
export { CadCompilationError, compileCadDocument } from './compiler/monacoCompiler'
export { evaluateInIsolatedRunner } from './runner/client'
export { StructureGroupSyncError, updateModelGroupSource } from './source/structureGroups'
export type { StructureGroupProperty } from './source/structureGroups'
export {
  inspectExperimentTensorSource,
  updateExperimentTensorSource,
} from './source/experimentParameters'
export type { ExperimentRuleCategory } from './source/experimentParameters'
export type { ArrayAttributes } from './elements/operations/array/definition'
export type { BooleanAttributes } from './elements/operations/booleans/definition'
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
export type {
  CadDiagnosticV2,
  CadDocumentType,
  CadEvaluationRequestV2,
  CadEvaluationResponseV2,
  CadWorkerErrorType,
  CadWorkerRequest,
  CadWorkerResponse,
} from './worker/protocol'

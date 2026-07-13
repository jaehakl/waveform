import type { Material } from '../model/core'
import type { Rotation, Vec3 } from '../model/types'

export type GeometryComponent = (props: Record<string, unknown>) => unknown
export type CadElementType = string | GeometryComponent

export type CadNode = {
  type: CadElementType
  props: Record<string, unknown>
  children: unknown[]
}

export type EvaluatedPart = {
  geometry: unknown
  material: Material
}

export type CadScenePart = {
  geometry: unknown
  materialName: string
  displayColor: string
}

export type NormalizedTransforms = {
  pos: Vec3
  rotate: Rotation | undefined
  scale: Vec3
}

export type CadElementManifest<Tag extends string = string> = Readonly<{
  tag: Tag
  category: 'primitive' | 'pattern' | 'boolean' | 'modifier'
  syntax: string
  summary: string
}>

export type CadElementEvaluationContext = Readonly<{
  inheritedMaterials: readonly Material[] | undefined
  evaluate: (value: unknown, inheritedMaterials?: readonly Material[]) => EvaluatedPart[]
}>

export type PrimitiveElementDefinition<Tag extends string = string> = Readonly<{
  kind: 'primitive'
  tag: Tag
  manifest: CadElementManifest<Tag>
  createGeometry: (props: Record<string, unknown>) => unknown
}>

export type CompoundElementDefinition<Tag extends string = string> = Readonly<{
  kind: 'compound'
  tag: Tag
  manifest: CadElementManifest<Tag>
  evaluate: (node: CadNode, context: CadElementEvaluationContext) => EvaluatedPart[]
}>

export type CadElementDefinition<Tag extends string = string> =
  | PrimitiveElementDefinition<Tag>
  | CompoundElementDefinition<Tag>

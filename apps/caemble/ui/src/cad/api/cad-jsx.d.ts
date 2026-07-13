import type {
  ArrayAttributes,
  BoxAttributes,
  CylinderAttributes,
  CurvedEdgeCylinderAttributes,
  CurvedSurfaceSphereAttributes,
  FiberAttributes,
  Rotation,
  SphereAttributes,
  Tensor,
  Vec3,
} from './caemble-core'

declare global {
  const vars: Readonly<Record<string, Tensor>>
  function h(type: unknown, attributes: unknown, ...children: unknown[]): unknown
  const Fragment: unknown

  namespace JSX {
    interface IntrinsicElements {
      box: BoxAttributes
      cylinder: CylinderAttributes
      curvedEdgeCylinder: CurvedEdgeCylinderAttributes
      curvedSurfaceSphere: CurvedSurfaceSphereAttributes
      sphere: SphereAttributes
      fiber: FiberAttributes
      array: ArrayAttributes
      union: { pos?: Vec3; rotate?: Rotation; scale?: Vec3; children?: unknown }
      subtract: { pos?: Vec3; rotate?: Rotation; scale?: Vec3; children?: unknown }
      intersect: { pos?: Vec3; rotate?: Rotation; scale?: Vec3; children?: unknown }
    }
  }
}

export {}

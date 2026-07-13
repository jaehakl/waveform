export {}

declare global {
  type VarsTensor = number | readonly VarsTensor[]
  const vars: Readonly<Record<string, VarsTensor>>

  namespace JSX {
    type Vec3 = readonly [number, number, number]
    type Rotation = Readonly<{
      axis: Vec3
      angle: number
    }>

    interface IntrinsicElements {
      box: {
        size: Vec3
        pos?: Vec3
        rotate?: Rotation
        scale?: Vec3
      }

      cylinder: {
        radius: number
        height: number
        segments?: number
        pos?: Vec3
        rotate?: Rotation
        scale?: Vec3
      }

      sphere: {
        radius: number
        segments?: number
        pos?: Vec3
        rotate?: Rotation
        scale?: Vec3
      }

      array: {
        shape: readonly [number, number, number]
        period: Vec3
        axes?: Readonly<{
          x: Vec3
          y: Vec3
          z: Vec3
        }>
        inject?: Readonly<
          Record<
            string,
            | VarsTensor
            | Readonly<{
                axis: VarsTensor
                angle: VarsTensor
              }>
          >
        >
        pos?: Vec3
        rotate?: Rotation
        scale?: Vec3
        children?: unknown
      }

      union: {
        pos?: Vec3
        rotate?: Rotation
        scale?: Vec3
        children?: unknown
      }

      subtract: {
        pos?: Vec3
        rotate?: Rotation
        scale?: Vec3
        children?: unknown
      }

      intersect: {
        pos?: Vec3
        rotate?: Rotation
        scale?: Vec3
        children?: unknown
      }
    }
  }
}

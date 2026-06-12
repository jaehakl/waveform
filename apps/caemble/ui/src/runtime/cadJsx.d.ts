export {}

declare global {
  namespace JSX {
    type Vec3 = [number, number, number]

    interface IntrinsicElements {
      box: {
        size: Vec3
      }

      cylinder: {
        radius: number
        height: number
        segments?: number
      }

      sphere: {
        radius: number
        segments?: number
      }

      translate: {
        offset?: Vec3
        x?: number
        y?: number
        z?: number
        children?: unknown
      }

      rotate: {
        angles?: Vec3
        x?: number
        y?: number
        z?: number
        children?: unknown
      }

      scale: {
        factors?: Vec3
        x?: number
        y?: number
        z?: number
        children?: unknown
      }

      union: {
        children?: unknown
      }

      subtract: {
        children?: unknown
      }

      intersect: {
        children?: unknown
      }
    }
  }
}

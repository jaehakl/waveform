import { extrusions } from '@jscad/modeling'
import type { MutableVec3 } from '../../geometry/vec3'
import type { PrimitiveElementDefinition } from '../../evaluation/types'
import { fiberManifest, type FiberAttributes } from './definition'
import { sampleFiber } from './sampling'

const tau = Math.PI * 2

export function createFiberGeometry(attributes: FiberAttributes) {
  const sampled = sampleFiber(attributes)
  const slices = sampled.points.map((point, pathIndex) => {
    const frame = sampled.frames[pathIndex]
    const radius = sampled.radii[pathIndex]
    const ring = Array.from({ length: sampled.radialSegments }, (_, radialIndex) => {
      const angle = (tau * radialIndex) / sampled.radialSegments
      const normalScale = radius * Math.cos(angle)
      const binormalScale = radius * Math.sin(angle)
      return [
        point[0] + normalScale * frame.normal[0] + binormalScale * frame.binormal[0],
        point[1] + normalScale * frame.normal[1] + binormalScale * frame.binormal[1],
        point[2] + normalScale * frame.normal[2] + binormalScale * frame.binormal[2],
      ] as MutableVec3
    })
    return extrusions.slice.fromPoints(ring)
  })

  return extrusions.extrudeFromSlices({
    numberOfSlices: slices.length,
    capStart: true,
    capEnd: true,
    close: false,
    callback: (_progress, index, base) => (index === 0 ? base : slices[index]),
  }, slices[0])
}

export const fiberDefinition = {
  kind: 'primitive',
  tag: fiberManifest.tag,
  manifest: fiberManifest,
  createGeometry(props) {
    return createFiberGeometry(props as FiberAttributes)
  },
} satisfies PrimitiveElementDefinition<'fiber'>

import { primitives } from '@jscad/modeling'
import { CadModelError } from '../../../model/core'
import type { PrimitiveElementDefinition } from '../../../evaluation/types'
import { cylinderManifest } from './definition'

export const cylinderDefinition = {
  kind: 'primitive',
  tag: cylinderManifest.tag,
  manifest: cylinderManifest,
  createGeometry(props) {
    const radius = props.radius
    if (typeof radius !== 'number' || !Number.isFinite(radius) || radius < 0) {
      throw new CadModelError('<cylinder> radius must be a finite non-negative number.')
    }
    const radius_2 = props.radius_2 === undefined ? radius : props.radius_2
    if (typeof radius_2 !== 'number' || !Number.isFinite(radius_2) || radius_2 < 0) {
      throw new CadModelError('<cylinder> radius_2 must be a finite non-negative number.')
    }
    if (radius === 0 && radius_2 === 0) {
      throw new CadModelError('<cylinder> radius and radius_2 cannot both be zero.')
    }
    if (typeof props.height !== 'number' || !Number.isFinite(props.height) || props.height <= 0) {
      throw new CadModelError('<cylinder> height must be a finite positive number.')
    }
    const segments = props.segments === undefined ? 32 : props.segments
    if (!Number.isSafeInteger(segments) || (segments as number) < 4) {
      throw new CadModelError('<cylinder> segments must be a safe integer greater than or equal to 4.')
    }
    return primitives.cylinderElliptic({
      startRadius: [radius, radius],
      endRadius: [radius_2, radius_2],
      height: props.height,
      segments: segments as number,
    })
  },
} satisfies PrimitiveElementDefinition<'cylinder'>

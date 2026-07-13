import { primitives } from '@jscad/modeling'
import { CadModelError } from '../../model/core'
import type { PrimitiveElementDefinition } from '../../evaluation/types'
import { cylinderManifest } from './definition'

export const cylinderDefinition = {
  kind: 'primitive',
  tag: cylinderManifest.tag,
  manifest: cylinderManifest,
  createGeometry(props) {
    if (typeof props.radius !== 'number' || !Number.isFinite(props.radius) || props.radius <= 0) {
      throw new CadModelError('<cylinder> radius must be a finite positive number.')
    }
    if (typeof props.height !== 'number' || !Number.isFinite(props.height) || props.height <= 0) {
      throw new CadModelError('<cylinder> height must be a finite positive number.')
    }
    const segments = props.segments === undefined ? 32 : props.segments
    if (!Number.isSafeInteger(segments) || (segments as number) < 4) {
      throw new CadModelError('<cylinder> segments must be a safe integer greater than or equal to 4.')
    }
    return primitives.cylinder({ radius: props.radius, height: props.height, segments: segments as number })
  },
} satisfies PrimitiveElementDefinition<'cylinder'>

import { primitives } from '@jscad/modeling'
import { CadModelError } from '../../model/core'
import type { PrimitiveElementDefinition } from '../../evaluation/types'
import { boxManifest } from './definition'

export const boxDefinition = {
  kind: 'primitive',
  tag: boxManifest.tag,
  manifest: boxManifest,
  createGeometry(props) {
    if (
      !Array.isArray(props.size) ||
      props.size.length !== 3 ||
      props.size.some((value) => typeof value !== 'number' || !Number.isFinite(value) || value <= 0)
    ) {
      throw new CadModelError('<box> size must be an array of exactly three finite positive numbers.')
    }
    return primitives.cuboid({ size: [props.size[0], props.size[1], props.size[2]] })
  },
} satisfies PrimitiveElementDefinition<'box'>

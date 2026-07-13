import type { Rotation, Vec3 } from '../../model/types'
import type { CadElementManifest } from '../../evaluation/types'

export type CylinderAttributes = Readonly<{
  radius: number
  height: number
  segments?: number
  pos?: Vec3
  rotate?: Rotation
  scale?: Vec3
}>

export const cylinderManifest = {
  tag: 'cylinder',
  category: 'primitive',
  syntax: '<cylinder radius={r} height={h} segments={32} pos={[x,y,z]} />',
  summary: '원점 중심의 원기둥을 생성합니다.',
} as const satisfies CadElementManifest<'cylinder'>

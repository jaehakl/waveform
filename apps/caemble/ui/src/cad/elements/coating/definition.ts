import type { Rotation, Vec3 } from '../../model/types'
import type { CadElementManifest } from '../../evaluation/types'

export type CoatingAttributes = Readonly<{
  offsets: readonly number[]
  pos?: Vec3
  rotate?: Rotation
  scale?: Vec3
  children?: unknown
}>

export const coatingManifest = {
  tag: 'coating',
  category: 'modifier',
  syntax: '<coating offsets={[-inner, outer]}>Geometry</coating>',
  summary: '닫힌 Geometry의 signed offset 경계 사이에 다층 코팅 solid를 생성합니다.',
} as const satisfies CadElementManifest<'coating'>

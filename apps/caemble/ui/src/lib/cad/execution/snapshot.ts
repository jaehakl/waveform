import type { CadScene } from '../evaluation/types'
import { serializeCadScene } from './mesh'
import type { EvaluatedDocumentSnapshotV2 } from './snapshotValidation'

export {
  MAX_CAD_SNAPSHOT_TYPED_ARRAY_BYTES,
  assertEvaluatedDocumentSnapshotV2,
  assertPlainSnapshotValue,
} from './snapshotValidation'
export type { EvaluatedDocumentSnapshotV2 } from './snapshotValidation'

export type EvaluatedRuntimeDocumentSnapshotV2 = Readonly<
  Omit<EvaluatedDocumentSnapshotV2, 'scene'> & { scene: CadScene }
>

export function serializeEvaluatedDocumentSnapshotV2(
  snapshot: EvaluatedRuntimeDocumentSnapshotV2,
): EvaluatedDocumentSnapshotV2 {
  return Object.freeze({ ...snapshot, scene: serializeCadScene(snapshot.scene) })
}

import { dbTables, getListRequest } from '@/api'
import { deserializeCadScene, type EvaluatedDocumentSnapshotV2 } from '@/lib/cad'
import {
  readFrozenMaterialParameters,
  resolveMaterialParameters,
  sourceOnlyMaterialParameters,
  type MaterialResolution,
} from '@/lib/material'

export async function resolveDocumentMaterials(
  snapshot: EvaluatedDocumentSnapshotV2,
  storedSnapshot: unknown | null,
): Promise<MaterialResolution> {
  const scene = deserializeCadScene(snapshot.scene)
  const materials = scene.parts.flatMap((part) => (part.material ? [part.material] : []))

  if (storedSnapshot !== null) {
    if (
      typeof storedSnapshot === 'object' &&
      !Array.isArray(storedSnapshot) &&
      Object.keys(storedSnapshot).length === 0
    ) {
      return sourceOnlyMaterialParameters(materials)
    }
    const frozen = readFrozenMaterialParameters(storedSnapshot)
    if (!frozen) {
      throw new Error(
        `저장된 ${snapshot.kind === 'structure' ? 'Sample' : 'Setup'} Material snapshot이 올바르지 않습니다.`,
      )
    }
    return Object.freeze({ materialParameters: frozen, warnings: Object.freeze([]) })
  }

  const materialNames = [...new Set(materials.map((material) => material.name))]
  if (materialNames.length === 0) return resolveMaterialParameters([], [], [])

  const names = (
    await dbTables.MaterialName.listRows({
      ...getListRequest('visible'),
      limit: null,
      filter: { name: materialNames },
    })
  ).items
  const materialIds = [...new Set(names.map((row) => row.material_id))]
  if (materialIds.length === 0) return resolveMaterialParameters(materials, names, [], { seed: snapshot.seed })

  const [databaseMaterials, parameters] = await Promise.all([
    dbTables.Material.listRows({
      ...getListRequest('visible'),
      limit: null,
      filter: { id: materialIds },
    }),
    dbTables.MaterialParameter.listRows({
      ...getListRequest('visible'),
      limit: null,
      filter: { material_id: materialIds },
    }),
  ])
  return resolveMaterialParameters(materials, names, parameters.items, {
    materials: databaseMaterials.items,
    seed: snapshot.seed,
  })
}

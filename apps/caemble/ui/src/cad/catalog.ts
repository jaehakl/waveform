import { arrayManifest } from './elements/operations/array/definition'
import { intersectManifest, subtractManifest, unionManifest } from './elements/operations/booleans/definition'
import { shellManifest } from './elements/operations/shell/definition'
import { boxManifest } from './elements/primitives/box/definition'
import { cylinderManifest } from './elements/primitives/cylinder/definition'
import { curvedEdgeCylinderManifest } from './elements/primitives/curvedEdgeCylinder/definition'
import { curvedSurfaceSphereManifest } from './elements/primitives/curvedSurfaceSphere/definition'
import { fiberManifest } from './elements/primitives/fiber/definition'
import { sphereManifest } from './elements/primitives/sphere/definition'

export const cadElementCatalog = [
  boxManifest,
  cylinderManifest,
  curvedEdgeCylinderManifest,
  sphereManifest,
  curvedSurfaceSphereManifest,
  fiberManifest,
  shellManifest,
  arrayManifest,
  unionManifest,
  subtractManifest,
  intersectManifest,
] as const

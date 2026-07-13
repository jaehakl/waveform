import { arrayManifest } from './elements/array/definition'
import { boxManifest } from './elements/box/definition'
import { intersectManifest, subtractManifest, unionManifest } from './elements/booleans/definition'
import { cylinderManifest } from './elements/cylinder/definition'
import { fiberManifest } from './elements/fiber/definition'
import { sphereManifest } from './elements/sphere/definition'

export const cadElementCatalog = [
  boxManifest,
  cylinderManifest,
  sphereManifest,
  fiberManifest,
  arrayManifest,
  unionManifest,
  subtractManifest,
  intersectManifest,
] as const

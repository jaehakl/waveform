import { defaultCode } from '../defaultCode'
import { coatingCutawaysCode } from './coatingCutaways'
import { curvedEdgeCylinderArrayCode } from './curvedEdgeCylinderArray'
import { curvedSurfaceSphereHcpArrayCode } from './curvedSurfaceSphereHcpArray'

export type CaembleExample = Readonly<{
  id: string
  title: string
  description: string
  code: string
}>

export const caembleExamples: readonly CaembleExample[] = Object.freeze([
  {
    id: 'fiber-bundle',
    title: 'Fiber Bundle',
    description: 'Fourier modes and a curved path produce three tapered polymer fibers.',
    code: defaultCode,
  },
  {
    id: 'coating-cutaways',
    title: 'Coating Cutaways',
    description: 'One, two, and three colored coating layers on cutaway procedural geometries.',
    code: coatingCutawaysCode,
  },
  {
    id: 'random-curved-edge-cylinder-array',
    title: 'Random Curved Cylinder Array',
    description: 'A 4 × 4 array whose cells independently randomize their Fourier and Taylor curves.',
    code: curvedEdgeCylinderArrayCode,
  },
  {
    id: 'random-curved-surface-sphere-hcp-array',
    title: 'Random Curved Sphere HCP Array',
    description: 'Random curved spheres arranged on alternating layers of a hexagonal close-packed lattice.',
    code: curvedSurfaceSphereHcpArrayCode,
  },
])

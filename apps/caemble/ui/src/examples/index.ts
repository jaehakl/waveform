import { defaultCode } from '../defaultCode'
import { fiberBundleCode } from './fiberBundle'
import { shellCutawaysCode } from './shellCutaways'
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
    id: 'dc-conductor',
    title: 'DC Conductor',
    description: 'A copper bar with named conductor and terminal groups for the default DC solver example.',
    code: defaultCode,
  },
  {
    id: 'fiber-bundle',
    title: 'Fiber Bundle',
    description: 'Fourier modes and a curved path produce three tapered polymer fibers.',
    code: fiberBundleCode,
  },
  {
    id: 'shell-cutaways',
    title: 'Shell Cutaways',
    description: 'One, two, and three colored shell layers on cutaway procedural geometries.',
    code: shellCutawaysCode,
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

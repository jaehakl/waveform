import { describe, expect, it } from 'vitest'
import coreDeclarations from '../api/caemble-core.d.ts?raw'
import jsxDeclarations from '../api/cad-jsx.d.ts?raw'
import monacoSetupSource from '../../editor/monacoSetup.ts?raw'
import { cadElementCatalog } from '../catalog'
import * as cadFacade from '../index'
import { cadElementDefinitions, createCadElementRegistry } from './registry'
import type { CadElementDefinition } from './types'

describe('CAD registry contracts', () => {
  it('rejects duplicate tags at registry creation', () => {
    const duplicate = cadElementDefinitions[0] as CadElementDefinition
    expect(() => createCadElementRegistry([duplicate, duplicate])).toThrow('Duplicate CAD element tag: box')
  })

  it('keeps evaluation registry, catalog, and ambient JSX tags in sync', () => {
    const registryTags = cadElementDefinitions.map((definition) => definition.tag).sort()
    const catalogTags = cadElementCatalog.map((manifest) => manifest.tag).sort()
    const jsxTags = [...jsxDeclarations.matchAll(/^\s{6}(\w+):/gm)].map((match) => match[1]).sort()

    expect(catalogTags).toEqual(registryTags)
    expect(jsxTags).toEqual(registryTags)
    expect(new Set(cadElementCatalog.map((manifest) => manifest.category))).toEqual(
      new Set(['primitive', 'operation']),
    )
  })

  it('uses shared declaration files for public core types and Monaco', () => {
    for (const typeName of [
      'BoxAttributes',
      'ShellAttributes',
      'CylinderAttributes',
      'CurvedEdgeCylinderAttributes',
      'CurvedEdgeCylinderFourierMode',
      'CurvedEdgeCylinderTaylorCurve',
      'CurvedSurfaceSphereAttributes',
      'CurvedSurfaceSphereFourierMode',
      'SphereAttributes',
      'ArrayAttributes',
      'FiberAttributes',
    ]) {
      expect(coreDeclarations).toContain(`export type ${typeName}`)
    }
    expect(monacoSetupSource).toContain("import coreTypes from '../cad/api/caemble-core.d.ts?raw'")
    expect(monacoSetupSource).toContain("import jsxTypes from '../cad/api/cad-jsx.d.ts?raw'")
    expect(monacoSetupSource).toContain("'file:///node_modules/@caemble/core/index.d.ts'")
    expect(monacoSetupSource).not.toContain('const cadTypes')

    const cylinderDeclaration = coreDeclarations.match(/export type CylinderAttributes = Readonly<\{[\s\S]*?\n\}>/)?.[0]
    expect(cylinderDeclaration).toContain('radius_2?: number')

    const shellDeclaration = coreDeclarations.match(/export type ShellAttributes = Readonly<\{[\s\S]*?\n\}>/)?.[0]
    expect(shellDeclaration).toContain('offsets: readonly number[]')
    expect(shellDeclaration).not.toContain('depth')
    expect(jsxDeclarations).toContain('shell: ShellAttributes')
    expect(cadElementCatalog.find((element) => element.tag === 'shell')).toMatchObject({
      category: 'operation',
      syntax: '<shell offsets={[-inner, outer]}>Geometry</shell>',
    })
  })

  it('exposes model and evaluation APIs through the CAD facade', () => {
    expect(cadFacade).toMatchObject({
      CadModelError: expect.any(Function),
      Material: expect.any(Function),
      Sample: expect.any(Function),
      Structure: expect.any(Function),
      evaluateCad: expect.any(Function),
      h: expect.any(Function),
    })
  })
})

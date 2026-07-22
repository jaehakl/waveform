import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import { compiledCadSemanticHash } from './semanticHash'
import type { CompiledCadProjectV2 } from './types'
import { CAD_COMPILER_VERSION } from './types'

function project(code: string): CompiledCadProjectV2 {
  return {
    apiVersion: 2,
    compilerVersion: CAD_COMPILER_VERSION,
    entryFile: 'structure.tsx',
    modules: { 'structure.tsx': { code: `${code}\n//# sourceURL=caemble://${'a'.repeat(64)}/structure.tsx` } },
    sourceHash: 'a'.repeat(64),
  }
}

describe('compiledCadSemanticHash', () => {
  it('ignores emitted formatting, comments, raw quotes, parentheses, and semicolons', async () => {
    const first = await compiledCadSemanticHash(project(`const value = 'same';\nmodule.exports = (value);`))
    const second = await compiledCadSemanticHash(project(`// comment\nconst value="same"\nmodule.exports=value`))
    expect(second).toBe(first)
  })

  it('preserves identifiers, values, operators, and statement order', async () => {
    const base = await compiledCadSemanticHash(project('const value = 1; module.exports = value + 2;'))
    await expect(
      compiledCadSemanticHash(project('const renamed = 1; module.exports = renamed + 2;')),
    ).resolves.not.toBe(base)
    await expect(compiledCadSemanticHash(project('const value = 1; module.exports = value - 2;'))).resolves.not.toBe(
      base,
    )
    await expect(compiledCadSemanticHash(project('module.exports = value + 2; const value = 1;'))).resolves.not.toBe(
      base,
    )
  })

  it('ignores TypeScript-only declarations removed by emit', async () => {
    const emit = (source: string) =>
      ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
      }).outputText
    const typed = emit(`type Value = number
      const value: Value = 1
      export default value`)
    const plain = emit(`const value = 1
      export default value`)
    await expect(compiledCadSemanticHash(project(typed))).resolves.toBe(await compiledCadSemanticHash(project(plain)))
  })

  it('sorts module paths without changing statement or module contents', async () => {
    const first = project('module.exports = 1')
    const secondModule = { code: `module.exports = 2\n//# sourceURL=caemble://${'a'.repeat(64)}/helper.ts` }
    const ordered = { ...first, modules: { ...first.modules, 'helper.ts': secondModule } }
    const reversed = { ...first, modules: { 'helper.ts': secondModule, ...first.modules } }
    await expect(compiledCadSemanticHash(reversed)).resolves.toBe(await compiledCadSemanticHash(ordered))

    const changed = {
      ...first,
      modules: { ...first.modules, 'helper.ts': project('module.exports = 3').modules['structure.tsx'] },
    }
    await expect(compiledCadSemanticHash(changed)).resolves.not.toBe(await compiledCadSemanticHash(ordered))
  })
})

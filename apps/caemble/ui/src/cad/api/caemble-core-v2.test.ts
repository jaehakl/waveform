import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { defaultCode } from '../../defaultCode'
import { defaultExperimentCode } from '../../defaultExperimentCode'
import { caembleExamples } from '../../examples'
import coreTypes from './caemble-core.d.ts?raw'
import coreV2Types from './caemble-core-v2.d.ts?raw'
import jsxTypes from './cad-jsx.d.ts?raw'

function diagnosticsFor(source: string) {
  const sourcePath = 'C:/caemble-project/source.tsx'
  const virtualFiles = new Map<string, string>([
    [sourcePath, source],
    ['C:/node_modules/@caemble/core/index.d.ts', coreTypes],
    ['C:/node_modules/@caemble/core/v2/index.d.ts', coreV2Types],
    ['C:/node_modules/@caemble/core/v2/cad-jsx.d.ts', jsxTypes],
  ])
  const options: ts.CompilerOptions = {
    allowNonTsExtensions: true,
    baseUrl: 'C:/',
    jsx: ts.JsxEmit.React,
    jsxFactory: 'h',
    jsxFragmentFactory: 'Fragment',
    module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    noEmit: true,
    skipLibCheck: false,
    strict: true,
    target: ts.ScriptTarget.ES2020,
    types: [],
    paths: {
      '@caemble/core': ['node_modules/@caemble/core/index.d.ts'],
      '@caemble/core/v2': ['node_modules/@caemble/core/v2/index.d.ts'],
    },
  }
  const host = ts.createCompilerHost(options)
  const defaultFileExists = host.fileExists.bind(host)
  const defaultReadFile = host.readFile.bind(host)
  const defaultDirectoryExists = host.directoryExists?.bind(host)
  host.fileExists = (path) => virtualFiles.has(path.replace(/\\/g, '/')) || defaultFileExists(path)
  host.readFile = (path) => virtualFiles.get(path.replace(/\\/g, '/')) ?? defaultReadFile(path)
  host.directoryExists = (path) => path.replace(/\\/g, '/').startsWith('C:/node_modules/@caemble/core')
    || defaultDirectoryExists?.(path)
    || false
  host.getSourceFile = (path, languageVersion) => {
    const text = host.readFile(path)
    return text === undefined ? undefined : ts.createSourceFile(path, text, languageVersion, true)
  }
  const program = ts.createProgram({
    rootNames: [sourcePath, 'C:/node_modules/@caemble/core/v2/cad-jsx.d.ts'],
    options,
    host,
  })
  return ts.getPreEmitDiagnostics(program).map((diagnostic) => ts.flattenDiagnosticMessageText(
    diagnostic.messageText,
    '\n',
  ))
}

describe('@caemble/core/v2 authoring declaration', () => {
  it('uses the TypeScript version embedded in Monaco and a callable JSX fragment factory', () => {
    expect(ts.version).toBe('5.9.3')
    expect(jsxTypes).toContain('function Fragment(')
    expect(jsxTypes).not.toContain('const Fragment: unknown')
  })

  it('type-checks the Structure and Experiment defaults', () => {
    expect(diagnosticsFor(defaultCode)).toEqual([])
    expect(diagnosticsFor(defaultExperimentCode)).toEqual([])
  })

  it.each(caembleExamples)('type-checks the $title example', ({ code }) => {
    expect(diagnosticsFor(code)).toEqual([])
  })

  it('rejects unknown vars and tuple shapes', () => {
    const unknownVar = defaultCode.replace('size={vars.conductorSize}', 'size={vars.unknownSize}')
    const wrongTuple = defaultCode.replace('size={vars.conductorSize}', 'size={[1, 2]}')

    expect(diagnosticsFor(unknownVar).join('\n')).toContain("Property 'unknownSize' does not exist")
    expect(diagnosticsFor(wrongTuple).join('\n')).toContain('Source has 2 element(s) but target requires 3')
  })

  it('rejects unregistered Solver methods and parameter keys', () => {
    const wrongMethod = defaultExperimentCode.replace("methodId: 'dc.voxel-grid'", "methodId: 'dc.unknown'")
    const wrongParameter = defaultExperimentCode.replace('gridShape: {', 'unknownGridShape: {')

    expect(diagnosticsFor(wrongMethod).join('\n')).toContain('dc.unknown')
    expect(diagnosticsFor(wrongParameter).join('\n')).toContain('unknownGridShape')
  })
})

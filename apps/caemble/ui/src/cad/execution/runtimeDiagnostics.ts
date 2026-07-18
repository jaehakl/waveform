import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping'
import type { CompiledCadProjectV2 } from '../compiler/types'
import type { CadDiagnosticV2 } from '../worker/protocol'

export function runtimeDiagnostic(
  error: Error,
  project: CompiledCadProjectV2,
): CadDiagnosticV2 | undefined {
  const stackFrame = error.stack?.match(/caemble:\/\/([0-9a-f]{64})\/(.+?):(\d+):(\d+)/)
  if (!stackFrame || stackFrame[1] !== project.sourceHash) return undefined
  const module = project.modules[stackFrame[2]]
  const generatedLine = Math.max(1, Number(stackFrame[3]) - 2)
  const generatedColumn = Math.max(0, Number(stackFrame[4]) - 1)
  let file = stackFrame[2]
  let line = generatedLine
  let column = generatedColumn
  if (module?.sourceMap) {
    const original = originalPositionFor(new TraceMap(module.sourceMap), {
      line: generatedLine,
      column: generatedColumn,
    })
    if (original.source && original.line !== null && original.column !== null) {
      file = original.source.replace(/^.*\/caemble-project\/[0-9a-f]{64}\//, '')
      line = original.line
      column = original.column
    }
  }
  return Object.freeze({
    code: 'CAD_RUNTIME',
    file,
    message: error.message,
    phase: 'runtime' as const,
    range: Object.freeze({
      startLineNumber: line,
      startColumn: column + 1,
      endLineNumber: line,
      endColumn: column + 2,
    }),
    severity: 'error' as const,
  })
}

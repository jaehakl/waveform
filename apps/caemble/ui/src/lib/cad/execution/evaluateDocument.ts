import { compileCadDocument } from '../compiler/monacoCompiler'
import { evaluateInIsolatedRunner } from '../runner/client'
import { assertCadEvaluationRequestV2 } from '../runner/protocol'
import { assertCadSourceDocumentV2, type CadEvaluationInputV2 } from '../source/document'
import type { CadDiagnosticV2, CadEvaluationRequestV2 } from '../worker/protocol'
import type { EvaluatedDocumentSnapshotV2 } from './snapshot'

export type EvaluateDocumentOptionsV2 = Readonly<{
  signal?: AbortSignal
  timeoutMs?: 3000 | 10000 | 30000
}>

export class CadDocumentEvaluationErrorV2 extends Error {
  readonly diagnostics: readonly CadDiagnosticV2[]

  constructor(message: string, diagnostics: readonly CadDiagnosticV2[] = []) {
    super(message)
    this.name = 'CadDocumentEvaluationErrorV2'
    this.diagnostics = diagnostics
  }
}

export async function evaluateDocument(
  input: CadEvaluationInputV2,
  options: EvaluateDocumentOptionsV2 = {},
): Promise<EvaluatedDocumentSnapshotV2> {
  assertCadSourceDocumentV2(input.document)
  if (!Number.isSafeInteger(input.seed) || input.seed < 0) {
    throw new CadDocumentEvaluationErrorV2('Evaluation seed must be a non-negative safe integer.')
  }
  if (options.signal?.aborted) throw new DOMException('The CAD evaluation was aborted.', 'AbortError')
  const compiledProject = await compileCadDocument(input.document)
  const request: CadEvaluationRequestV2 = {
    type: 'evaluate-document',
    compiledProject,
    document: {
      apiVersion: 2,
      kind: input.document.kind,
      realizationSeed: input.seed,
    },
    requestId: `evaluate-${crypto.randomUUID()}`,
    revision: 0,
    ...(input.vars ? { vars: input.vars } : {}),
  }
  assertCadEvaluationRequestV2(request)

  return new Promise<EvaluatedDocumentSnapshotV2>((resolve, reject) => {
    const timeoutMs = options.timeoutMs ?? 3000
    let settled = false
    let cancel: () => void = () => undefined
    let timeout: number | null = null
    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      if (timeout !== null) window.clearTimeout(timeout)
      options.signal?.removeEventListener('abort', abort)
      callback()
    }
    const abort = () => finish(() => {
      cancel()
      reject(new DOMException('The CAD evaluation was aborted.', 'AbortError'))
    })
    options.signal?.addEventListener('abort', abort, { once: true })
    cancel = evaluateInIsolatedRunner(request, {
      onFailure(message) {
        finish(() => reject(new CadDocumentEvaluationErrorV2(message)))
      },
      onStart() {
        if (settled) return
        timeout = window.setTimeout(() => finish(() => {
          cancel()
          reject(new CadDocumentEvaluationErrorV2(`Model evaluation timed out after ${timeoutMs / 1000} seconds.`))
        }), timeoutMs)
      },
      onResponse(response) {
        if (response.type === 'document-success') {
          finish(() => resolve(response.snapshot))
        } else {
          finish(() => reject(new CadDocumentEvaluationErrorV2(response.message, response.diagnostics)))
        }
      },
    })
  })
}

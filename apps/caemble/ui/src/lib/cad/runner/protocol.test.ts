import { describe, expect, it } from 'vitest'
import { CAD_COMPILER_VERSION, type CompiledCadProjectV2 } from '../compiler/types'
import type { EvaluatedDocumentSnapshotV2 } from '../execution/snapshot'
import { serializeCadScene } from '../execution/mesh'
import {
  assertCadEvaluationRequestV2,
  assertRunnerCancelEnvelopeV2,
  assertRunnerEvaluationEnvelopeV2,
  assertRunnerEvaluationResultEnvelopeV2,
  assertRunnerEvaluationStartedEnvelopeV2,
  assertRunnerPreparedEvaluationEnvelopeV2,
  assertRunnerPreparedSessionEnvelopeV2,
  assertRunnerPreparedSessionErrorEnvelopeV2,
  assertRunnerPreparedSessionReadyEnvelopeV2,
} from './protocol'

const sourceHash = 'b'.repeat(64)
const nonce = '12345678-1234-1234-1234-123456789abc'
const compiledProject: CompiledCadProjectV2 = {
  apiVersion: 2,
  compilerVersion: CAD_COMPILER_VERSION,
  entryFile: 'structure.tsx',
  modules: { 'structure.tsx': { code: 'module.exports.default = {}' } },
  sourceHash,
}
const snapshot: EvaluatedDocumentSnapshotV2 = {
  apiVersion: 2,
  kind: 'structure',
  scene: serializeCadScene({
    geometryGroups: [],
    lengthUnit: 'mm',
    parts: [],
    surfaceGroups: [],
    tree: { children: [], key: 'structure', label: 'Structure' },
  }),
  seed: 7,
  sourceHash,
  variables: {},
  varsSchema: {},
}
const request = {
  type: 'evaluate-document' as const,
  requestId: 'request-1',
  revision: 3,
  document: { apiVersion: 2 as const, kind: 'structure' as const, realizationSeed: 7 },
  compiledProject,
  vars: { width: 2 },
}

describe('isolated runner v2 protocol', () => {
  it('accepts exact evaluate, cancel, and result envelopes', () => {
    expect(() => assertCadEvaluationRequestV2(request)).not.toThrow()
    expect(() =>
      assertRunnerEvaluationEnvelopeV2({
        type: 'caemble-runner-evaluate-v2',
        nonce,
        request,
      }),
    ).not.toThrow()
    expect(() =>
      assertRunnerEvaluationStartedEnvelopeV2({
        type: 'caemble-runner-started-v2',
        nonce,
        requestId: request.requestId,
        revision: request.revision,
        documentType: request.document.kind,
      }),
    ).not.toThrow()
    expect(() => assertRunnerCancelEnvelopeV2({ type: 'caemble-runner-cancel-v2', nonce })).not.toThrow()
    expect(() =>
      assertRunnerEvaluationResultEnvelopeV2({
        type: 'caemble-runner-result-v2',
        nonce,
        response: {
          type: 'document-success',
          documentType: 'structure',
          requestId: 'request-1',
          revision: 3,
          snapshot,
        },
      }),
    ).not.toThrow()
  })

  it('rejects additional fields, non-plain objects, and prototype keys', () => {
    expect(() => assertCadEvaluationRequestV2({ ...request, elevated: true })).toThrow(
      'request.elevated is not allowed',
    )
    expect(() =>
      assertCadEvaluationRequestV2({
        ...request,
        document: { ...request.document, cookie: 'secret' },
      }),
    ).toThrow('request.document.cookie is not allowed')
    expect(() =>
      assertRunnerEvaluationEnvelopeV2(
        Object.assign(Object.create({ polluted: true }), {
          type: 'caemble-runner-evaluate-v2',
          nonce,
          request,
        }),
      ),
    ).toThrow('envelope must be a plain object')
    expect(() =>
      assertCadEvaluationRequestV2({
        ...request,
        vars: JSON.parse('{"__proto__": 1}'),
      }),
    ).toThrow('var key is invalid: __proto__')
  })

  it('bounds external tensor data before evaluation', () => {
    expect(() => assertCadEvaluationRequestV2({ ...request, vars: { width: Number.NaN } })).toThrow(
      'must contain finite numbers',
    )
    let nested: unknown = 1
    for (let depth = 0; depth < 34; depth += 1) nested = [nested]
    expect(() => assertCadEvaluationRequestV2({ ...request, vars: { nested } })).toThrow('tensor depth limit')
  })

  it('validates prepared sessions and seed-only evaluation requests independently', () => {
    expect(() =>
      assertRunnerPreparedSessionEnvelopeV2({
        type: 'caemble-runner-prepare-v2',
        nonce,
        document: { apiVersion: 2, kind: 'structure' },
        compiledProject,
      }),
    ).not.toThrow()
    expect(() =>
      assertRunnerPreparedSessionReadyEnvelopeV2({
        type: 'caemble-runner-prepared-v2',
        nonce,
        documentType: 'structure',
        sourceHash,
      }),
    ).not.toThrow()
    expect(() =>
      assertRunnerPreparedEvaluationEnvelopeV2({
        type: 'caemble-runner-evaluate-prepared-v2',
        nonce,
        request: {
          requestId: 'prepared-1',
          revision: 4,
          realizationSeed: 9,
          vars: { width: 4 },
        },
      }),
    ).not.toThrow()
    expect(() =>
      assertRunnerPreparedSessionErrorEnvelopeV2({
        type: 'caemble-runner-session-error-v2',
        nonce,
        message: 'worker failed',
      }),
    ).not.toThrow()

    expect(() =>
      assertRunnerPreparedEvaluationEnvelopeV2({
        type: 'caemble-runner-evaluate-prepared-v2',
        nonce,
        request: {
          requestId: 'prepared-1',
          revision: 4,
          realizationSeed: -1,
        },
      }),
    ).toThrow('seed is invalid')
  })

  it('rejects forged snapshot kinds and malformed runtime diagnostics', () => {
    expect(() =>
      assertRunnerEvaluationResultEnvelopeV2({
        type: 'caemble-runner-result-v2',
        nonce,
        response: {
          type: 'document-success',
          documentType: 'experiment',
          requestId: 'request-1',
          revision: 3,
          snapshot,
        },
      }),
    ).toThrow('snapshot kind does not match')

    expect(() =>
      assertRunnerEvaluationResultEnvelopeV2({
        type: 'caemble-runner-result-v2',
        nonce,
        response: {
          type: 'document-error',
          documentType: 'structure',
          errorType: 'runtime',
          message: 'boom',
          requestId: 'request-1',
          revision: 3,
          diagnostics: [
            {
              code: 'CAD_RUNTIME',
              file: 'structure.tsx',
              message: 'boom',
              phase: 'runtime',
              range: { startLineNumber: 4, startColumn: 2, endLineNumber: 3, endColumn: 1 },
              severity: 'error',
            },
          ],
        },
      }),
    ).toThrow('range is reversed')
  })
})

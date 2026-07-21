import { assertCompiledCadProjectV2 } from '../compiler/types'
import { assertEvaluatedDocumentSnapshotV2 } from '../execution/snapshotValidation'
import { CadModelError } from '../model/errors'
import type { CadEvaluationRequestV2, CadEvaluationResponseV2 } from '../worker/protocol'

export type RunnerEvaluationEnvelopeV2 = Readonly<{
  type: 'caemble-runner-evaluate-v2'
  nonce: string
  request: CadEvaluationRequestV2
}>

export type RunnerEvaluationResultEnvelopeV2 = Readonly<{
  type: 'caemble-runner-result-v2'
  nonce: string
  response: CadEvaluationResponseV2
}>

export type RunnerEvaluationStartedEnvelopeV2 = Readonly<{
  type: 'caemble-runner-started-v2'
  nonce: string
  requestId: string
  revision: number
  documentType: 'structure' | 'experiment'
}>

export type RunnerCancelEnvelopeV2 = Readonly<{
  type: 'caemble-runner-cancel-v2'
  nonce: string
}>

function assertNonce(value: unknown) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9-]{16,128}$/.test(value)) {
    throw new CadModelError('Runner message nonce is invalid.')
  }
}

function assertOnlyKeys(value: object, allowed: readonly string[], path: string) {
  if (Object.getPrototypeOf(value) !== Object.prototype) {
    throw new CadModelError(`${path} must be a plain object.`)
  }
  const unknown = Object.keys(value).find((key) => !allowed.includes(key))
  if (unknown) throw new CadModelError(`${path}.${unknown} is not allowed.`)
}

function assertTensor(value: unknown, path: string, budget: { nodes: number }, depth = 0) {
  budget.nodes += 1
  if (budget.nodes > 1_000_000) throw new CadModelError('CAD evaluation vars exceed the tensor complexity limit.')
  if (depth > 32) throw new CadModelError(`${path} exceeds the tensor depth limit.`)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new CadModelError(`${path} must contain finite numbers.`)
    return
  }
  if (!Array.isArray(value)) throw new CadModelError(`${path} must be a number or tensor array.`)
  value.forEach((item, index) => assertTensor(item, `${path}[${index}]`, budget, depth + 1))
}

export function assertCadEvaluationRequestV2(value: unknown): asserts value is CadEvaluationRequestV2 {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new CadModelError('CAD evaluation request must be an object.')
  }
  const request = value as Partial<CadEvaluationRequestV2>
  assertOnlyKeys(value, ['type', 'requestId', 'revision', 'document', 'compiledProject', 'vars'], 'request')
  if (
    request.type !== 'evaluate-document'
    || typeof request.requestId !== 'string'
    || request.requestId.length === 0
    || request.requestId.length > 256
    || !Number.isSafeInteger(request.revision)
    || request.revision! < 0
  ) {
    throw new CadModelError('CAD evaluation request identity is invalid.')
  }
  const document = request.document
  if (
    typeof document !== 'object'
    || document === null
    || document.apiVersion !== 2
    || (document.kind !== 'structure' && document.kind !== 'experiment')
    || !Number.isSafeInteger(document.realizationSeed)
    || document.realizationSeed < 0
  ) {
    throw new CadModelError('CAD evaluation request document is invalid.')
  }
  assertOnlyKeys(document, ['apiVersion', 'kind', 'realizationSeed'], 'request.document')
  assertCompiledCadProjectV2(request.compiledProject)
  if (request.vars !== undefined) {
    if (
      typeof request.vars !== 'object'
      || request.vars === null
      || Array.isArray(request.vars)
      || Object.getPrototypeOf(request.vars) !== Object.prototype
    ) {
      throw new CadModelError('CAD evaluation vars must be a plain object.')
    }
    if (Object.keys(request.vars).length > 4096) {
      throw new CadModelError('CAD evaluation vars exceed the key-count limit.')
    }
    const tensorBudget = { nodes: 0 }
    Object.entries(request.vars).forEach(([key, tensor]) => {
      if (!key || key === '__proto__' || key === 'constructor' || key === 'prototype') {
        throw new CadModelError(`CAD evaluation var key is invalid: ${key}`)
      }
      assertTensor(tensor, `vars.${key}`, tensorBudget)
    })
  }
}

export function assertRunnerEvaluationEnvelopeV2(value: unknown): asserts value is RunnerEvaluationEnvelopeV2 {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new CadModelError('Runner evaluation envelope must be an object.')
  }
  const envelope = value as Partial<RunnerEvaluationEnvelopeV2>
  assertOnlyKeys(value, ['type', 'nonce', 'request'], 'envelope')
  if (envelope.type !== 'caemble-runner-evaluate-v2') {
    throw new CadModelError('Runner evaluation envelope type is invalid.')
  }
  assertNonce(envelope.nonce)
  assertCadEvaluationRequestV2(envelope.request)
}

export function assertRunnerCancelEnvelopeV2(value: unknown): asserts value is RunnerCancelEnvelopeV2 {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new CadModelError('Runner cancel envelope must be an object.')
  }
  const envelope = value as Partial<RunnerCancelEnvelopeV2>
  assertOnlyKeys(value, ['type', 'nonce'], 'cancel')
  if (envelope.type !== 'caemble-runner-cancel-v2') throw new CadModelError('Runner cancel type is invalid.')
  assertNonce(envelope.nonce)
}

export function assertRunnerEvaluationStartedEnvelopeV2(
  value: unknown,
): asserts value is RunnerEvaluationStartedEnvelopeV2 {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new CadModelError('Runner started envelope must be an object.')
  }
  const envelope = value as Partial<RunnerEvaluationStartedEnvelopeV2>
  assertOnlyKeys(value, ['type', 'nonce', 'requestId', 'revision', 'documentType'], 'started')
  if (
    envelope.type !== 'caemble-runner-started-v2'
    || typeof envelope.requestId !== 'string'
    || envelope.requestId.length === 0
    || envelope.requestId.length > 256
    || !Number.isSafeInteger(envelope.revision)
    || envelope.revision! < 0
    || (envelope.documentType !== 'structure' && envelope.documentType !== 'experiment')
  ) {
    throw new CadModelError('Runner started identity is invalid.')
  }
  assertNonce(envelope.nonce)
}

export function assertRunnerEvaluationResultEnvelopeV2(
  value: unknown,
): asserts value is RunnerEvaluationResultEnvelopeV2 {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new CadModelError('Runner result envelope must be an object.')
  }
  const envelope = value as Partial<RunnerEvaluationResultEnvelopeV2>
  assertOnlyKeys(value, ['type', 'nonce', 'response'], 'result')
  if (envelope.type !== 'caemble-runner-result-v2') throw new CadModelError('Runner result type is invalid.')
  assertNonce(envelope.nonce)
  const response = envelope.response
  if (typeof response !== 'object' || response === null || Array.isArray(response)) {
    throw new CadModelError('Runner result response must be an object.')
  }
  if (
    typeof response.requestId !== 'string'
    || response.requestId.length === 0
    || response.requestId.length > 256
    || !Number.isSafeInteger(response.revision)
    || response.revision < 0
    || (response.documentType !== 'structure' && response.documentType !== 'experiment')
  ) {
    throw new CadModelError('Runner result identity is invalid.')
  }
  if (response.type === 'document-success') {
    assertOnlyKeys(response, ['type', 'requestId', 'revision', 'documentType', 'snapshot'], 'result.response')
    assertEvaluatedDocumentSnapshotV2(response.snapshot)
    if (response.snapshot.kind !== response.documentType) {
      throw new CadModelError('Runner snapshot kind does not match the response.')
    }
    return
  }
  if (
    response.type !== 'document-error'
    || !['compile', 'type', 'policy', 'runtime', 'model'].includes(response.errorType)
    || typeof response.message !== 'string'
    || response.message.length > 65_536
    || (response.stack !== undefined && typeof response.stack !== 'string')
    || (typeof response.stack === 'string' && response.stack.length > 262_144)
  ) {
    throw new CadModelError('Runner error response is invalid.')
  }
  assertOnlyKeys(
    response,
    ['type', 'requestId', 'revision', 'documentType', 'errorType', 'message', 'diagnostics', 'stack'],
    'result.response',
  )
  if (response.diagnostics !== undefined && !Array.isArray(response.diagnostics)) {
    throw new CadModelError('result.response.diagnostics must be an array.')
  }
  if (response.diagnostics && response.diagnostics.length > 1000) {
    throw new CadModelError('result.response.diagnostics exceeds the item-count limit.')
  }
  response.diagnostics?.forEach((diagnostic, index) => {
    if (
      typeof diagnostic !== 'object'
      || diagnostic === null
      || Array.isArray(diagnostic)
      || typeof diagnostic.file !== 'string'
      || (typeof diagnostic.code !== 'string' && typeof diagnostic.code !== 'number')
      || !['error', 'warning', 'info'].includes(diagnostic.severity)
      || !['syntax', 'semantic', 'policy', 'runtime', 'model'].includes(diagnostic.phase)
      || typeof diagnostic.message !== 'string'
      || typeof diagnostic.range !== 'object'
      || diagnostic.range === null
      || !Object.values(diagnostic.range).every((position) => (
        typeof position === 'number' && Number.isSafeInteger(position) && position > 0
      ))
    ) {
      throw new CadModelError(`result.response.diagnostics[${index}] is invalid.`)
    }
    assertOnlyKeys(
      diagnostic,
      ['file', 'range', 'code', 'severity', 'phase', 'message'],
      `result.response.diagnostics[${index}]`,
    )
    assertOnlyKeys(
      diagnostic.range,
      ['startLineNumber', 'startColumn', 'endLineNumber', 'endColumn'],
      `result.response.diagnostics[${index}].range`,
    )
    if (
      diagnostic.range.endLineNumber < diagnostic.range.startLineNumber
      || (
        diagnostic.range.endLineNumber === diagnostic.range.startLineNumber
        && diagnostic.range.endColumn < diagnostic.range.startColumn
      )
    ) {
      throw new CadModelError(`result.response.diagnostics[${index}].range is reversed.`)
    }
  })
}

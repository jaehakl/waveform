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

export type RunnerPreparedSessionEnvelopeV2 = Readonly<{
  type: 'caemble-runner-prepare-v2'
  nonce: string
  document: Readonly<{
    apiVersion: 2
    kind: 'structure' | 'experiment'
  }>
  compiledProject: CadEvaluationRequestV2['compiledProject']
}>

export type RunnerPreparedSessionReadyEnvelopeV2 = Readonly<{
  type: 'caemble-runner-prepared-v2'
  nonce: string
  documentType: 'structure' | 'experiment'
  sourceHash: string
}>

export type RunnerPreparedEvaluationRequestV2 = Readonly<{
  requestId: string
  revision: number
  realizationSeed: number
  vars?: CadEvaluationRequestV2['vars']
}>

export type RunnerPreparedEvaluationEnvelopeV2 = Readonly<{
  type: 'caemble-runner-evaluate-prepared-v2'
  nonce: string
  request: RunnerPreparedEvaluationRequestV2
}>

export type RunnerPreparedSessionErrorEnvelopeV2 = Readonly<{
  type: 'caemble-runner-session-error-v2'
  nonce: string
  message: string
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

function assertRequestIdentity(requestId: unknown, revision: unknown, path: string) {
  if (
    typeof requestId !== 'string' ||
    requestId.length === 0 ||
    requestId.length > 256 ||
    !Number.isSafeInteger(revision) ||
    (revision as number) < 0
  ) {
    throw new CadModelError(`${path} identity is invalid.`)
  }
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

function assertEvaluationVars(vars: unknown) {
  if (vars === undefined) return
  if (
    typeof vars !== 'object' ||
    vars === null ||
    Array.isArray(vars) ||
    Object.getPrototypeOf(vars) !== Object.prototype
  ) {
    throw new CadModelError('CAD evaluation vars must be a plain object.')
  }
  if (Object.keys(vars).length > 4096) {
    throw new CadModelError('CAD evaluation vars exceed the key-count limit.')
  }
  const tensorBudget = { nodes: 0 }
  Object.entries(vars).forEach(([key, tensor]) => {
    if (!key || key === '__proto__' || key === 'constructor' || key === 'prototype') {
      throw new CadModelError(`CAD evaluation var key is invalid: ${key}`)
    }
    assertTensor(tensor, `vars.${key}`, tensorBudget)
  })
}

export function assertCadEvaluationRequestV2(value: unknown): asserts value is CadEvaluationRequestV2 {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new CadModelError('CAD evaluation request must be an object.')
  }
  const request = value as Partial<CadEvaluationRequestV2>
  assertOnlyKeys(value, ['type', 'requestId', 'revision', 'document', 'compiledProject', 'vars'], 'request')
  if (request.type !== 'evaluate-document') throw new CadModelError('CAD evaluation request type is invalid.')
  assertRequestIdentity(request.requestId, request.revision, 'CAD evaluation request')
  const document = request.document
  if (
    typeof document !== 'object' ||
    document === null ||
    document.apiVersion !== 2 ||
    (document.kind !== 'structure' && document.kind !== 'experiment') ||
    !Number.isSafeInteger(document.realizationSeed) ||
    document.realizationSeed < 0
  ) {
    throw new CadModelError('CAD evaluation request document is invalid.')
  }
  assertOnlyKeys(document, ['apiVersion', 'kind', 'realizationSeed'], 'request.document')
  assertCompiledCadProjectV2(request.compiledProject)
  assertEvaluationVars(request.vars)
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

export function assertRunnerPreparedSessionEnvelopeV2(
  value: unknown,
): asserts value is RunnerPreparedSessionEnvelopeV2 {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new CadModelError('Runner prepared session envelope must be an object.')
  }
  const envelope = value as Partial<RunnerPreparedSessionEnvelopeV2>
  assertOnlyKeys(value, ['type', 'nonce', 'document', 'compiledProject'], 'prepared')
  if (envelope.type !== 'caemble-runner-prepare-v2') {
    throw new CadModelError('Runner prepared session type is invalid.')
  }
  assertNonce(envelope.nonce)
  if (
    typeof envelope.document !== 'object' ||
    envelope.document === null ||
    envelope.document.apiVersion !== 2 ||
    (envelope.document.kind !== 'structure' && envelope.document.kind !== 'experiment')
  ) {
    throw new CadModelError('Runner prepared session document is invalid.')
  }
  assertOnlyKeys(envelope.document, ['apiVersion', 'kind'], 'prepared.document')
  assertCompiledCadProjectV2(envelope.compiledProject)
}

export function assertRunnerPreparedEvaluationEnvelopeV2(
  value: unknown,
): asserts value is RunnerPreparedEvaluationEnvelopeV2 {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new CadModelError('Runner prepared evaluation envelope must be an object.')
  }
  const envelope = value as Partial<RunnerPreparedEvaluationEnvelopeV2>
  assertOnlyKeys(value, ['type', 'nonce', 'request'], 'preparedEvaluation')
  if (envelope.type !== 'caemble-runner-evaluate-prepared-v2') {
    throw new CadModelError('Runner prepared evaluation type is invalid.')
  }
  assertNonce(envelope.nonce)
  if (typeof envelope.request !== 'object' || envelope.request === null || Array.isArray(envelope.request)) {
    throw new CadModelError('Runner prepared evaluation request must be an object.')
  }
  assertOnlyKeys(envelope.request, ['requestId', 'revision', 'realizationSeed', 'vars'], 'preparedEvaluation.request')
  assertRequestIdentity(envelope.request.requestId, envelope.request.revision, 'Runner prepared evaluation request')
  if (!Number.isSafeInteger(envelope.request.realizationSeed) || envelope.request.realizationSeed < 0) {
    throw new CadModelError('Runner prepared evaluation seed is invalid.')
  }
  assertEvaluationVars(envelope.request.vars)
}

export function assertRunnerPreparedSessionReadyEnvelopeV2(
  value: unknown,
): asserts value is RunnerPreparedSessionReadyEnvelopeV2 {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new CadModelError('Runner prepared session ready envelope must be an object.')
  }
  const envelope = value as Partial<RunnerPreparedSessionReadyEnvelopeV2>
  assertOnlyKeys(value, ['type', 'nonce', 'documentType', 'sourceHash'], 'preparedReady')
  if (
    envelope.type !== 'caemble-runner-prepared-v2' ||
    (envelope.documentType !== 'structure' && envelope.documentType !== 'experiment') ||
    typeof envelope.sourceHash !== 'string' ||
    !/^[a-f0-9]{64}$/.test(envelope.sourceHash)
  ) {
    throw new CadModelError('Runner prepared session ready identity is invalid.')
  }
  assertNonce(envelope.nonce)
}

export function assertRunnerPreparedSessionErrorEnvelopeV2(
  value: unknown,
): asserts value is RunnerPreparedSessionErrorEnvelopeV2 {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new CadModelError('Runner prepared session error envelope must be an object.')
  }
  const envelope = value as Partial<RunnerPreparedSessionErrorEnvelopeV2>
  assertOnlyKeys(value, ['type', 'nonce', 'message'], 'preparedError')
  if (
    envelope.type !== 'caemble-runner-session-error-v2' ||
    typeof envelope.message !== 'string' ||
    envelope.message.length === 0 ||
    envelope.message.length > 65_536
  ) {
    throw new CadModelError('Runner prepared session error is invalid.')
  }
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
    envelope.type !== 'caemble-runner-started-v2' ||
    typeof envelope.requestId !== 'string' ||
    envelope.requestId.length === 0 ||
    envelope.requestId.length > 256 ||
    !Number.isSafeInteger(envelope.revision) ||
    envelope.revision! < 0 ||
    (envelope.documentType !== 'structure' && envelope.documentType !== 'experiment')
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
    typeof response.requestId !== 'string' ||
    response.requestId.length === 0 ||
    response.requestId.length > 256 ||
    !Number.isSafeInteger(response.revision) ||
    response.revision < 0 ||
    (response.documentType !== 'structure' && response.documentType !== 'experiment')
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
    response.type !== 'document-error' ||
    !['compile', 'type', 'policy', 'runtime', 'model'].includes(response.errorType) ||
    typeof response.message !== 'string' ||
    response.message.length > 65_536 ||
    (response.stack !== undefined && typeof response.stack !== 'string') ||
    (typeof response.stack === 'string' && response.stack.length > 262_144)
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
      typeof diagnostic !== 'object' ||
      diagnostic === null ||
      Array.isArray(diagnostic) ||
      typeof diagnostic.file !== 'string' ||
      (typeof diagnostic.code !== 'string' && typeof diagnostic.code !== 'number') ||
      !['error', 'warning', 'info'].includes(diagnostic.severity) ||
      !['syntax', 'semantic', 'policy', 'runtime', 'model'].includes(diagnostic.phase) ||
      typeof diagnostic.message !== 'string' ||
      typeof diagnostic.range !== 'object' ||
      diagnostic.range === null ||
      !Object.values(diagnostic.range).every(
        (position) => typeof position === 'number' && Number.isSafeInteger(position) && position > 0,
      )
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
      diagnostic.range.endLineNumber < diagnostic.range.startLineNumber ||
      (diagnostic.range.endLineNumber === diagnostic.range.startLineNumber &&
        diagnostic.range.endColumn < diagnostic.range.startColumn)
    ) {
      throw new CadModelError(`result.response.diagnostics[${index}].range is reversed.`)
    }
  })
}

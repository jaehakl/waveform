import { useMemo, useState } from 'react'
import type {
  DataAxis,
  DataValueDescriptor,
  EvaluatedExperimentRules,
  ExperimentParameter,
  ExperimentRule,
  RecordedDataResultAxis,
  RecordedDataRule,
} from '../cad'
import { normalizeDataValueDescriptor } from '../cad/model/core'
import {
  inspectExperimentTensorSource,
  updateExperimentTensorSource,
  type ExperimentRuleCategory,
} from '../cad/source/experimentParameters'
import { QuantityKind } from '../quantitykind'

type ExperimentalParametersProps = {
  onSourceChange: (source: string) => void
  readOnly: boolean
  rules: EvaluatedExperimentRules | null
  source: string
}

const categories = [
  { id: 'initializations', label: 'Initializations' },
  { id: 'boundaryConditions', label: 'Boundary Conditions' },
  { id: 'recordedData', label: 'Recorded Data' },
] as const

function isDataDescriptor(value: unknown): value is DataValueDescriptor {
  return typeof value === 'object' && value !== null && 'dtype' in value
}

function parameterSummary(value: ExperimentParameter) {
  if (typeof value !== 'object' || value === null) return `${String(value)} · ${typeof value === 'number' ? 'integer' : typeof value}`
  return `${String(value.value)} · ${value.dtype}${value.quantityKind ? ` · ${value.quantityKind} · ${value.unit}` : ''}`
}

function TensorAxes({
  axes,
  label,
}: {
  axes?: readonly (DataAxis | RecordedDataResultAxis)[]
  label: string
}) {
  if (!axes) return null

  return (
    <div aria-label={label} className="mt-3 rounded border border-slate-200 bg-white p-2 text-xs text-slate-600">
      <div className="font-semibold text-slate-700">Axes (source-only)</div>
      <div className="mt-1 space-y-1.5">
          {axes.map((axis, index) => (
            <div className="grid gap-1 sm:grid-cols-[minmax(0,8rem)_minmax(0,1fr)]" key={`${axis.name}-${index}`}>
              <span className="font-medium text-slate-700">
                {axis.name ?? `axis ${index}`} · {axis.quantityKind
                  ? `${axis.quantityKind} · ${axis.unit}`
                  : 'unitless'}
              </span>
              <code className="overflow-x-auto whitespace-nowrap text-slate-600">
                {axis.length === undefined
                  ? 'length dynamic · ticks from result'
                  : `length ${axis.length} · ticks ${JSON.stringify(axis.ticks ?? [])}`}
              </code>
            </div>
          ))}
      </div>
    </div>
  )
}

function TensorParameterEditor({
  category,
  onSourceChange,
  parameter,
  parameterKey,
  readOnly,
  ruleIndex,
  ruleLabel,
  source,
}: {
  category: ExperimentRuleCategory
  onSourceChange: (source: string) => void
  parameter: DataValueDescriptor
  parameterKey: string
  readOnly: boolean
  ruleIndex: number
  ruleLabel: string
  source: string
}) {
  const original = JSON.stringify(parameter.value, null, 2)
  const [draft, setDraft] = useState(original)
  const [error, setError] = useState<string | null>(null)
  const sourceInfo = useMemo(
    () => inspectExperimentTensorSource(source, category, ruleIndex, parameterKey),
    [category, parameterKey, ruleIndex, source],
  )
  const editable = !readOnly && sourceInfo.editable
  const tensorOrder = parameter.quantityKind ? QuantityKind[parameter.quantityKind].tensorOrder() : 0
  const componentShape = parameter.quantityKind ? QuantityKind[parameter.quantityKind].componentShape() : []

  return (
    <div className="rounded border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-mono text-xs font-semibold text-slate-800">{parameterKey}</div>
          <div className="mt-1 text-xs text-slate-500">
            {parameter.dtype} · axes {parameter.axes?.map((axis) => axis.length).join(' × ') ?? 'none'} ·{' '}
            order {tensorOrder} · components {JSON.stringify(componentShape)} ·{' '}
            {parameter.quantityKind ? `${parameter.quantityKind} · ${parameter.unit}` : 'unitless'}
          </div>
          {parameter.basis ? <div className="mt-1 font-mono text-xs text-slate-500">basis {JSON.stringify(parameter.basis)}</div> : null}
        </div>
        <div className="flex gap-2">
          <button
            className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={draft === original}
            type="button"
            onClick={() => {
              setDraft(original)
              setError(null)
            }}
          >
            Reset
          </button>
          <button
            className="rounded bg-slate-900 px-2.5 py-1 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!editable || draft === original}
            type="button"
            onClick={() => {
              try {
                const parsed = JSON.parse(draft) as unknown
                const normalized = normalizeDataValueDescriptor({
                  ...parameter,
                  value: parsed,
                }, `Experiment ${category}[${ruleIndex}].parameters.${parameterKey}`)
                const update = updateExperimentTensorSource(
                  source,
                  category,
                  ruleIndex,
                  parameterKey,
                  normalized.value,
                )
                onSourceChange(update.source)
                setError(null)
              } catch (saveError) {
                setError(saveError instanceof Error ? saveError.message : 'The tensor value could not be saved.')
              }
            }}
          >
            Save
          </button>
        </div>
      </div>

      <TensorAxes
        axes={parameter.axes}
        label={`${ruleLabel} ${parameterKey} axes`}
      />

      <textarea
        aria-label={`${ruleLabel} ${parameterKey} data JSON`}
        className="mt-3 min-h-36 w-full resize-y rounded border border-slate-300 bg-white p-2 font-mono text-xs leading-5 text-slate-800 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 read-only:bg-slate-100 read-only:text-slate-500"
        readOnly={!editable}
        spellCheck={false}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value)
          setError(null)
        }}
      />

      {sourceInfo.shared ? (
        <p className="mt-2 text-xs leading-5 text-amber-700">
          This top-level const is shared. Saving changes every reference to {sourceInfo.bindingName}.
        </p>
      ) : null}
      {!sourceInfo.editable ? (
        <p className="mt-2 text-xs leading-5 text-slate-600">{sourceInfo.reason}</p>
      ) : readOnly ? (
        <p className="mt-2 text-xs leading-5 text-slate-600">
          Provide onExperimentChange to edit this tensor.
        </p>
      ) : null}
      {error ? <p className="mt-2 text-xs leading-5 text-rose-700">{error}</p> : null}
    </div>
  )
}

function RuleCard({
  category,
  onSourceChange,
  readOnly,
  rule,
  ruleIndex,
  source,
}: {
  category: ExperimentRuleCategory
  onSourceChange: (source: string) => void
  readOnly: boolean
  rule: ExperimentRule | RecordedDataRule
  ruleIndex: number
  source: string
}) {
  const tensorParameters = Object.entries(rule.parameters).filter(
    (entry): entry is [string, DataValueDescriptor] => isDataDescriptor(entry[1]) && Array.isArray(entry[1].value),
  )
  const scalarParameters = Object.entries(rule.parameters).filter(([, value]) => (
    !isDataDescriptor(value) || !Array.isArray(value.value)
  ))
  const resultTensorOrder = 'result' in rule && rule.result.quantityKind
    ? QuantityKind[rule.result.quantityKind].tensorOrder()
    : 0
  const resultComponentShape = 'result' in rule && rule.result.quantityKind
    ? QuantityKind[rule.result.quantityKind].componentShape()
    : []

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">{rule.label}</h4>
          <p className="mt-1 font-mono text-xs text-slate-500">{rule.methodId}</p>
        </div>
        <span className="rounded bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {category}
        </span>
      </div>

      {'result' in rule ? (
        <div className="mt-3 rounded border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
          <div className="font-semibold">Recorded result schema (source-only)</div>
          <div className="mt-1 font-mono">
            {rule.result.dtype} · axes {rule.result.axes?.map((axis) => axis.length ?? 'dynamic').join(' × ') ?? 'none'} ·{' '}
            order {resultTensorOrder} · components {JSON.stringify(resultComponentShape)} ·{' '}
            {rule.result.quantityKind ? `${rule.result.quantityKind} · ${rule.result.unit}` : 'unitless'}
          </div>
          {rule.result.basis ? <div className="mt-1 font-mono">basis {JSON.stringify(rule.result.basis)}</div> : null}
          <TensorAxes
            axes={rule.result.axes}
            label={`${rule.label} result axes`}
          />
        </div>
      ) : null}

      {tensorParameters.length > 0 ? (
        <div className="mt-3 space-y-3">
          {tensorParameters.map(([parameterKey, parameter]) => (
            <TensorParameterEditor
              category={category}
              key={`${parameterKey}-${JSON.stringify(parameter.value)}`}
              onSourceChange={onSourceChange}
              parameter={parameter}
              parameterKey={parameterKey}
              readOnly={readOnly}
              ruleIndex={ruleIndex}
              ruleLabel={rule.label}
              source={source}
            />
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500">This rule has no array-valued descriptors.</p>
      )}

      {scalarParameters.length > 0 ? (
        <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3 text-xs">
          <div className="font-semibold text-slate-700">Scalar parameters (source-only)</div>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {scalarParameters.map(([key, value]) => (
              <div className="flex min-w-0 justify-between gap-3 rounded bg-white px-2 py-1.5" key={key}>
                <code className="truncate text-slate-700">{key}</code>
                <span className="shrink-0 text-slate-500">{parameterSummary(value)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  )
}

export default function ExperimentalParameters({
  onSourceChange,
  readOnly,
  rules,
  source,
}: ExperimentalParametersProps) {
  if (!rules) {
    return (
      <div className="grid h-full place-items-center bg-slate-50 px-6 text-center">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Waiting for Experiment parameters</h3>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Validated tensor parameters appear after the Experiment Worker succeeds.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto bg-slate-50 px-4 py-4">
      <div className="mb-4 rounded border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-600">
        Only array-valued descriptor values are editable here. Scalar values, Quantity Kinds, units, dtype, axes,
        component shape, basis, and recorded result schemas are source-only.
      </div>

      <div className="space-y-5">
        {categories.map((category) => {
          const categoryRules = rules[category.id]
          const visibleRules = categoryRules.map((rule, ruleIndex) => ({ rule, ruleIndex }))

          return (
            <section key={category.id}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                {category.label}
              </h3>
              {visibleRules.length > 0 ? (
                <div className="space-y-3">
                  {visibleRules.map(({ rule, ruleIndex }) => (
                    <RuleCard
                      category={category.id}
                      key={`${category.id}-${ruleIndex}-${rule.label}`}
                      onSourceChange={onSourceChange}
                      readOnly={readOnly}
                      rule={rule}
                      ruleIndex={ruleIndex}
                      source={source}
                    />
                  ))}
                </div>
              ) : (
                <p className="rounded border border-dashed border-slate-300 bg-white px-3 py-4 text-xs text-slate-500">
                  No parameters in this category.
                </p>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}

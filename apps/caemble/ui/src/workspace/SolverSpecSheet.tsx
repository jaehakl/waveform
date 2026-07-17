import type { ResolvedExperimentSolver } from '../cad'
import { QuantityKind } from '../quantitykind'
import type {
  SolverMethodSpec,
  SolverParameterSpec,
  SolverRuleCategory,
  SolverSpec,
  SolverValueSpec,
} from '../solver'

type SolverSpecSheetProps = Readonly<{
  solver: ResolvedExperimentSolver | null
  spec: SolverSpec | null
}>

const categories: readonly Readonly<{ id: SolverRuleCategory; label: string }>[] = [
  { id: 'initializations', label: 'Initializations' },
  { id: 'boundaryConditions', label: 'Boundary Conditions' },
  { id: 'recordedData', label: 'Recorded Data' },
]

function QuantityContract({ spec }: { spec: Readonly<{ quantityKind: keyof typeof QuantityKind; referenceUnit: string }> }) {
  const units = QuantityKind[spec.quantityKind].applicableUnits()
  return (
    <span>
      <span className="font-medium text-sky-800">{spec.quantityKind}</span>
      {' · reference '}
      <code>{spec.referenceUnit}</code>
      {' · '}
      <details className="inline">
        <summary className="inline cursor-pointer text-sky-700">{units.length} applicable units</summary>
        <code className="mt-1 block max-h-24 overflow-auto whitespace-normal rounded bg-sky-50 p-2 text-[11px] leading-5">
          {units.join(', ')}
        </code>
      </details>
    </span>
  )
}

function boundsText(spec: Readonly<{
  minimum?: number
  maximum?: number
  exclusiveMinimum?: boolean
  exclusiveMaximum?: boolean
}>) {
  const minimum = spec.minimum === undefined
    ? null
    : `${spec.exclusiveMinimum ? '>' : '≥'} ${spec.minimum}`
  const maximum = spec.maximum === undefined
    ? null
    : `${spec.exclusiveMaximum ? '<' : '≤'} ${spec.maximum}`
  return [minimum, maximum].filter(Boolean).join(' and ')
}

function ValueContract({ spec }: { spec: SolverValueSpec }) {
  const bounds = 'minimum' in spec || 'maximum' in spec ? boundsText(spec) : ''
  if (spec.type === 'float') {
    return (
      <span>
        float · <QuantityContract spec={spec} />{bounds ? ` · ${bounds}` : ''}
      </span>
    )
  }
  if (spec.type === 'tensor') {
    return (
      <div>
        tensor · {spec.dtype} · {spec.dimension}D · shape {JSON.stringify(spec.shape)}
        {spec.quantityKind ? <><br /><QuantityContract spec={spec as Parameters<typeof QuantityContract>[0]['spec']} /></> : null}
        {spec.element && boundsText(spec.element) ? ` · elements ${boundsText(spec.element)}` : ''}
        {spec.axes?.map((axis, index) => (
          <div className="ml-3 mt-1" key={`${axis.name}-${index}`}>
            axis {index}: {axis.name}
            {axis.ticks ? ` · ticks ${JSON.stringify(axis.ticks)}` : ''}
            {axis.quantityKind ? <><br /><QuantityContract spec={axis} /></> : ' · unitless'}
          </div>
        ))}
      </div>
    )
  }
  if (spec.type === 'array') return <span>array · items: <ValueContract spec={spec.items} /></span>
  if (spec.type === 'object') return <span>object · {Object.keys(spec.parameters).length} declared parameters</span>
  if (spec.type === 'string' && spec.values) return <span>string · one of {spec.values.join(', ')}</span>
  return <span>{spec.type}{bounds ? ` · ${bounds}` : ''}</span>
}

function ParameterList({ parameters }: { parameters: Readonly<Record<string, SolverParameterSpec>> }) {
  const entries = Object.entries(parameters)
  if (entries.length === 0) return <p className="mt-2 text-xs text-slate-500">No required parameters.</p>
  return (
    <dl className="mt-2 space-y-2">
      {entries.map(([key, parameter]) => (
        <div className="rounded border border-slate-200 bg-slate-50 p-2" key={key}>
          <dt className="font-mono text-xs font-semibold text-slate-800">
            {key} · {parameter.required === false ? 'optional' : 'required'}
          </dt>
          <dd className="mt-1 text-xs leading-5 text-slate-600">{parameter.description}</dd>
          <dd className="mt-1 text-xs leading-5 text-slate-700"><ValueContract spec={parameter.value} /></dd>
        </div>
      ))}
    </dl>
  )
}

function MethodCard({ category, method }: { category: SolverRuleCategory; method: SolverMethodSpec }) {
  return (
    <article className="rounded border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <code className="text-xs font-semibold text-slate-900">{method.methodId}</code>
        <span className="text-[11px] text-slate-500">
          occurrences {method.minimumOccurrences}–{method.maximumOccurrences}
        </span>
      </div>
      <p className="mt-1 text-xs leading-5 text-slate-600">{method.description}</p>
      <p className="mt-2 text-xs text-slate-600">
        Target: {method.target.source}.{method.target.kind} · groups {method.target.minimumTargets}–{method.target.maximumTargets}
        {' · resolved '}{method.target.minimumResolved}–{method.target.maximumResolved}
      </p>
      <h5 className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Parameters</h5>
      <ParameterList parameters={method.parameters} />
      {category === 'recordedData' && method.result ? (
        <div className="mt-3 rounded border border-sky-200 bg-sky-50 p-2 text-xs leading-5 text-sky-950">
          <div className="font-semibold">Result</div>
          <ValueContract spec={method.result} />
        </div>
      ) : null}
    </article>
  )
}

export default function SolverSpecSheet({ solver, spec }: SolverSpecSheetProps) {
  if (!solver) {
    return <div className="grid h-full place-items-center bg-slate-50 text-sm text-slate-500">Waiting for Solver metadata.</div>
  }
  if (!spec) {
    return (
      <div className="grid h-full place-items-center bg-slate-50 px-6 text-center">
        <div>
          <h3 className="text-sm font-semibold text-rose-700">Solver spec unavailable</h3>
          <p className="mt-2 text-xs text-slate-600">No registered spec matches {solver.name}@{solver.version}.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto bg-slate-50 px-4 py-4">
      <header className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">{spec.name}@{spec.version}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">{spec.description}</p>
        <p className="mt-2 text-xs text-slate-500">Undeclared parameter keys are accepted and preserved.</p>
      </header>

      <section className="mt-5">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Solver Parameters</h4>
        <ParameterList parameters={spec.parameters} />
      </section>

      <section className="mt-5">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Material Roles</h4>
        <div className="mt-2 space-y-3">
          {spec.materials.map((material) => (
            <article className="rounded border border-slate-200 bg-white p-3" key={material.role}>
              <h5 className="text-sm font-semibold text-slate-900">{material.role}</h5>
              <p className="mt-1 text-xs leading-5 text-slate-600">{material.description}</p>
              <p className="mt-1 text-xs text-slate-500">
                From {material.target.category}.{material.target.methodId} targets
              </p>
              <ParameterList parameters={material.parameters} />
            </article>
          ))}
          {spec.materials.length === 0 ? <p className="text-xs text-slate-500">No Material roles.</p> : null}
        </div>
      </section>

      {categories.map((category) => (
        <section className="mt-5" key={category.id}>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">{category.label}</h4>
          <div className="mt-2 space-y-3">
            {spec.methods[category.id].map((method) => (
              <MethodCard category={category.id} key={method.methodId} method={method} />
            ))}
            {spec.methods[category.id].length === 0 ? <p className="text-xs text-slate-500">No methods.</p> : null}
          </div>
        </section>
      ))}
    </div>
  )
}

import type { ResolvedExperimentSolver } from '../cad'
import { QuantityKind } from '../quantitykind'
import {
  materialModelByKey,
  materialParameterByKey,
  type MaterialModelKey,
  type MaterialPropertyKey,
} from '../material/data'
import type {
  SolverCompatibility,
  SolverMaterialParameterMap,
  SolverMethodSpec,
  SolverParameterSpec,
  SolverResultValueSpec,
  SolverRuleCategory,
  SolverSpec,
  SolverValueSpec,
} from '../solver'

type SolverSpecSheetProps = Readonly<{
  compatibility: SolverCompatibility
  solver: ResolvedExperimentSolver | null
  spec: SolverSpec | null
}>

const categories: readonly Readonly<{ id: SolverRuleCategory; label: string }>[] = [
  { id: 'initializations', label: 'Initializations' },
  { id: 'boundaryConditions', label: 'Boundary Conditions' },
  { id: 'recordedData', label: 'Recorded Data' },
]

function QuantityContract({ spec }: { spec: Readonly<{
  quantityKind: keyof typeof QuantityKind
  referenceUnit: string
  referenceBasis?: readonly (readonly number[])[]
}> }) {
  const units = QuantityKind[spec.quantityKind].applicableUnits()
  const tensorOrder = QuantityKind[spec.quantityKind].tensorOrder()
  const componentShape = QuantityKind[spec.quantityKind].componentShape()
  return (
    <span>
      <span className="font-medium text-sky-800">{spec.quantityKind}</span>
      {' · reference '}
      <code>{spec.referenceUnit}</code>
      {` · order ${tensorOrder} · components ${JSON.stringify(componentShape)}`}
      {spec.referenceBasis ? ` · reference basis ${JSON.stringify(spec.referenceBasis)}` : ''}
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

function ValueContract({ spec }: { spec: SolverValueSpec | SolverResultValueSpec }) {
  const bounds = 'minimum' in spec || 'maximum' in spec ? boundsText(spec) : ''
  return (
    <div>
      dtype {spec.dtype}
      {'quantityKind' in spec && spec.quantityKind
        ? <><br /><QuantityContract spec={spec as Parameters<typeof QuantityContract>[0]['spec']} /></>
        : null}
      {bounds ? ` · every value ${bounds}` : ''}
      {spec.dtype === 'string' && spec.values ? ` · one of ${spec.values.join(', ')}` : ''}
      {spec.axes?.map((axis, index) => (
        <div className="ml-3 mt-1" key={`${axis.name}-${index}`}>
          axis {index}: {axis.name ?? `axis ${index}`} · length {axis.length ?? 'dynamic'}
          {axis.ticks ? ` · ticks ${JSON.stringify(axis.ticks)}` : ''}
          {axis.quantityKind ? <><br /><QuantityContract spec={axis} /></> : ' · unitless'}
        </div>
      ))}
    </div>
  )
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

function MaterialParameterList({ parameters }: { parameters: SolverMaterialParameterMap }) {
  const entries = Object.entries(parameters)
  if (entries.length === 0) return <p className="mt-2 text-xs text-slate-500">No required parameters.</p>
  return (
    <dl className="mt-2 space-y-2">
      {entries.map(([key, rawParameter]) => {
        const parameter = rawParameter as Readonly<{
          description: string
          required?: boolean
          value: Readonly<Record<string, unknown>>
        }>
        const property = Object.prototype.hasOwnProperty.call(materialParameterByKey, key)
          ? materialParameterByKey[key as MaterialPropertyKey]
          : undefined
        const model = property === undefined
          ? materialModelByKey[key as MaterialModelKey]
          : undefined
        return (
          <div className="rounded border border-slate-200 bg-slate-50 p-2" key={key}>
            <dt className="font-mono text-xs font-semibold text-slate-800">
              {key} · {parameter.required === false ? 'optional' : 'required'}
            </dt>
            <dd className="mt-1 text-xs leading-5 text-slate-600">{parameter.description}</dd>
            <dd className="mt-1 text-xs leading-5 text-slate-700">
              {property ? (
                <ValueContract spec={{
                  ...parameter.value,
                  quantityKind: property.quantity_kind,
                } as SolverValueSpec} />
              ) : model ? (
                <div>
                  sampled relation · at least {model.minimum_samples} samples
                  <br />input · <QuantityContract spec={{
                    quantityKind: model.input.quantity_kind,
                    referenceUnit: parameter.value.input && typeof parameter.value.input === 'object'
                      ? (parameter.value.input as { referenceUnit: string }).referenceUnit
                      : '',
                    ...(
                      parameter.value.input
                      && typeof parameter.value.input === 'object'
                      && 'referenceBasis' in parameter.value.input
                        ? { referenceBasis: (parameter.value.input as { referenceBasis: readonly (readonly number[])[] }).referenceBasis }
                        : {}
                    ),
                  }} />
                  <br />output · <QuantityContract spec={{
                    quantityKind: model.output.quantity_kind,
                    referenceUnit: parameter.value.output && typeof parameter.value.output === 'object'
                      ? (parameter.value.output as { referenceUnit: string }).referenceUnit
                      : '',
                    ...(
                      parameter.value.output
                      && typeof parameter.value.output === 'object'
                      && 'referenceBasis' in parameter.value.output
                        ? { referenceBasis: (parameter.value.output as { referenceBasis: readonly (readonly number[])[] }).referenceBasis }
                        : {}
                    ),
                  }} />
                </div>
              ) : null}
            </dd>
          </div>
        )
      })}
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

export default function SolverSpecSheet({ compatibility, solver, spec }: SolverSpecSheetProps) {
  const issueGroups = ([
    { documentType: 'structure', label: 'Structure' },
    { documentType: 'experiment', label: 'Experiment' },
  ] as const).map((group) => ({
    ...group,
    issues: compatibility.issues.filter((issue) => issue.documentType === group.documentType),
  }))
  const compatibilityPanel = (
    <section
      aria-label="Solver compatibility details"
      className={`rounded-lg border p-4 ${
        compatibility.status === 'compatible'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
          : compatibility.status === 'incompatible'
            ? 'border-amber-300 bg-amber-50 text-amber-950'
            : 'border-slate-200 bg-white text-slate-700'
      }`}
      role="status"
    >
      <h3 className="text-sm font-semibold">
        {compatibility.status === 'compatible'
          ? 'Simulation compatible'
          : compatibility.status === 'incompatible'
            ? `Simulation incompatible · ${compatibility.issues.length} issue${compatibility.issues.length === 1 ? '' : 's'}`
            : compatibility.status === 'checking'
              ? 'Checking simulation compatibility'
              : 'Simulation unavailable'}
      </h3>
      {compatibility.status === 'incompatible' ? (
        <div className="mt-3 space-y-3">
          {issueGroups.map((group) => group.issues.length === 0 ? null : (
            <div key={group.documentType}>
              <h4 className="text-xs font-semibold uppercase tracking-wide">{group.label}</h4>
              <ul className="mt-1 space-y-1 text-xs leading-5">
                {group.issues.map((issue, index) => (
                  <li key={`${issue.path}-${index}`}>
                    <code className="rounded bg-white/70 px-1 py-0.5">{issue.path}</code>: {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-xs leading-5">
          {compatibility.status === 'compatible'
            ? 'The latest Structure and Experiment snapshots satisfy the registered Solver specification.'
            : compatibility.status === 'checking'
              ? 'Waiting for the latest snapshots and Solver preflight result.'
              : 'Evaluate an Experiment with Solver metadata to check compatibility.'}
        </p>
      )}
    </section>
  )

  return (
    <div className="h-full overflow-auto bg-slate-50 px-4 py-4">
      {compatibilityPanel}

      {!solver ? (
        <div className="grid min-h-48 place-items-center px-6 text-center text-sm text-slate-500">
          Waiting for Solver metadata.
        </div>
      ) : !spec ? (
        <div className="grid min-h-48 place-items-center px-6 text-center">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Solver specification unavailable</h3>
            <p className="mt-2 text-xs text-slate-600">No registered spec matches {solver.name}@{solver.version}.</p>
          </div>
        </div>
      ) : (
        <>
          <header className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
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
                  <MaterialParameterList parameters={material.parameters} />
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
        </>
      )}
    </div>
  )
}

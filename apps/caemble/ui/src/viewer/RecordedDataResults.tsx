import { Component, lazy, Suspense, useMemo, useState, type ReactNode } from 'react'
import type { RecordedDataRule } from '../cad'
import {
  isNumericRecordedDType,
  resolveCadViewerRecordedData,
  type CadViewerRecordedData,
  type ResolvedRecordedTensor,
} from './recordedData'

const Plot = lazy(async () => {
  const [factoryModule, plotlyModule] = await Promise.all([
    import('react-plotly.js/factory'),
    import('plotly.js'),
  ])
  const plotly = (plotlyModule as unknown as { default?: unknown }).default ?? plotlyModule
  return { default: factoryModule.default(plotly) }
})

type RecordedDataResultsProps = {
  recordedData?: CadViewerRecordedData | null
  rules: readonly RecordedDataRule[]
}

class PlotErrorBoundary extends Component<
  { children: ReactNode },
  { message: string | null }
> {
  state = { message: null }

  static getDerivedStateFromError(error: Error) {
    return { message: error.message }
  }

  render() {
    if (this.state.message) {
      return <div className="rounded bg-rose-50 p-3 text-sm text-rose-700" role="alert">{this.state.message}</div>
    }
    return this.props.children
  }
}

function tickText(ticks: readonly (number | string)[]) {
  return ticks.map(String)
}

function schemaAxis(rule: RecordedDataRule, axisIndex: number) {
  return {
    name: rule.result.axes?.[axisIndex]?.name ?? `axis ${axisIndex}`,
    ticks: rule.result.axes?.[axisIndex]?.ticks,
    unit: rule.result.axes?.[axisIndex]?.unit,
  }
}

function unitLabel(unit: string | undefined) {
  return unit ?? 'unitless'
}

function axisTitle(rule: RecordedDataRule, axisIndex: number) {
  const axis = schemaAxis(rule, axisIndex)
  return `${axis.name} (${unitLabel(axis.unit)})`
}

function visualizationKind(rule: RecordedDataRule) {
  if (rule.result.dimension === 0) return 'scalar'
  if (!isNumericRecordedDType(rule.result.dtype)) return 'table'
  return rule.result.dimension === 1 ? 'line chart' : 'heatmap'
}

function EmptyPlot({ rule }: { rule: RecordedDataRule }) {
  const kind = visualizationKind(rule)
  return (
    <div
      aria-label={`${rule.label} empty ${kind}`}
      className="relative grid min-h-56 place-items-center overflow-hidden rounded border border-dashed border-slate-300 bg-slate-50"
      data-result-visualization={kind}
    >
      <div className="absolute inset-x-4 bottom-3 truncate text-center text-[10px] text-slate-400">
        {rule.result.dimension === 0
          ? '0D scalar'
          : axisTitle(rule, rule.result.dimension - 1)}
      </div>
      {rule.result.dimension >= 2 ? (
        <div className="absolute bottom-8 left-2 top-2 flex items-center text-[10px] text-slate-400 [writing-mode:vertical-rl]">
          {axisTitle(rule, rule.result.dimension - 2)}
        </div>
      ) : null}
      <div className="text-center">
        <div className="text-sm font-semibold text-slate-500">No recorded data</div>
        <div className="mt-1 text-xs text-slate-400">Empty {kind} · expected {JSON.stringify(rule.result.shape)}</div>
      </div>
    </div>
  )
}

function PlotlyFigure({
  data,
  label,
  layout,
}: {
  data: unknown[]
  label: string
  layout: Record<string, unknown>
}) {
  const [error, setError] = useState<string | null>(null)
  if (error) return <div className="rounded bg-rose-50 p-3 text-sm text-rose-700" role="alert">{error}</div>

  return (
    <PlotErrorBoundary>
      <Suspense
        fallback={(
          <div className="grid min-h-72 place-items-center rounded border border-slate-200 bg-slate-50 text-sm text-slate-500">
            Loading {label}...
          </div>
        )}
      >
        <Plot
          config={{ displaylogo: false, responsive: true, scrollZoom: true }}
          data={data}
          layout={{
            autosize: true,
            margin: { b: 64, l: 72, r: 24, t: 20 },
            paper_bgcolor: '#ffffff',
            plot_bgcolor: '#f8fafc',
            ...layout,
          }}
          style={{ height: '320px', width: '100%' }}
          useResizeHandler
          onError={(plotError: Error) => setError(plotError.message)}
        />
      </Suspense>
    </PlotErrorBoundary>
  )
}

function getSlice(value: ResolvedRecordedTensor['value'], indices: readonly number[]) {
  return indices.reduce<unknown>((slice, index) => (slice as readonly unknown[])[index], value)
}

function MatrixTable({ rule, tensor, value }: { rule: RecordedDataRule; tensor: ResolvedRecordedTensor; value: unknown }) {
  if (tensor.shape.length === 1) {
    const axis = tensor.axes[0]
    return (
      <div className="max-h-80 overflow-auto rounded border border-slate-200">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 bg-slate-100 text-slate-600">
            <tr>
              <th className="px-3 py-2">{axisTitle(rule, 0)}</th>
              <th className="px-3 py-2">Value ({unitLabel(rule.result.unit)})</th>
            </tr>
          </thead>
          <tbody>
            {(value as readonly unknown[]).map((item, index) => (
              <tr className="border-t border-slate-100" key={index}>
                <td className="px-3 py-2">{String(axis.ticks[index])}</td>
                <td className="px-3 py-2 font-mono">{String(item)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const rowAxis = tensor.axes[tensor.axes.length - 2]
  const columnAxis = tensor.axes[tensor.axes.length - 1]
  return (
    <div className="max-h-80 overflow-auto rounded border border-slate-200">
      <table className="min-w-full border-collapse text-center text-xs">
        <thead className="sticky top-0 bg-slate-100 text-slate-600">
          <tr>
            <th className="px-3 py-2">
              {axisTitle(rule, tensor.axes.length - 2)} / {axisTitle(rule, tensor.axes.length - 1)}
            </th>
            {columnAxis.ticks.map((tick, index) => <th className="px-3 py-2" key={index}>{String(tick)}</th>)}
          </tr>
        </thead>
        <tbody>
          {(value as readonly (readonly unknown[])[]).map((row, rowIndex) => (
            <tr className="border-t border-slate-100" key={rowIndex}>
              <th className="sticky left-0 bg-white px-3 py-2 text-slate-600">{String(rowAxis.ticks[rowIndex])}</th>
              {row.map((item, columnIndex) => (
                <td className="px-3 py-2 font-mono" key={columnIndex}>{String(item)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TensorVisualization({ rule, tensor }: { rule: RecordedDataRule; tensor: ResolvedRecordedTensor }) {
  const leadingAxisCount = Math.max(0, tensor.shape.length - 2)
  const [sliceIndices, setSliceIndices] = useState(() => Array.from({ length: leadingAxisCount }, () => 0))
  const safeIndices = sliceIndices.map((index, axisIndex) => Math.min(index, Math.max(0, tensor.shape[axisIndex] - 1)))
  const value = getSlice(tensor.value, safeIndices)

  if (tensor.shape.length === 0) {
    return (
      <div
        aria-label="Recorded scalar value"
        className="flex min-h-32 items-baseline justify-center gap-2 rounded border border-slate-200 bg-slate-50 font-mono text-3xl text-slate-900"
        data-result-visualization="scalar"
      >
        <span>{String(tensor.value)}</span>
        <span className="text-base text-slate-500">{unitLabel(rule.result.unit)}</span>
      </div>
    )
  }

  if (tensor.shape.some((size) => size === 0)) {
    return (
      <div className="grid min-h-56 place-items-center rounded border border-dashed border-slate-300 bg-slate-50 text-center">
        <div>
          <div className="text-sm font-semibold text-slate-500">No recorded values</div>
          <div className="mt-1 text-xs text-slate-400">Resolved empty tensor · actual {JSON.stringify(tensor.shape)}</div>
        </div>
      </div>
    )
  }

  const controls = leadingAxisCount > 0 ? (
    <div className="mb-3 flex flex-wrap gap-3">
      {Array.from({ length: leadingAxisCount }, (_, axisIndex) => {
        const axis = tensor.axes[axisIndex]
        return (
          <label className="text-xs font-medium text-slate-600" key={axisIndex}>
            <span className="mr-2">{axisTitle(rule, axisIndex)}</span>
            <select
              aria-label={`Select ${axis.name} slice`}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
              disabled={axis.ticks.length === 0}
              value={safeIndices[axisIndex] ?? 0}
              onChange={(event) => setSliceIndices((current) => current.map(
                (index, indexAxis) => indexAxis === axisIndex ? Number(event.target.value) : index,
              ))}
            >
              {axis.ticks.length === 0 ? <option value={0}>No values</option> : null}
              {axis.ticks.map((tick, index) => (
                <option key={index} value={index}>{index}: {String(tick)}</option>
              ))}
            </select>
          </label>
        )
      })}
    </div>
  ) : null

  if (!isNumericRecordedDType(tensor.dtype)) {
    return <>{controls}<MatrixTable rule={rule} tensor={tensor} value={value} /></>
  }

  if (tensor.shape.length === 1) {
    const axis = tensor.axes[0]
    const values = value as readonly number[]
    return (
      <PlotlyFigure
        label="line chart"
        data={[{
          hovertemplate: `${axisTitle(rule, 0)}: %{customdata}<br>value (${unitLabel(rule.result.unit)}): %{y}<extra></extra>`,
          customdata: tickText(axis.ticks),
          mode: 'lines+markers',
          type: 'scatter',
          x: values.map((_, index) => index),
          y: values,
        }]}
        layout={{
          xaxis: { title: axisTitle(rule, 0), tickmode: 'array', ticktext: tickText(axis.ticks), tickvals: values.map((_, i) => i) },
          yaxis: { title: `Value (${unitLabel(rule.result.unit)})` },
        }}
      />
    )
  }

  const rowAxis = tensor.axes[tensor.axes.length - 2]
  const columnAxis = tensor.axes[tensor.axes.length - 1]
  const matrix = value as readonly (readonly number[])[]
  return (
    <>
      {controls}
      <PlotlyFigure
        label="heatmap"
        data={[{
          colorscale: 'Viridis',
          colorbar: { title: unitLabel(rule.result.unit) },
          customdata: matrix.map((row, rowIndex) => row.map((_, columnIndex) => [
            rowAxis.ticks[rowIndex],
            columnAxis.ticks[columnIndex],
          ])),
          hovertemplate: `${axisTitle(rule, tensor.axes.length - 2)}: %{customdata[0]}<br>${axisTitle(rule, tensor.axes.length - 1)}: %{customdata[1]}<br>value (${unitLabel(rule.result.unit)}): %{z}<extra></extra>`,
          type: 'heatmap',
          x: columnAxis.ticks.map((_, index) => index),
          y: rowAxis.ticks.map((_, index) => index),
          z: matrix,
        }]}
        layout={{
          xaxis: {
            title: axisTitle(rule, tensor.axes.length - 1),
            tickmode: 'array',
            ticktext: tickText(columnAxis.ticks),
            tickvals: columnAxis.ticks.map((_, index) => index),
          },
          yaxis: {
            autorange: 'reversed',
            title: axisTitle(rule, tensor.axes.length - 2),
            tickmode: 'array',
            ticktext: tickText(rowAxis.ticks),
            tickvals: rowAxis.ticks.map((_, index) => index),
          },
        }}
      />
    </>
  )
}

function RecordedResultCard({
  entry,
}: {
  entry: ReturnType<typeof resolveCadViewerRecordedData>['entries'][number]
}) {
  const { error, rule, tensor } = entry
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{rule.label}</h3>
          <p className="mt-1 font-mono text-xs text-slate-500">{rule.methodId}</p>
        </div>
        <div className="text-right font-mono text-xs text-slate-500">
          <div>{rule.result.dtype} · {rule.result.dimension}D · {unitLabel(rule.result.unit)}</div>
          <div>expected {JSON.stringify(rule.result.shape)}</div>
          {tensor ? <div>actual {JSON.stringify(tensor.shape)}</div> : null}
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
        {Array.from({ length: rule.result.dimension }, (_, axisIndex) => {
          const axis = schemaAxis(rule, axisIndex)
          return (
            <div className="rounded bg-slate-50 px-3 py-2" key={axisIndex}>
              <span className="font-semibold text-slate-700">{axis.name}</span>{' · '}
              <span>{unitLabel(axis.unit)}</span>{' · '}
              <span className="font-mono">
                {tensor
                  ? JSON.stringify(tensor.axes[axisIndex].ticks)
                  : axis.ticks
                    ? JSON.stringify(axis.ticks)
                    : 'dynamic ticks from result'}
              </span>
            </div>
          )
        })}
      </div>

      {error ? <div className="mt-3 rounded bg-rose-50 p-3 text-xs text-rose-700" role="alert">{error}</div> : null}
      <div className="mt-4">
        {tensor ? (
          <TensorVisualization
            key={`${rule.result.dtype}-${JSON.stringify(tensor.shape)}`}
            rule={rule}
            tensor={tensor}
          />
        ) : <EmptyPlot rule={rule} />}
      </div>
    </article>
  )
}

export function RecordedDataResults({ recordedData, rules }: RecordedDataResultsProps) {
  const resolved = useMemo(
    () => resolveCadViewerRecordedData(rules, recordedData),
    [recordedData, rules],
  )

  return (
    <section aria-label="Recorded Data Results" className="h-full overflow-auto bg-slate-50 p-4 sm:p-5">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-900">Results</h2>
          <p className="mt-1 text-sm text-slate-500">
            Read-only tensor snapshots matched to Experiment recordedData labels.
          </p>
        </div>

        {resolved.error ? <div className="mb-4 rounded bg-rose-50 p-3 text-sm text-rose-700" role="alert">{resolved.error}</div> : null}
        {resolved.unknownLabels.length > 0 ? (
          <div className="mb-4 rounded bg-amber-50 p-3 text-sm text-amber-800" role="alert">
            Unknown recordedData labels: {resolved.unknownLabels.join(', ')}
          </div>
        ) : null}

        <div className="space-y-4">
          {resolved.entries.map((entry) => <RecordedResultCard entry={entry} key={entry.rule.label} />)}
        </div>
      </div>
    </section>
  )
}

export default RecordedDataResults

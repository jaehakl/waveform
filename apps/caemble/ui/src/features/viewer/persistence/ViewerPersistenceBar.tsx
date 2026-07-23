import { Database, Dices, FlaskConical, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { SampleRecord, SetupRecord } from '@/api'
import { caembleExamples } from '@/lib/examples'

function ResourceSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string
  onChange: (value: string) => void
  options: readonly { id?: number; label: string }[]
  value?: number | null
}) {
  return (
    <Select onValueChange={onChange} value={value == null ? '' : String(value)}>
      <SelectTrigger aria-label={label} className="h-8 max-w-52 min-w-40 bg-background text-xs">
        <SelectValue placeholder={`${label} 열기`} />
      </SelectTrigger>
      <SelectContent>
        {options
          .filter((option) => option.id)
          .map((option) => (
            <SelectItem key={option.id} value={String(option.id)}>
              {option.label}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  )
}

export function ViewerPersistenceBar({
  currentExampleId,
  currentExperimentName,
  currentStructureName,
  onExampleChange,
  onLoadSample,
  onLoadSetup,
  onSaveExperiment,
  onSaveSample,
  onSaveSetup,
  onSaveStructure,
  realizationPending,
  sampleReady,
  sampleUnavailableReason,
  samples,
  selectedSampleId,
  selectedSetupId,
  setupReady,
  setupUnavailableReason,
  setups,
}: {
  currentExampleId: string
  currentExperimentName: string | null
  currentStructureName: string | null
  onExampleChange: (id: string) => void
  onLoadSample: (id: number) => void
  onLoadSetup: (id: number) => void
  onSaveExperiment: () => void
  onSaveSample: () => void
  onSaveSetup: () => void
  onSaveStructure: () => void
  realizationPending: boolean
  sampleReady: boolean
  sampleUnavailableReason: string | null
  samples: readonly SampleRecord[]
  selectedSampleId: number | null
  selectedSetupId: number | null
  setupReady: boolean
  setupUnavailableReason: string | null
  setups: readonly SetupRecord[]
}) {
  return (
    <div className="flex shrink-0 items-center gap-3 overflow-x-auto border-b bg-muted/20 px-3 py-2 text-xs">
      <div className="flex shrink-0 items-center gap-2 border-r pr-3">
        <Dices className="size-4 text-muted-foreground" />
        <Select onValueChange={onExampleChange} value={currentExampleId}>
          <SelectTrigger aria-label="Structure 예제" className="h-8 w-52 bg-background text-xs">
            <SelectValue placeholder="Custom Structure" />
          </SelectTrigger>
          <SelectContent>
            {caembleExamples.map((example) => (
              <SelectItem key={example.id} value={example.id}>
                {example.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex shrink-0 items-center gap-2 rounded-md border bg-background p-1">
        <span className="flex items-center gap-1 px-1 font-semibold">
          <Database className="size-3.5 text-primary" />
          현재 Structure
        </span>
        <span
          aria-label="현재 Structure 이름"
          className="h-7 max-w-52 min-w-40 truncate rounded border bg-muted/30 px-2 py-1 text-foreground"
          title={currentStructureName ?? '선택 없음'}
        >
          {currentStructureName ?? '선택 없음'}
        </span>
        <Button className="h-7" size="sm" variant="outline" onClick={onSaveStructure}>
          <Save />
          정의 저장
        </Button>
        <ResourceSelect
          label="Sample"
          onChange={(value) => onLoadSample(Number(value))}
          options={samples.map((row) => ({ id: row.id, label: `Sample #${row.id}` }))}
          value={selectedSampleId}
        />
        <Button
          className="h-7"
          disabled={!sampleReady || realizationPending}
          size="sm"
          title={
            !sampleReady
              ? (sampleUnavailableReason ?? '로그인이 필요합니다.')
              : '현재 평가된 vars를 새 Sample로 저장합니다.'
          }
          onClick={onSaveSample}
        >
          <Dices />
          Sample 저장
        </Button>
      </div>
      <div className="flex shrink-0 items-center gap-2 rounded-md border bg-background p-1">
        <span className="flex items-center gap-1 px-1 font-semibold">
          <FlaskConical className="size-3.5 text-primary" />
          현재 Experiment
        </span>
        <span
          aria-label="현재 Experiment 이름"
          className="h-7 max-w-52 min-w-40 truncate rounded border bg-muted/30 px-2 py-1 text-foreground"
          title={currentExperimentName ?? '선택 없음'}
        >
          {currentExperimentName ?? '선택 없음'}
        </span>
        <Button className="h-7" size="sm" variant="outline" onClick={onSaveExperiment}>
          <Save />
          정의 저장
        </Button>
        <ResourceSelect
          label="Setup"
          onChange={(value) => onLoadSetup(Number(value))}
          options={setups.map((row) => ({ id: row.id, label: `Setup #${row.id}` }))}
          value={selectedSetupId}
        />
        <Button
          className="h-7"
          disabled={!setupReady || realizationPending}
          size="sm"
          title={
            !setupReady
              ? (setupUnavailableReason ?? '로그인이 필요합니다.')
              : '현재 평가된 vars를 새 Setup으로 저장합니다.'
          }
          onClick={onSaveSetup}
        >
          <Dices />
          Setup 저장
        </Button>
      </div>
    </div>
  )
}

export type CaembleProgramExample = Readonly<{
  id: string
  title: string
  description: string
  concepts: readonly string[]
  structureCode: string
  experimentCode: string
  verification: Readonly<{
    kernelTasks: readonly string[]
    outputs: readonly string[]
    expectations: readonly string[]
  }>
}>

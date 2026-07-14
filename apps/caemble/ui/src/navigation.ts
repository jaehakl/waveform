export type AppView = 'experiment' | 'help' | 'structure'

export const viewHashes: Readonly<Record<AppView, string>> = {
  structure: '#structure',
  experiment: '#experiment',
  help: '#help',
}

export function appViewFromHash(hash: string): AppView {
  if (hash === viewHashes.experiment) return 'experiment'
  if (hash === viewHashes.help) return 'help'
  return 'structure'
}

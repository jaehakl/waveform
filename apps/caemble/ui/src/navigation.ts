export type AppView = 'help' | 'viewer'

export const viewHashes: Readonly<Record<AppView, string>> = {
  viewer: '#viewer',
  help: '#help',
}

export function appViewFromHash(hash: string): AppView {
  return hash === viewHashes.help ? 'help' : 'viewer'
}

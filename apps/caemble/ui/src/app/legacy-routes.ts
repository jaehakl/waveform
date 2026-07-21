export function redirectLegacyHash(location: Pick<Location, 'hash' | 'pathname' | 'search'>, history: Pick<History, 'replaceState'>) {
  if (location.pathname !== '/') return
  const target = location.hash === '#viewer'
    ? '/viewer'
    : location.hash === '#help'
      ? '/docs'
      : null
  if (target) history.replaceState(null, '', `${target}${location.search}`)
}

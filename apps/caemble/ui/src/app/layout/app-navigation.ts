import {
  Atom,
  BookOpenText,
  Box,
  Boxes,
  FlaskConical,
  Gauge,
  Home,
  Layers3,
  type LucideIcon,
} from 'lucide-react'

export type AppNavigationItem = Readonly<{
  href: string
  icon: LucideIcon
  label: string
}>

export const primaryNavigation: readonly AppNavigationItem[] = [
  { href: '/', icon: Home, label: '홈' },
  { href: '/viewer', icon: Box, label: 'Viewer' },
  { href: '/docs', icon: BookOpenText, label: '문서' },
]

export const catalogNavigation: readonly AppNavigationItem[] = [
  { href: '/catalog/cad', icon: Boxes, label: 'CAD 요소' },
  { href: '/catalog/materials', icon: Layers3, label: 'Material' },
  { href: '/catalog/quantity-kinds', icon: Gauge, label: 'Quantity Kind' },
  { href: '/catalog/solvers', icon: FlaskConical, label: 'Solver' },
]

export const brandIcon = Atom

import {
  Atom,
  BookOpenText,
  Box,
  Boxes,
  Database,
  FlaskConical,
  Gauge,
  GitBranch,
  Home,
  Layers3,
  TestTubeDiagonal,
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
  { href: '/structures', icon: GitBranch, label: 'Structures' },
  { href: '/experiments', icon: TestTubeDiagonal, label: 'Experiments' },
  { href: '/materials', icon: Database, label: 'Materials' },
  { href: '/docs', icon: BookOpenText, label: 'Manual' },
]

export const catalogNavigation: readonly AppNavigationItem[] = [
  { href: '/catalog/cad', icon: Boxes, label: 'Geometry' },
  { href: '/catalog/materials', icon: Layers3, label: 'Material Catalog' },
  { href: '/catalog/quantity-kinds', icon: Gauge, label: 'Quantity' },
  { href: '/catalog/solvers', icon: FlaskConical, label: 'Physics' },
]

export const brandIcon = Atom

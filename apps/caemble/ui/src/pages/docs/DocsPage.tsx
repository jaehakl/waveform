import { PageHeader } from '@/components/PageHeader'
import SyntaxHelp from './SyntaxHelp'

export function DocsPage() {
  return <div className="py-8"><div className="mx-auto max-w-6xl px-6"><PageHeader description="Structure·Experiment 작성, Quantity Kind, Material, Solver 실행 계약을 설명합니다." eyebrow="Documentation" title="Code-to-CAD 개발 문서" /></div><SyntaxHelp /></div>
}

export const Component = DocsPage

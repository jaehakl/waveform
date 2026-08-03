import { BookOpenText, Workflow } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import SyntaxHelp from './SyntaxHelp'
import { V3ExperimentGuide } from './V3ExperimentGuide'

export function DocsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const section = searchParams.get('section') === 'reference' ? 'reference' : 'v3'

  return (
    <div className="min-h-full bg-white">
      <div className="sticky top-0 z-20 border-b bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
          <Button
            aria-pressed={section === 'v3'}
            size="sm"
            variant={section === 'v3' ? 'default' : 'ghost'}
            onClick={() => setSearchParams({ section: 'v3' }, { replace: true })}
          >
            <Workflow />
            Experiment Program v3
          </Button>
          <Button
            aria-pressed={section === 'reference'}
            size="sm"
            variant={section === 'reference' ? 'default' : 'ghost'}
            onClick={() => setSearchParams({ section: 'reference' }, { replace: true })}
          >
            <BookOpenText />
            CAD·v2 Reference
          </Button>
        </div>
      </div>
      {section === 'v3' ? <V3ExperimentGuide /> : <SyntaxHelp />}
    </div>
  )
}

export const Component = DocsPage

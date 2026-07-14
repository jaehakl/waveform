import Editor, { type BeforeMount, type OnMount } from '@monaco-editor/react'
import { setupMonaco } from './monacoSetup'

type CadEditorProps = {
  onChange: (value: string) => void
  onMount?: OnMount
  value: string
}

function CadEditor({ onChange, onMount, value }: CadEditorProps) {
  const handleBeforeMount: BeforeMount = (monaco) => {
    setupMonaco(monaco)
  }

  return (
    <Editor
      beforeMount={handleBeforeMount}
      defaultLanguage="typescript"
      height="100%"
      onMount={onMount}
      onChange={(nextValue) => {
        onChange(nextValue ?? '')
      }}
      options={{
        automaticLayout: true,
        fontFamily: 'JetBrains Mono, Consolas, Monaco, monospace',
        fontSize: 13,
        lineNumbersMinChars: 3,
        minimap: { enabled: false },
        padding: { top: 14 },
        scrollBeyondLastLine: false,
        tabSize: 2,
        wordWrap: 'on',
      }}
      path="file:///model.tsx"
      theme="vs-light"
      value={value}
    />
  )
}

export default CadEditor

import { forwardRef } from 'react'
import Editor from '@monaco-editor/react'

export const MonacoEditor = forwardRef(({ value, onChange, language = 'python', theme = 'vs-dark', ...props }, ref) => {
  return (
    <div className="h-full w-full">
      <Editor
        ref={ref}
        value={value}
        onChange={onChange}
        language={language}
        theme={theme}
        options={{
          fontSize: 14,
          fontFamily: '"Press Start 2P", ui-monospace, SFMono-Regular, Menlo, monospace',
          minimap: { enabled: false },
          wordWrap: 'on',
          automaticLayout: true,
          scrollBeyondLastLine: false,
          ...props.options,
        }}
        {...props}
      />
    </div>
  )
})

MonacoEditor.displayName = 'MonacoEditor'

import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'

import { ensureMmlLanguage } from './mmlLanguage'

type MonacoModule = typeof import('monaco-editor/esm/vs/editor/editor.api')

let monacoPromise: Promise<MonacoModule> | null = null
let environmentConfigured = false

function ensureMonacoEnvironment(): void {
  if (environmentConfigured) return

  const target = globalThis as typeof globalThis & {
    MonacoEnvironment?: {
      getWorker: (_moduleId: string, _label: string) => Worker
    }
  }

  target.MonacoEnvironment = {
    getWorker() {
      return new EditorWorker()
    }
  }
  environmentConfigured = true
}

export async function loadMonaco(): Promise<MonacoModule> {
  ensureMonacoEnvironment()

  if (!monacoPromise) {
    monacoPromise = import('monaco-editor/esm/vs/editor/edcore.main') as Promise<MonacoModule>
    monacoPromise = monacoPromise.then(monaco => {
      ensureMmlLanguage(monaco)
      return monaco
    })
  }

  return monacoPromise
}

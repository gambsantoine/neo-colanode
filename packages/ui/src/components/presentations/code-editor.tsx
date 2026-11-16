import type { editor as MonacoEditor } from 'monaco-editor';
import { MutableRefObject, useEffect, useRef, useState } from 'react';

import { loadMonaco, Monaco } from '@colanode/ui/lib/monaco';
import { cn } from '@colanode/ui/lib/utils';

export interface CodeEditorHandle {
  focus: () => void;
  hasFocus: () => boolean;
  // 0-based line.
  setCursorLine: (line: number) => void;
  // Replaces the whole text as one edit: Ctrl+Z restores the previous one.
  replaceAll: (text: string) => void;
}

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  dark?: boolean;
  language?: string;
  placeholder?: string;
  // 0-based line of the cursor.
  onCursorLineChange?: (line: number) => void;
  // F5: from the start, Shift+F5: from the current slide.
  onPresent?: (fromCurrent: boolean) => void;
  handleRef?: MutableRefObject<CodeEditorHandle | null>;
  className?: string;
}

// Smallest edit turning `from` into `to` (common prefix and suffix kept), so
// changes from collaborators don't move the cursor nor reset the view.
const diffRange = (from: string, to: string) => {
  let start = 0;
  const max = Math.min(from.length, to.length);
  while (start < max && from.charCodeAt(start) === to.charCodeAt(start)) {
    start++;
  }

  let endFrom = from.length;
  let endTo = to.length;
  while (
    endFrom > start &&
    endTo > start &&
    from.charCodeAt(endFrom - 1) === to.charCodeAt(endTo - 1)
  ) {
    endFrom--;
    endTo--;
  }

  return { start, end: endFrom, text: to.slice(start, endTo) };
};

// The Monaco editor (VS Code): line numbers, minimap, find and replace
// (Ctrl+F / Ctrl+H), multiple cursors (Alt+click), folding, command palette
// (F1)...
export const CodeEditor = ({
  value,
  onChange,
  readOnly = false,
  dark = false,
  language = 'markdown',
  placeholder,
  onCursorLineChange,
  onPresent,
  handleRef,
  className,
}: CodeEditorProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const applyingRef = useRef(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading'
  );

  const callbacksRef = useRef({ onChange, onCursorLineChange, onPresent });
  callbacksRef.current = { onChange, onCursorLineChange, onPresent };
  const initialRef = useRef({ value, readOnly, dark, language, placeholder });

  useEffect(() => {
    let disposed = false;

    loadMonaco()
      .then((monaco) => {
        const container = containerRef.current;
        if (disposed || !container) {
          return;
        }

        const initial = initialRef.current;
        monacoRef.current = monaco;
        const editor = monaco.editor.create(container, {
          value: initial.value,
          language: initial.language,
          theme: initial.dark ? 'vs-dark' : 'vs',
          readOnly: initial.readOnly,
          placeholder: initial.placeholder,
          automaticLayout: true,
          fontSize: 13,
          lineHeight: 20,
          tabSize: 2,
          insertSpaces: true,
          wordWrap: 'on',
          minimap: { enabled: true, renderCharacters: false },
          scrollBeyondLastLine: false,
          padding: { top: 12, bottom: 12 },
          bracketPairColorization: { enabled: true },
          guides: { indentation: true, bracketPairs: true },
          renderWhitespace: 'selection',
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          // Dropped files are imported by the presentation, not inserted.
          dropIntoEditor: { enabled: false },
          fixedOverflowWidgets: true,
        });
        editorRef.current = editor;

        editor.onDidChangeModelContent(() => {
          if (!applyingRef.current) {
            callbacksRef.current.onChange(editor.getValue());
          }
        });

        editor.onDidChangeCursorPosition((event) => {
          callbacksRef.current.onCursorLineChange?.(
            event.position.lineNumber - 1
          );
        });

        editor.addCommand(monaco.KeyCode.F5, () =>
          callbacksRef.current.onPresent?.(false)
        );
        editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.F5, () =>
          callbacksRef.current.onPresent?.(true)
        );

        if (handleRef) {
          handleRef.current = {
            focus: () => editor.focus(),
            hasFocus: () => editor.hasTextFocus(),
            setCursorLine: (line) => {
              editor.setPosition({ lineNumber: line + 1, column: 1 });
              editor.revealLineInCenterIfOutsideViewport(line + 1);
              editor.focus();
            },
            replaceAll: (text) => {
              const model = editor.getModel();
              if (!model) {
                return;
              }

              editor.pushUndoStop();
              editor.executeEdits('import', [
                { range: model.getFullModelRange(), text },
              ]);
              editor.pushUndoStop();
              editor.setPosition({ lineNumber: 1, column: 1 });
              editor.revealLine(1);
            },
          };
        }

        setStatus('ready');
      })
      .catch(() => {
        if (!disposed) {
          setStatus('error');
        }
      });

    return () => {
      disposed = true;
      if (handleRef) {
        handleRef.current = null;
      }

      editorRef.current?.getModel()?.dispose();
      editorRef.current?.dispose();
      editorRef.current = null;
    };
  }, [handleRef]);

  // Changes made outside of the editor (collaborators).
  useEffect(() => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!editor || !model) {
      return;
    }

    const current = model.getValue();
    if (current === value) {
      return;
    }

    const { start, end, text } = diffRange(current, value);
    const from = model.getPositionAt(start);
    const to = model.getPositionAt(end);
    applyingRef.current = true;
    try {
      model.applyEdits([
        {
          range: {
            startLineNumber: from.lineNumber,
            startColumn: from.column,
            endLineNumber: to.lineNumber,
            endColumn: to.column,
          },
          text,
          forceMoveMarkers: true,
        },
      ]);
    } finally {
      applyingRef.current = false;
    }
  }, [value, status]);

  useEffect(() => {
    editorRef.current?.updateOptions({ readOnly, placeholder });
  }, [readOnly, placeholder, status]);

  useEffect(() => {
    if (status === 'ready') {
      monacoRef.current?.editor.setTheme(dark ? 'vs-dark' : 'vs');
    }
  }, [dark, status]);

  useEffect(() => {
    const model = editorRef.current?.getModel();
    if (model && model.getLanguageId() !== language) {
      monacoRef.current?.editor.setModelLanguage(model, language);
    }
  }, [language, status]);

  return (
    <div className={cn('relative min-h-0', className)}>
      <div ref={containerRef} className="absolute inset-0" />
      {status !== 'ready' && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          {status === 'loading'
            ? 'Loading the editor…'
            : 'The editor could not be loaded.'}
        </div>
      )}
    </div>
  );
};

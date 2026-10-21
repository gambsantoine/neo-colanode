import { type NodeViewProps } from '@tiptap/core';
import { NodeViewWrapper, useEditorState } from '@tiptap/react';
import { Pencil, Workflow } from 'lucide-react';
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useRef,
  useState,
} from 'react';

import { PlantUmlPreview } from '@colanode/ui/components/plantuml/plantuml-preview';
import { Button } from '@colanode/ui/components/ui/button';
import { DEFAULT_PLANTUML_CODE } from '@colanode/ui/lib/plantuml';
import { cn } from '@colanode/ui/lib/utils';

// Ids of freshly inserted PlantUML blocks whose code editor should open as
// soon as their node view mounts (set by the slash command).
const pendingEdits = new Set<string>();

export const requestPlantUmlEdit = (id: string) => {
  pendingEdits.add(id);
};

const hasPendingEdit = (id: string | null): boolean =>
  id !== null && pendingEdits.has(id);

const INDENT = '  ';

export const PlantUmlNodeView = ({
  node,
  editor,
  updateAttributes,
}: NodeViewProps) => {
  const id = (node.attrs.id as string | null) ?? null;
  const code = (node.attrs.code as string | null) ?? '';

  const isEditable = useEditorState({
    editor,
    selector: ({ editor }) => editor?.isEditable ?? false,
  });

  const [editing, setEditing] = useState(
    () => hasPendingEdit(id) && editor.isEditable
  );
  const [draft, setDraft] = useState(code || DEFAULT_PLANTUML_CODE);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // A read-only editor never shows the code editor.
  const showEditor = editing && isEditable;

  useEffect(() => {
    if (id) {
      pendingEdits.delete(id);
    }
  }, [id]);

  useEffect(() => {
    if (showEditor) {
      textareaRef.current?.focus();
    }
  }, [showEditor]);

  const openEditor = () => {
    if (!editor.isEditable) {
      return;
    }

    setDraft(code || DEFAULT_PLANTUML_CODE);
    setEditing(true);
  };

  const save = () => {
    if (editor.isEditable && draft !== code) {
      updateAttributes({ code: draft });
    }
    setEditing(false);
  };

  const cancel = () => {
    setDraft(code || DEFAULT_PLANTUML_CODE);
    setEditing(false);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    // Keep keystrokes away from the editor and any global shortcuts.
    event.stopPropagation();

    if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
      return;
    }

    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      save();
      return;
    }

    if (
      event.key === 'Tab' &&
      !event.shiftKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
      const textarea = event.currentTarget;
      const { selectionStart, selectionEnd, value } = textarea;
      const next =
        value.slice(0, selectionStart) + INDENT + value.slice(selectionEnd);
      setDraft(next);
      const caret = selectionStart + INDENT.length;
      requestAnimationFrame(() => {
        textarea.selectionStart = caret;
        textarea.selectionEnd = caret;
      });
    }
  };

  if (showEditor) {
    return (
      <NodeViewWrapper data-id={id} className="my-2" contentEditable={false}>
        <div className="flex flex-col gap-2 rounded-md border bg-muted/40 p-2 not-prose">
          <div className="flex flex-row items-center gap-1 text-xs text-muted-foreground">
            <Workflow className="size-3.5" />
            <span>PlantUML</span>
          </div>
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            rows={Math.min(Math.max(draft.split('\n').length + 1, 6), 20)}
            className="w-full resize-y rounded-md border bg-background p-2 font-mono text-sm leading-normal outline-none [tab-size:2] focus-visible:ring-2 focus-visible:ring-ring/50"
          />
          {draft.trim().length > 0 && (
            <div className="flex max-h-80 justify-center overflow-auto rounded-md border bg-background p-2">
              <PlantUmlPreview code={draft} debounceMs={400} />
            </div>
          )}
          <div className="flex flex-row items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              Ctrl/Cmd+Enter to save, Esc to cancel
            </span>
            <div className="flex flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={cancel}
              >
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={save}>
                Save
              </Button>
            </div>
          </div>
        </div>
      </NodeViewWrapper>
    );
  }

  if (code.trim().length === 0) {
    return (
      <NodeViewWrapper data-id={id} className="my-2" contentEditable={false}>
        <div
          role={isEditable ? 'button' : undefined}
          onClick={isEditable ? openEditor : undefined}
          className={cn(
            'flex flex-row items-center gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground not-prose',
            isEditable && 'cursor-pointer hover:bg-accent'
          )}
        >
          <Workflow className="size-4" />
          <span>
            {isEditable
              ? 'Empty PlantUML diagram. Click to add a diagram.'
              : 'Empty PlantUML diagram.'}
          </span>
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper data-id={id} className="my-2" contentEditable={false}>
      <div
        className="group relative flex justify-center rounded-md p-2 not-prose hover:bg-accent/40"
        onDoubleClick={isEditable ? openEditor : undefined}
      >
        <PlantUmlPreview code={code} />
        {isEditable && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            title="Edit diagram"
            onClick={openEditor}
            className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          >
            <Pencil />
            Edit
          </Button>
        )}
      </div>
    </NodeViewWrapper>
  );
};

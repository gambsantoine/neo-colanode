import { CURSOR_MARKER } from '@colanode/ui/lib/diagram-snippets';

// Text edits computed from the textarea value and selection. An edit replaces
// [from, to) by `text`, then selects [selectionStart, selectionEnd).
export interface TextEdit {
  from: number;
  to: number;
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

export const INDENT = '  ';

const lineStartOf = (value: string, position: number): number =>
  value.lastIndexOf('\n', position - 1) + 1;

const lineEndOf = (value: string, position: number): number => {
  const end = value.indexOf('\n', position);
  return end === -1 ? value.length : end;
};

// Range covering every line touched by the selection. A selection ending at
// the very start of a line does not include that line.
const selectedLinesRange = (
  value: string,
  start: number,
  end: number
): { from: number; to: number } => {
  const lastPosition = end > start && value[end - 1] === '\n' ? end - 1 : end;
  return {
    from: lineStartOf(value, start),
    to: lineEndOf(value, lastPosition),
  };
};

// Inserts a snippet on its own line(s), using the indentation of the current
// line, and places the caret on the `$0` marker.
export const insertSnippet = (
  value: string,
  start: number,
  end: number,
  snippet: string
): TextEdit => {
  const lineStart = lineStartOf(value, start);
  const lineEnd = lineEndOf(value, end);
  const line = value.slice(lineStart, lineEnd);
  const indent = /^\s*/.exec(line)?.[0] ?? '';
  const lineIsBlank = line.trim().length === 0;

  const body = snippet
    .split('\n')
    .map((snippetLine, index) =>
      index === 0 ? snippetLine : indent + snippetLine
    )
    .join('\n');

  // Blank line: replace it. Otherwise insert after the current line.
  const from = lineIsBlank ? lineStart : lineEnd;
  const to = lineEnd;
  const prefix = lineIsBlank ? indent : '\n' + indent;

  const markerIndex = body.indexOf(CURSOR_MARKER);
  const cleanBody =
    markerIndex === -1
      ? body
      : body.slice(0, markerIndex) +
        body.slice(markerIndex + CURSOR_MARKER.length);
  const text = prefix + cleanBody;
  const caret =
    from +
    prefix.length +
    (markerIndex === -1 ? cleanBody.length : markerIndex);

  return { from, to, text, selectionStart: caret, selectionEnd: caret };
};

// Comments the selected lines out, or back in when they are all comments.
// `marker` starts a line comment: `'` in PlantUML (default), `%%` in Mermaid.
export const toggleComment = (
  value: string,
  start: number,
  end: number,
  marker = "'"
): TextEdit => {
  const prefix = `${marker} `;
  const { from, to } = selectedLinesRange(value, start, end);
  const lines = value.slice(from, to).split('\n');
  const nonBlank = lines.filter((line) => line.trim().length > 0);
  const uncomment =
    nonBlank.length > 0 &&
    nonBlank.every((line) => line.trimStart().startsWith(marker));

  const updated = lines.map((line) => {
    if (line.trim().length === 0) {
      return line;
    }

    const indent = /^\s*/.exec(line)?.[0] ?? '';
    const content = line.slice(indent.length);
    if (uncomment) {
      return (
        indent +
        (content.startsWith(prefix)
          ? content.slice(prefix.length)
          : content.slice(marker.length))
      );
    }

    return indent + prefix + content;
  });

  const text = updated.join('\n');
  return {
    from,
    to,
    text,
    selectionStart: from,
    selectionEnd: from + text.length,
  };
};

export const indentLines = (
  value: string,
  start: number,
  end: number,
  direction: 'in' | 'out'
): TextEdit => {
  // A plain caret indents by inserting spaces at its position.
  if (direction === 'in' && start === end) {
    const caret = start + INDENT.length;
    return {
      from: start,
      to: end,
      text: INDENT,
      selectionStart: caret,
      selectionEnd: caret,
    };
  }

  const { from, to } = selectedLinesRange(value, start, end);
  const lines = value.slice(from, to).split('\n');
  const updated = lines.map((line) => {
    if (direction === 'in') {
      return line.length > 0 ? INDENT + line : line;
    }

    const removable = /^ {1,2}|^\t/.exec(line)?.[0] ?? '';
    return line.slice(removable.length);
  });

  const text = updated.join('\n');
  const keepCaret = start === end;
  const firstLineDelta = updated[0]!.length - lines[0]!.length;
  const caret = Math.max(from, start + firstLineDelta);

  return {
    from,
    to,
    text,
    selectionStart: keepCaret ? caret : from,
    selectionEnd: keepCaret ? caret : from + text.length,
  };
};

export const duplicateLines = (
  value: string,
  start: number,
  end: number
): TextEdit => {
  const { from, to } = selectedLinesRange(value, start, end);
  const block = value.slice(from, to);
  const offset = block.length + 1;

  return {
    from: to,
    to,
    text: '\n' + block,
    selectionStart: start + offset,
    selectionEnd: end + offset,
  };
};

// Applies an edit through the browser editing commands so that the native
// undo/redo history of the textarea keeps working. Falls back to a direct
// value update (through `onFallback`) when the command is not supported.
export const applyTextEdit = (
  textarea: HTMLTextAreaElement,
  edit: TextEdit,
  onFallback: (value: string) => void
) => {
  textarea.focus();
  textarea.setSelectionRange(edit.from, edit.to);

  let applied = true;
  if (edit.text.length > 0) {
    applied = document.execCommand('insertText', false, edit.text);
  } else if (edit.from < edit.to) {
    applied = document.execCommand('delete', false);
  }

  if (!applied) {
    const value = textarea.value;
    onFallback(value.slice(0, edit.from) + edit.text + value.slice(edit.to));
  }

  // Wait for React to commit the new value before restoring the selection.
  requestAnimationFrame(() => {
    textarea.setSelectionRange(edit.selectionStart, edit.selectionEnd);
  });
};

export const getCaretPosition = (
  value: string,
  position: number
): { line: number; column: number } => {
  const before = value.slice(0, position);
  const line = before.split('\n').length;
  return { line, column: position - lineStartOf(value, position) + 1 };
};

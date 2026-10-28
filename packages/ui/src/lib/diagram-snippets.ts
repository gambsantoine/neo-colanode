// Snippets inserted from the diagram editor ribbon. `$0` marks where the
// caret is placed after insertion (removed from the inserted text).
export interface DiagramSnippet {
  id: string;
  label: string;
  code: string;
}

export interface DiagramSnippetGroup {
  id: string;
  label: string;
  snippets: DiagramSnippet[];
}

// Starting points offered by the "New" menu.
export interface DiagramTemplate {
  id: string;
  label: string;
  code: string;
}

export const CURSOR_MARKER = '$0';

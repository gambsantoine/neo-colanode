// Monaco, the editor of VS Code, is loaded on first use (several MB) and
// bundled with the app: it works offline.
export type Monaco = typeof import('monaco-editor');

let loading: Promise<Monaco> | null = null;

export const loadMonaco = (): Promise<Monaco> => {
  if (!loading) {
    loading = Promise.all([
      import('monaco-editor'),
      import('monaco-editor/editor/editor.worker?worker'),
    ])
      .then(([monaco, { default: EditorWorker }]) => {
        // Every language uses the generic worker: decks are Markdown.
        (self as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment =
          {
            getWorker: () => new EditorWorker(),
          };
        return monaco;
      })
      .catch((error) => {
        loading = null;
        throw error;
      });
  }

  return loading;
};

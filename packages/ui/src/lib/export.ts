import type { Editor } from '@tiptap/core';
import {
  DOMOutputSpec,
  DOMSerializer,
  Node as ProseMirrorNode,
} from '@tiptap/pm/model';

import { renderPlantUml, svgToDataUrl } from '@colanode/ui/lib/plantuml';

const PDF_CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
  background: #ffffff;
  color: #111827;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
  font-size: 13pt;
  line-height: 1.8;
}

.pdf-body {
  max-width: 680px;
  margin: 0 auto;
  padding: 60px 80px;
}

h1 { font-size: 2em; font-weight: 700; margin: 1.6em 0 0.5em; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.3em; }
h2 { font-size: 1.5em; font-weight: 600; margin: 1.4em 0 0.4em; }
h3 { font-size: 1.2em; font-weight: 600; margin: 1.2em 0 0.3em; }
p  { margin: 0.8em 0; }

a { color: #1d4ed8; text-decoration: underline; }
strong { font-weight: 700; }
em     { font-style: italic; }
s      { text-decoration: line-through; color: #6b7280; }

code {
  font-family: 'Menlo', 'Consolas', 'Courier New', monospace;
  font-size: 0.85em;
  background: #f3f4f6;
  color: #111827;
  padding: 0.1em 0.35em;
  border-radius: 3px;
  border: 1px solid #e5e7eb;
}

pre {
  background: #f8f9fa;
  border: 1px solid #e5e7eb;
  border-left: 4px solid #6366f1;
  border-radius: 6px;
  padding: 1em 1.2em;
  margin: 1.2em 0;
  overflow: visible;
  white-space: pre-wrap;
  word-break: break-word;
}
pre code { background: none; border: none; padding: 0; font-size: 0.82em; }

blockquote {
  border-left: 4px solid #d1d5db;
  background: #f9fafb;
  padding: 0.7em 1.2em;
  margin: 1em 0;
  color: #374151;
  border-radius: 0 4px 4px 0;
}

ul, ol { padding-left: 1.6em; margin: 0.8em 0; }
li     { margin: 0.4em 0; }
ul ul, ol ol, ul ol, ol ul { margin: 0.2em 0; }

ul[data-type="taskList"] { list-style: none; padding-left: 0; }
ul[data-type="taskList"] > li {
  display: flex;
  align-items: flex-start;
  gap: 0.5em;
}
ul[data-type="taskList"] > li > label {
  display: flex; align-items: center; gap: 0.4em;
}
ul[data-type="taskList"] > li > label > input[type="checkbox"] {
  width: 14px; height: 14px; margin-top: 0.25em; flex-shrink: 0;
  accent-color: #6366f1;
}
ul[data-type="taskList"] > li[data-checked="true"] > div {
  color: #9ca3af;
  text-decoration: line-through;
}

table {
  border-collapse: collapse;
  width: 100%;
  margin: 1.2em 0;
  font-size: 0.95em;
}
th, td {
  border: 1px solid #d1d5db;
  padding: 0.55em 0.8em;
  text-align: left;
  vertical-align: top;
}
th { background: #f3f4f6; font-weight: 600; }
tr:nth-child(even) td { background: #fafafa; }

hr {
  border: none;
  border-top: 1px solid #e5e7eb;
  margin: 2em 0;
}

.pdf-node-ref {
  display: flex;
  align-items: baseline;
  gap: 0.5em;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 0.4em 0.8em;
  margin: 0.6em 0;
}
.pdf-node-kind {
  font-size: 0.75em;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #6b7280;
}
.pdf-file { margin: 1em 0; }
.pdf-file img { display: block; max-width: 100%; max-height: 600px; }
.pdf-file figcaption { font-size: 0.8em; color: #6b7280; margin-top: 0.3em; }
.pdf-mention { color: #1d4ed8; font-weight: 500; }
.pdf-plantuml { margin: 1em 0; text-align: center; }
.pdf-plantuml img { display: inline-block; max-width: 100%; }

@media print {
  pre, blockquote, table, figure, .pdf-node-ref { page-break-inside: avoid; }
  h1, h2, h3 { page-break-after: avoid; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildPdfHtml(title: string, editorHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <style>${PDF_CSS}</style>
</head>
<body>
  <div class="pdf-body">${editorHtml}</div>
</body>
</html>`;
}

/**
 * Synchronous lookups for data that custom editor nodes only reference by id.
 * Any lookup may return undefined (e.g. data not loaded yet); a generic label
 * is used in that case.
 */
export interface PdfExportResolver {
  getNodeName: (id: string) => string | undefined;
  getUserName: (id: string) => string | undefined;
  getTempFileName: (id: string) => string | undefined;
}

const NODE_REF_LABELS: Record<string, string> = {
  page: 'Page',
  folder: 'Folder',
  database: 'Database',
};

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/**
 * Collects the image sources currently rendered by file / temp file node views
 * and inlines them as data URLs so they also resolve in the isolated PDF
 * renderer. Falls back to the original src if it cannot be fetched.
 */
const collectImageSources = async (
  editor: Editor
): Promise<Map<string, string>> => {
  const sources = new Map<string, string>();

  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'file' && node.type.name !== 'tempFile') {
      return;
    }

    const id = node.attrs.id as string | null;
    if (!id) {
      return false;
    }

    const dom = editor.view.nodeDOM(pos);
    const img =
      dom instanceof HTMLElement ? dom.querySelector('img') : undefined;
    const src = img?.currentSrc || img?.src;
    if (src) {
      sources.set(id, src);
    }

    return false;
  });

  await Promise.all(
    Array.from(sources.entries()).map(async ([id, src]) => {
      if (src.startsWith('data:')) {
        return;
      }

      try {
        const response = await fetch(src);
        if (response.ok) {
          sources.set(id, await blobToDataUrl(await response.blob()));
        }
      } catch {
        // keep the original src
      }
    })
  );

  return sources;
};

/**
 * Renders every PlantUML block to an SVG data URL (light theme) ahead of the
 * synchronous serialization. Codes that fail to render map to null so the
 * serializer can fall back to the raw source.
 */
const collectPlantUmlImages = async (
  editor: Editor
): Promise<Map<string, string | null>> => {
  const codes = new Set<string>();
  editor.state.doc.descendants((node) => {
    if (node.type.name !== 'plantuml') {
      return;
    }

    const code = (node.attrs.code as string | null) ?? '';
    if (code.trim().length > 0) {
      codes.add(code);
    }

    return false;
  });

  const images = new Map<string, string | null>();
  await Promise.all(
    Array.from(codes).map(async (code) => {
      try {
        const svg = await renderPlantUml(code, { dark: false });
        images.set(code, svgToDataUrl(svg));
      } catch {
        images.set(code, null);
      }
    })
  );

  return images;
};

/**
 * Serializes the editor content to HTML for PDF export. Custom atom nodes
 * (mentions, page/folder/database references, files) have no meaningful HTML
 * representation of their own, so they are replaced with readable fallbacks.
 * All inserted text goes through DOM text nodes, so it is escaped.
 */
export async function serializeEditorForPdf(
  editor: Editor,
  resolver: PdfExportResolver
): Promise<string> {
  const [imageSources, plantUmlImages] = await Promise.all([
    collectImageSources(editor),
    collectPlantUmlImages(editor),
  ]);
  const base = DOMSerializer.fromSchema(editor.schema);

  const renderFile = (
    node: ProseMirrorNode,
    name: string | undefined
  ): DOMOutputSpec => {
    const id = node.attrs.id as string | null;
    const src = id ? imageSources.get(id) : undefined;
    const label = name ?? 'File';

    if (src) {
      return [
        'figure',
        { class: 'pdf-file' },
        ['img', { src, alt: label }],
        ['figcaption', label],
      ];
    }

    return [
      'div',
      { class: 'pdf-node-ref' },
      ['span', { class: 'pdf-node-kind' }, 'File'],
      ['span', label],
    ];
  };

  const renderNodeRef = (node: ProseMirrorNode): DOMOutputSpec => {
    const kind = NODE_REF_LABELS[node.type.name] ?? 'Node';
    const id = node.attrs.id as string | null;
    const name = (id ? resolver.getNodeName(id) : undefined) ?? 'Untitled';

    return [
      'div',
      { class: 'pdf-node-ref' },
      ['span', { class: 'pdf-node-kind' }, kind],
      ['span', name],
    ];
  };

  const nodes: Record<string, (node: ProseMirrorNode) => DOMOutputSpec> = {};

  // Fallback for any node type without a serializer, so export never throws.
  for (const [name, type] of Object.entries(editor.schema.nodes)) {
    if (!base.nodes[name]) {
      nodes[name] = () => (type.isLeaf ? ['span'] : ['div', 0]);
    }
  }

  Object.assign(nodes, base.nodes, {
    mention: (node: ProseMirrorNode) => {
      const target = node.attrs.target as string | null;
      const name =
        (target ? resolver.getUserName(target) : undefined) ?? 'Unknown';
      return ['span', { class: 'pdf-mention' }, `@${name}`];
    },
    page: renderNodeRef,
    folder: renderNodeRef,
    database: renderNodeRef,
    file: (node: ProseMirrorNode) => {
      const id = node.attrs.id as string | null;
      return renderFile(node, id ? resolver.getNodeName(id) : undefined);
    },
    plantuml: (node: ProseMirrorNode): DOMOutputSpec => {
      const code = (node.attrs.code as string | null) ?? '';
      if (code.trim().length === 0) {
        return ['div'];
      }

      const src = plantUmlImages.get(code);
      if (src) {
        return [
          'figure',
          { class: 'pdf-plantuml' },
          ['img', { src, alt: 'PlantUML diagram' }],
        ];
      }

      return ['pre', ['code', code]];
    },
    tempFile: (node: ProseMirrorNode) => {
      const id = node.attrs.id as string | null;
      return renderFile(node, id ? resolver.getTempFileName(id) : undefined);
    },
  });

  const serializer = new DOMSerializer(nodes, base.marks);
  const container = document.createElement('div');
  container.appendChild(serializer.serializeFragment(editor.state.doc.content));
  return container.innerHTML;
}

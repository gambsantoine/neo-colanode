import {
  DiagramSnippetGroup,
  DiagramTemplate,
} from '@colanode/ui/lib/diagram-snippets';
import {
  DEFAULT_MERMAID_CODE,
  MERMAID_FILE_EXTENSION,
  renderMermaid,
} from '@colanode/ui/lib/mermaid';
import {
  mermaidSnippetGroups,
  mermaidTemplates,
} from '@colanode/ui/lib/mermaid-snippets';
import {
  DEFAULT_PLANTUML_CODE,
  PLANTUML_FILE_EXTENSION,
  renderPlantUml,
} from '@colanode/ui/lib/plantuml';
import {
  plantUmlSnippetGroups,
  plantUmlTemplates,
} from '@colanode/ui/lib/plantuml-snippets';
import { ToolPath } from '@colanode/ui/lib/tools';

export type DiagramLanguageId = 'plantuml' | 'mermaid';

// Everything the diagram editor needs to know about a text-based diagram
// language. The editor, its dialogs and the file preview are shared.
export interface DiagramLanguage {
  id: DiagramLanguageId;
  name: string;
  // Extension given to saved files.
  fileExtension: string;
  // Every extension recognized as this language (lowercase, with the dot).
  fileExtensions: string[];
  defaultCode: string;
  // Starts a line comment.
  commentMarker: string;
  snippetGroups: DiagramSnippetGroup[];
  templates: DiagramTemplate[];
  toolPath: ToolPath;
  // Renders the code to an SVG document; rejects with the syntax error.
  render: (code: string, options?: { dark?: boolean }) => Promise<string>;
}

export const plantUmlLanguage: DiagramLanguage = {
  id: 'plantuml',
  name: 'PlantUML',
  fileExtension: PLANTUML_FILE_EXTENSION,
  fileExtensions: ['.puml', '.plantuml', '.pu', '.iuml', '.wsd'],
  defaultCode: DEFAULT_PLANTUML_CODE,
  commentMarker: "'",
  snippetGroups: plantUmlSnippetGroups,
  templates: plantUmlTemplates,
  toolPath: 'tools/plantuml',
  render: renderPlantUml,
};

export const mermaidLanguage: DiagramLanguage = {
  id: 'mermaid',
  name: 'Mermaid',
  fileExtension: MERMAID_FILE_EXTENSION,
  fileExtensions: ['.mmd', '.mermaid'],
  defaultCode: DEFAULT_MERMAID_CODE,
  commentMarker: '%%',
  snippetGroups: mermaidSnippetGroups,
  templates: mermaidTemplates,
  toolPath: 'tools/mermaid',
  render: renderMermaid,
};

export const diagramLanguages: DiagramLanguage[] = [
  plantUmlLanguage,
  mermaidLanguage,
];

export const isDiagramFileName = (
  language: DiagramLanguage,
  name: string
): boolean => {
  const lower = name.toLowerCase();
  return language.fileExtensions.some((extension) => lower.endsWith(extension));
};

export const getDiagramLanguageForFile = (
  name: string
): DiagramLanguage | undefined =>
  diagramLanguages.find((language) => isDiagramFileName(language, name));

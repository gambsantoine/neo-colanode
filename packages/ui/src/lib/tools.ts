import {
  Braces,
  GitFork,
  KeyRound,
  LucideIcon,
  QrCode,
  Shapes,
  Workflow,
} from 'lucide-react';

// Route paths of the tools, relative to `/workspace/$userId`. Every new tool
// needs a matching route (see routes/workspace/tools.tsx) registered in
// routes/index.tsx and a mask in routes/masks.tsx.
export type ToolPath =
  | 'tools/plantuml'
  | 'tools/mermaid'
  | 'tools/drawio'
  | 'tools/json'
  | 'tools/qrcode'
  | 'tools/password';

export type ToolCategory = 'diagrams' | 'developer' | 'utilities' | 'security';

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  path: ToolPath;
  category: ToolCategory;
  // Extra search terms, used to filter tools by name.
  keywords?: string[];
}

export const toolCategories: Record<ToolCategory, string> = {
  diagrams: 'Diagrams',
  developer: 'Developer',
  utilities: 'Utilities',
  security: 'Security',
};

export const tools: ToolDefinition[] = [
  {
    id: 'plantuml',
    name: 'PlantUML editor',
    description:
      'Write PlantUML diagrams with a live preview and save them as files',
    icon: Workflow,
    path: 'tools/plantuml',
    category: 'diagrams',
    keywords: ['uml', 'diagram', 'sequence', 'puml'],
  },
  {
    id: 'mermaid',
    name: 'Mermaid editor',
    description:
      'Write Mermaid diagrams and charts with a live preview and save them as files',
    icon: GitFork,
    path: 'tools/mermaid',
    category: 'diagrams',
    keywords: ['diagram', 'flowchart', 'gantt', 'sequence', 'mmd', 'chart'],
  },
  {
    id: 'drawio',
    name: 'draw.io editor',
    description: 'Draw diagrams with the draw.io editor and save them as files',
    icon: Shapes,
    path: 'tools/drawio',
    category: 'diagrams',
    keywords: ['diagram', 'drawio', 'diagrams.net', 'schema', 'flowchart'],
  },
  {
    id: 'json',
    name: 'JSON / YAML formatter',
    description:
      'Format, validate, minify and convert JSON and YAML, with error locations',
    icon: Braces,
    path: 'tools/json',
    category: 'developer',
    keywords: [
      'json',
      'yaml',
      'yml',
      'format',
      'validate',
      'minify',
      'convert',
    ],
  },
  {
    id: 'qrcode',
    name: 'QR code generator',
    description: 'Turn a link, a text or Wi-Fi credentials into a QR code',
    icon: QrCode,
    path: 'tools/qrcode',
    category: 'utilities',
    keywords: ['qr', 'code', 'link', 'url', 'wifi', 'share'],
  },
  {
    id: 'password',
    name: 'Password generator',
    description: 'Generate strong random passwords and copy them',
    icon: KeyRound,
    path: 'tools/password',
    category: 'security',
    keywords: ['password', 'mot de passe', 'secret', 'random', 'generator'],
  },
];

export const getTool = (id: string): ToolDefinition | undefined =>
  tools.find((tool) => tool.id === id);

const normalizeSearchText = (value: string): string =>
  value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

// Matches every word of `query` against the tool name, description, category
// and keywords (case and accent insensitive). An empty query keeps all tools.
export const searchTools = (
  query: string,
  items: ToolDefinition[] = tools
): ToolDefinition[] => {
  const words = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return items;
  }

  return items.filter((tool) => {
    const haystack = normalizeSearchText(
      [
        tool.name,
        tool.description,
        toolCategories[tool.category],
        ...(tool.keywords ?? []),
      ].join(' ')
    );
    return words.every((word) => haystack.includes(word));
  });
};

export const groupToolsByCategory = (
  items: ToolDefinition[] = tools
): { category: ToolCategory; name: string; tools: ToolDefinition[] }[] => {
  const groups = new Map<ToolCategory, ToolDefinition[]>();
  for (const tool of items) {
    const group = groups.get(tool.category) ?? [];
    group.push(tool);
    groups.set(tool.category, group);
  }

  return Array.from(groups.entries()).map(([category, groupTools]) => ({
    category,
    name: toolCategories[category],
    tools: groupTools,
  }));
};

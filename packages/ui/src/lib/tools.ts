import { LucideIcon, Workflow } from 'lucide-react';

// Route paths of the tools, relative to `/workspace/$userId`. Every new tool
// needs a matching route (see routes/workspace/tools.tsx) registered in
// routes/index.tsx and a mask in routes/masks.tsx.
export type ToolPath = 'tools/plantuml';

export type ToolCategory = 'diagrams';

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
];

export const getTool = (id: string): ToolDefinition | undefined =>
  tools.find((tool) => tool.id === id);

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

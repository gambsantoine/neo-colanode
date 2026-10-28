import { describe, expect, it } from 'vitest';

import { buildBaseName } from '@colanode/ui/components/tools/diagrams/diagram-save-dialog';
import { toggleComment } from '@colanode/ui/lib/diagram-editing';
import {
  getDiagramLanguageForFile,
  mermaidLanguage,
  plantUmlLanguage,
} from '@colanode/ui/lib/diagram-languages';
import { setMermaidSvgSize } from '@colanode/ui/lib/mermaid';

describe('lib/diagram-languages', () => {
  it('finds the language of a file from its extension', () => {
    expect(getDiagramLanguageForFile('flow.puml')).toBe(plantUmlLanguage);
    expect(getDiagramLanguageForFile('Flow.PlantUML')).toBe(plantUmlLanguage);
    expect(getDiagramLanguageForFile('chart.mmd')).toBe(mermaidLanguage);
    expect(getDiagramLanguageForFile('chart.mermaid')).toBe(mermaidLanguage);
    expect(getDiagramLanguageForFile('notes.txt')).toBeUndefined();
  });

  it('strips any diagram extension from file names', () => {
    expect(buildBaseName('flow.puml', 'diagram')).toBe('flow');
    expect(buildBaseName('chart.mmd', 'diagram')).toBe('chart');
    expect(buildBaseName('my.chart', 'diagram')).toBe('my.chart');
    expect(buildBaseName('  .mmd ', 'diagram')).toBe('diagram');
  });

  it('comments lines with the Mermaid marker', () => {
    const value = 'A --> B\nB --> C';
    const edit = toggleComment(value, 0, value.length, '%%');
    expect(edit.text).toBe('%% A --> B\n%% B --> C');

    const restored = toggleComment(edit.text, 0, edit.text.length, '%%');
    expect(restored.text).toBe(value);
  });

  it('gives Mermaid SVGs a size from their viewBox', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 120.4 80" style="max-width: 120.4px;"><g/></svg>';
    const sized = setMermaidSvgSize(svg);
    expect(sized).toContain('width="121"');
    expect(sized).toContain('height="80"');
    expect(sized).not.toContain('max-width');
  });
});

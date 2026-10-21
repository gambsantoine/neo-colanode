import { JSONContent } from '@tiptap/core';

import { PlantUmlPreview } from '@colanode/ui/components/plantuml/plantuml-preview';

interface PlantUmlRendererProps {
  node: JSONContent;
  keyPrefix: string | null;
}

export const PlantUmlRenderer = ({ node }: PlantUmlRendererProps) => {
  const code = typeof node.attrs?.code === 'string' ? node.attrs.code : '';
  if (code.trim().length === 0) {
    return null;
  }

  return (
    <div className="my-2 flex justify-center">
      <PlantUmlPreview code={code} />
    </div>
  );
};

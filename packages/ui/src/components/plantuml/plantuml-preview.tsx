import { DiagramPreview } from '@colanode/ui/components/diagrams/diagram-preview';
import { plantUmlLanguage } from '@colanode/ui/lib/diagram-languages';

interface PlantUmlPreviewProps {
  code: string;
  debounceMs?: number;
  zoom?: number;
  className?: string;
}

// PlantUML rendering, used by the PlantUML blocks of pages.
export const PlantUmlPreview = (props: PlantUmlPreviewProps) => {
  return <DiagramPreview language={plantUmlLanguage} {...props} />;
};

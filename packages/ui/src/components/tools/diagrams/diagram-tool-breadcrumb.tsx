import { BreadcrumbItem } from '@colanode/ui/components/layouts/containers/breadcrumb-item';
import { defaultIcons } from '@colanode/ui/lib/assets';
import { DiagramLanguage } from '@colanode/ui/lib/diagram-languages';

interface DiagramToolBreadcrumbProps {
  language: DiagramLanguage;
}

export const DiagramToolBreadcrumb = ({
  language,
}: DiagramToolBreadcrumbProps) => {
  return (
    <BreadcrumbItem
      id={`tools-${language.id}`}
      avatar={defaultIcons.apps}
      name={`${language.name} editor`}
    />
  );
};

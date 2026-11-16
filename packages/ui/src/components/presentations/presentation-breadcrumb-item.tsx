import { LocalPresentationNode } from '@colanode/client/types';
import { BreadcrumbItem } from '@colanode/ui/components/layouts/containers/breadcrumb-item';

interface PresentationBreadcrumbItemProps {
  presentation: LocalPresentationNode;
}

export const PresentationBreadcrumbItem = ({
  presentation,
}: PresentationBreadcrumbItemProps) => {
  return (
    <BreadcrumbItem
      id={presentation.id}
      avatar={presentation.avatar}
      name={presentation.name}
    />
  );
};

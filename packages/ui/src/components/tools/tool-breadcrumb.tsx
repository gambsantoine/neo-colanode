import { BreadcrumbItem } from '@colanode/ui/components/layouts/containers/breadcrumb-item';
import { defaultIcons } from '@colanode/ui/lib/assets';

interface ToolBreadcrumbProps {
  id: string;
  name: string;
}

// Breadcrumb of a tool page.
export const ToolBreadcrumb = ({ id, name }: ToolBreadcrumbProps) => {
  return (
    <BreadcrumbItem id={`tools-${id}`} avatar={defaultIcons.apps} name={name} />
  );
};

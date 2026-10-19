import { BreadcrumbItem } from '@colanode/ui/components/layouts/containers/breadcrumb-item';
import { defaultIcons } from '@colanode/ui/lib/assets';

export const PlantUmlToolBreadcrumb = () => {
  return (
    <BreadcrumbItem
      id="tools-plantuml"
      avatar={defaultIcons.apps}
      name="PlantUML editor"
    />
  );
};

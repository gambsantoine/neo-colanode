import { BreadcrumbItem } from '@colanode/ui/components/layouts/containers/breadcrumb-item';
import { defaultIcons } from '@colanode/ui/lib/assets';

export const PasswordToolBreadcrumb = () => {
  return (
    <BreadcrumbItem
      id="tools-password"
      avatar={defaultIcons.apps}
      name="Password generator"
    />
  );
};

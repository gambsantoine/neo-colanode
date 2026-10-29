import { TabItem } from '@colanode/ui/components/layouts/tabs/tab-item';
import { defaultIcons } from '@colanode/ui/lib/assets';

export const PasswordToolTab = () => {
  return (
    <TabItem id="tools-password" avatar={defaultIcons.apps} name="Passwords" />
  );
};

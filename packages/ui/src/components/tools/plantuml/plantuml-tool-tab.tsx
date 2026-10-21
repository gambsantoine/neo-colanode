import { TabItem } from '@colanode/ui/components/layouts/tabs/tab-item';
import { defaultIcons } from '@colanode/ui/lib/assets';

export const PlantUmlToolTab = () => {
  return (
    <TabItem id="tools-plantuml" avatar={defaultIcons.apps} name="PlantUML" />
  );
};

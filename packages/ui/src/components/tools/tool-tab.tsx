import { TabItem } from '@colanode/ui/components/layouts/tabs/tab-item';
import { defaultIcons } from '@colanode/ui/lib/assets';

interface ToolTabProps {
  id: string;
  name: string;
}

// Tab label of a tool page.
export const ToolTab = ({ id, name }: ToolTabProps) => {
  return <TabItem id={`tools-${id}`} avatar={defaultIcons.apps} name={name} />;
};

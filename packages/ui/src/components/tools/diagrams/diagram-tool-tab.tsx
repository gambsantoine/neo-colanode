import { TabItem } from '@colanode/ui/components/layouts/tabs/tab-item';
import { defaultIcons } from '@colanode/ui/lib/assets';
import { DiagramLanguage } from '@colanode/ui/lib/diagram-languages';

interface DiagramToolTabProps {
  language: DiagramLanguage;
}

export const DiagramToolTab = ({ language }: DiagramToolTabProps) => {
  return (
    <TabItem
      id={`tools-${language.id}`}
      avatar={defaultIcons.apps}
      name={language.name}
    />
  );
};

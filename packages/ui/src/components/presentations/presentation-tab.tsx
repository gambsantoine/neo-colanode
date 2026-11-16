import { LocalPresentationNode } from '@colanode/client/types';
import { Tab } from '@colanode/ui/components/layouts/tabs/tab';

interface PresentationTabProps {
  presentation: LocalPresentationNode;
}

export const PresentationTab = ({ presentation }: PresentationTabProps) => {
  const name =
    presentation.name && presentation.name.length > 0
      ? presentation.name
      : 'Untitled';
  return <Tab id={presentation.id} avatar={presentation.avatar} name={name} />;
};

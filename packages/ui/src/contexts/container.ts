import { createContext, useContext } from 'react';

export type ContainerType = 'full' | 'modal';

interface ContainerContext {
  type: ContainerType;
  scrollAreaRef: React.RefObject<HTMLDivElement>;
  scrollViewportRef: React.RefObject<HTMLDivElement>;
  /**
   * Header element where nested components can portal extra actions.
   * Held in state so consumers re-render when it mounts or remounts.
   */
  actionsSlot: HTMLDivElement | null;
}

export const ContainerContext = createContext<ContainerContext>(
  {} as ContainerContext
);

export const useContainer = () => useContext(ContainerContext);

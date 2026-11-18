import * as TabsPrimitive from '@radix-ui/react-tabs';
import { LucideIcon } from 'lucide-react';
import { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@colanode/ui/components/ui/tooltip';
import { cn } from '@colanode/ui/lib/utils';

// Word-like ribbon shared by the tools: a row of tabs, each one showing a
// toolbar made of labelled groups of buttons.
export interface RibbonTab {
  id: string;
  label: string;
  content: ReactNode;
}

interface RibbonProps {
  tabs: RibbonTab[];
  value: string;
  onValueChange: (value: string) => void;
  // Shown at the right of the tab row (e.g. the opened document name).
  status?: ReactNode;
}

export const Ribbon = ({ tabs, value, onValueChange, status }: RibbonProps) => {
  return (
    <TabsPrimitive.Root
      value={value}
      onValueChange={onValueChange}
      className="flex flex-col border-y border-input bg-muted/30"
    >
      <div className="flex min-w-0 items-center gap-2 border-b border-input px-1">
        <TabsPrimitive.List className="flex shrink-0 items-end">
          {tabs.map((tab) => (
            <TabsPrimitive.Trigger
              key={tab.id}
              value={tab.id}
              className="relative px-2.5 py-1 text-xs text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground data-[state=active]:font-medium data-[state=active]:text-foreground data-[state=active]:after:absolute data-[state=active]:after:inset-x-2 data-[state=active]:after:bottom-0 data-[state=active]:after:h-0.5 data-[state=active]:after:rounded-full data-[state=active]:after:bg-primary"
            >
              {tab.label}
            </TabsPrimitive.Trigger>
          ))}
        </TabsPrimitive.List>
        {status && (
          <div className="ml-auto flex min-w-0 items-center gap-2 pr-2 text-xs text-muted-foreground">
            {status}
          </div>
        )}
      </div>
      {tabs.map((tab) => (
        <TabsPrimitive.Content
          key={tab.id}
          value={tab.id}
          // Fixed height: the tool below keeps the rest of the page.
          className="flex h-[3.75rem] items-stretch overflow-x-auto overflow-y-hidden px-1 py-0.5 outline-none"
        >
          {tab.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
};

interface RibbonGroupProps {
  label: string;
  children: ReactNode;
  // Lays small buttons out in columns of two rows.
  compact?: boolean;
}

export const RibbonGroup = ({ label, children, compact }: RibbonGroupProps) => {
  return (
    <div className="flex shrink-0 flex-col border-r border-input px-1 last:border-r-0">
      <div
        className={cn(
          'flex flex-1 items-center gap-0.5',
          compact && 'grid grid-flow-col grid-rows-2 items-stretch gap-x-1'
        )}
      >
        {children}
      </div>
      <p className="pt-0.5 text-center text-[10px] leading-none text-muted-foreground">
        {label}
      </p>
    </div>
  );
};

// Extra button attributes are forwarded so the button can be used as a
// trigger (`asChild`) of a dropdown menu.
interface RibbonButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
  label: string;
  icon?: LucideIcon;
  active?: boolean;
  // Large buttons show the icon above the label, small ones inline.
  size?: 'lg' | 'sm';
  tooltip?: string;
  shortcut?: string;
}

export const RibbonButton = forwardRef<HTMLButtonElement, RibbonButtonProps>(
  (
    {
      label,
      icon: Icon,
      active,
      size = 'sm',
      tooltip,
      shortcut,
      className,
      ...props
    },
    ref
  ) => {
    const button = (
      <button
        ref={ref}
        type="button"
        aria-pressed={active}
        // Keeps the focus (and selection) in the code editor.
        onMouseDown={(event) => event.preventDefault()}
        className={cn(
          'flex items-center rounded-sm text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40',
          active && 'bg-accent',
          size === 'lg'
            ? 'h-full min-w-12 flex-col justify-center gap-0.5 px-1.5 py-0.5 text-[11px]'
            : 'h-5 gap-1 px-1.5 text-[11px] whitespace-nowrap',
          className
        )}
        {...props}
      >
        {Icon && <Icon className={size === 'lg' ? 'size-4' : 'size-3'} />}
        <span>{label}</span>
      </button>
    );

    if (!tooltip && !shortcut) {
      return button;
    }

    return (
      <Tooltip delayDuration={500}>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>
          {tooltip ?? label}
          {shortcut && (
            <span className="ml-2 text-muted-foreground">{shortcut}</span>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }
);

RibbonButton.displayName = 'RibbonButton';

import { cn } from '@colanode/ui/lib/utils';

interface ToolSegmentedProps<T extends string | number> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
  'aria-label'?: string;
}

// Compact single choice control for tool option bars.
export const ToolSegmented = <T extends string | number>({
  value,
  options,
  onChange,
  disabled,
  'aria-label': ariaLabel,
}: ToolSegmentedProps<T>) => {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex h-8 shrink-0 items-center rounded-md border border-input bg-muted/30 p-0.5',
        disabled && 'pointer-events-none opacity-50'
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            'h-full rounded-[5px] px-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground',
            option.value === value &&
              'bg-background font-medium text-foreground shadow-xs'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

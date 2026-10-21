import { useEffect, useState } from 'react';

import { Spinner } from '@colanode/ui/components/ui/spinner';
import { useTheme } from '@colanode/ui/contexts/theme';
import { renderPlantUml, svgToDataUrl } from '@colanode/ui/lib/plantuml';
import { cn } from '@colanode/ui/lib/utils';

interface PlantUmlPreviewProps {
  code: string;
  // Delay before re-rendering after `code` changes (useful for live editing).
  debounceMs?: number;
  className?: string;
}

type PreviewState =
  | { status: 'loading' }
  | { status: 'ready'; src: string }
  | { status: 'error'; message: string };

export const PlantUmlPreview = ({
  code,
  debounceMs = 0,
  className,
}: PlantUmlPreviewProps) => {
  const theme = useTheme();
  const dark = theme.mode === 'dark';
  const [state, setState] = useState<PreviewState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    const timeout = setTimeout(() => {
      renderPlantUml(code, { dark })
        .then((svg) => {
          if (!cancelled) {
            setState({ status: 'ready', src: svgToDataUrl(svg) });
          }
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setState({
              status: 'error',
              message: error instanceof Error ? error.message : String(error),
            });
          }
        });
    }, debounceMs);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [code, dark, debounceMs]);

  if (state.status === 'error') {
    return (
      <pre
        className={cn(
          'text-xs text-destructive whitespace-pre-wrap rounded-md border border-destructive/40 p-3',
          className
        )}
      >
        {state.message}
      </pre>
    );
  }

  if (state.status === 'loading') {
    return (
      <div
        className={cn(
          'flex items-center justify-center p-6 text-muted-foreground',
          className
        )}
      >
        <Spinner />
      </div>
    );
  }

  return (
    <img
      src={state.src}
      alt="PlantUML diagram"
      draggable={false}
      className={cn('max-w-full h-auto', className)}
    />
  );
};

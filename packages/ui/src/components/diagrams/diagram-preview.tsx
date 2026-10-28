import { useEffect, useState } from 'react';

import { Spinner } from '@colanode/ui/components/ui/spinner';
import { useTheme } from '@colanode/ui/contexts/theme';
import { DiagramLanguage } from '@colanode/ui/lib/diagram-languages';
import { svgToDataUrl } from '@colanode/ui/lib/svg';
import { cn } from '@colanode/ui/lib/utils';

interface DiagramPreviewProps {
  language: DiagramLanguage;
  code: string;
  // Delay before re-rendering after `code` changes (useful for live editing).
  debounceMs?: number;
  // Scale applied to the natural size of the diagram. When omitted the
  // diagram is shrunk to fit the available width.
  zoom?: number;
  className?: string;
}

interface PreviewState {
  // Last successful rendering, kept while the code contains an error so the
  // diagram does not flicker away on every typo.
  src: string | null;
  error: string | null;
  pending: boolean;
}

interface NaturalSize {
  src: string;
  width: number;
  height: number;
}

export const DiagramPreview = ({
  language,
  code,
  debounceMs = 0,
  zoom,
  className,
}: DiagramPreviewProps) => {
  const theme = useTheme();
  const dark = theme.mode === 'dark';
  const [state, setState] = useState<PreviewState>({
    src: null,
    error: null,
    pending: true,
  });
  const [naturalSize, setNaturalSize] = useState<NaturalSize | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState((previous) => ({ ...previous, pending: true }));

    const timeout = setTimeout(() => {
      language
        .render(code, { dark })
        .then((svg) => {
          if (!cancelled) {
            setState({ src: svgToDataUrl(svg), error: null, pending: false });
          }
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setState((previous) => ({
              src: previous.src,
              error: error instanceof Error ? error.message : String(error),
              pending: false,
            }));
          }
        });
    }, debounceMs);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [language, code, dark, debounceMs]);

  if (!state.src) {
    if (state.error) {
      return <DiagramError message={state.error} className={className} />;
    }

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

  const size =
    zoom !== undefined && naturalSize?.src === state.src
      ? {
          width: naturalSize.width * zoom,
          height: naturalSize.height * zoom,
        }
      : undefined;

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      {state.error && <DiagramError message={state.error} stale />}
      <img
        src={state.src}
        alt={`${language.name} diagram`}
        draggable={false}
        onLoad={(event) => {
          const image = event.currentTarget;
          setNaturalSize({
            src: image.currentSrc || image.src,
            width: image.naturalWidth,
            height: image.naturalHeight,
          });
        }}
        style={size ? { width: size.width, height: size.height } : undefined}
        className={cn(
          'max-w-none',
          !size && 'max-w-full h-auto',
          state.error && 'opacity-50'
        )}
      />
    </div>
  );
};

interface DiagramErrorProps {
  message: string;
  // The displayed diagram is the last valid one, not the current code.
  stale?: boolean;
  className?: string;
}

const DiagramError = ({ message, stale, className }: DiagramErrorProps) => {
  return (
    <pre
      className={cn(
        'w-full text-xs text-destructive whitespace-pre-wrap rounded-md border border-destructive/40 p-3',
        className
      )}
    >
      {stale && (
        <span className="mb-1 block font-sans font-medium">
          Showing the last valid diagram:
        </span>
      )}
      {message}
    </pre>
  );
};

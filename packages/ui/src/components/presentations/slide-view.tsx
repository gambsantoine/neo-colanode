import { useEffect, useMemo, useRef, useState } from 'react';

import { SlideFrame } from '@colanode/ui/components/presentations/slide-frame';
import {
  Slide,
  toCssBackground,
  toSafeImageUrl,
} from '@colanode/ui/lib/slides';
import { enhanceCodeBlocks } from '@colanode/ui/lib/slides-code';
import { renderMermaidPlaceholders } from '@colanode/ui/lib/slides-mermaid';
import { renderSlideMarkdown } from '@colanode/ui/lib/slides-render';
import { cn } from '@colanode/ui/lib/utils';
import slideCodeCss from '@colanode/ui/styles/slide-code.css?inline';
import slidesCss from '@colanode/ui/styles/slides.css?inline';

// Only the styles of the Slidev engine (and Tailwind) apply to the slides.
const SLIDEV_STYLES = [slidesCss, slideCodeCss];

// Slides are drawn on a fixed canvas (Slidev's default size) and scaled to
// fit, so a deck looks the same in the editor preview and in full screen.
export const SLIDE_WIDTH = 980;
export const SLIDE_HEIGHT = 552;

const CENTERED_LAYOUTS = new Set([
  'center',
  'cover',
  'intro',
  'section',
  'statement',
  'fact',
  'quote',
  'end',
]);

// Tailwind classes from the `class` frontmatter option, as in Slidev.
const toClassName = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  return value
    .split(/\s+/)
    .filter((token) => /^[\w:/.[\]#-]+$/.test(token))
    .join(' ');
};

const SlideHtml = ({
  html,
  dark,
  className,
}: {
  html: string;
  dark: boolean;
  className?: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) {
      return;
    }

    const cancelMermaid = renderMermaidPlaceholders(root, dark);
    const removeCopy = enhanceCodeBlocks(root);
    return () => {
      cancelMermaid();
      removeCopy();
    };
  }, [html, dark]);

  return (
    <div
      ref={ref}
      className={cn('slide-content', className)}
      // Sanitized by renderSlideMarkdown (DOMPurify).
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

interface SlideCanvasProps {
  slide: Slide;
  dark: boolean;
}

// The slide at its native size (SLIDE_WIDTH x SLIDE_HEIGHT).
const SlideCanvas = ({ slide, dark }: SlideCanvasProps) => {
  const html = useMemo(() => renderSlideMarkdown(slide.content), [slide]);
  const rightHtml = useMemo(
    () => (slide.right !== null ? renderSlideMarkdown(slide.right) : ''),
    [slide]
  );

  const background = toCssBackground(slide.frontmatter.background);
  const image = toSafeImageUrl(slide.frontmatter.image);
  const extraClass = toClassName(slide.frontmatter.class);
  const layout = slide.layout;
  const centered = CENTERED_LAYOUTS.has(layout);

  const imagePanel = image ? (
    <div
      className="h-full w-1/2 shrink-0 bg-cover bg-center"
      style={{ backgroundImage: `url("${image}")` }}
    />
  ) : null;

  let body: React.ReactNode;
  if (layout === 'two-cols') {
    body = (
      <div className="grid h-full grid-cols-2 gap-10 px-14 py-10">
        <SlideHtml html={html} dark={dark} className={extraClass} />
        <SlideHtml html={rightHtml} dark={dark} />
      </div>
    );
  } else if (layout === 'image-left' || layout === 'image-right') {
    body = (
      <div
        className={cn(
          'flex h-full',
          layout === 'image-left' ? 'flex-row' : 'flex-row-reverse'
        )}
      >
        {imagePanel}
        <div className="flex min-w-0 flex-1 flex-col justify-center px-12 py-10">
          <SlideHtml html={html} dark={dark} className={extraClass} />
        </div>
      </div>
    );
  } else if (layout === 'image') {
    body = (
      <div
        className="flex h-full flex-col justify-end bg-cover bg-center px-14 py-10"
        style={image ? { backgroundImage: `url("${image}")` } : undefined}
      >
        <SlideHtml html={html} dark={dark} className={extraClass} />
      </div>
    );
  } else {
    body = (
      <div
        className={cn(
          'flex h-full flex-col',
          layout === 'full' ? 'p-0' : 'px-14 py-10',
          centered && 'items-center justify-center'
        )}
      >
        <SlideHtml
          html={html}
          dark={dark}
          className={cn(centered && 'max-w-[820px]', extraClass)}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'slide overflow-hidden',
        `slide-layout-${layout}`,
        dark && 'slide-dark',
        (background || layout === 'image') && 'slide-has-background'
      )}
      style={{
        width: SLIDE_WIDTH,
        height: SLIDE_HEIGHT,
        background: background ?? undefined,
      }}
    >
      {body}
    </div>
  );
};

interface SlideViewProps {
  slide: Slide;
  dark: boolean;
  className?: string;
}

// The slide scaled to the largest size that fits its parent.
export const SlideView = ({ slide, dark, className }: SlideViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const update = () => {
      const { width, height } = container.getBoundingClientRect();
      setScale(Math.min(width / SLIDE_WIDTH, height / SLIDE_HEIGHT));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative flex h-full w-full items-center justify-center overflow-hidden',
        className
      )}
    >
      {scale > 0 && (
        <div
          className="shadow-lg"
          style={{
            width: SLIDE_WIDTH * scale,
            height: SLIDE_HEIGHT * scale,
          }}
        >
          <SlideFrame
            styles={SLIDEV_STYLES}
            style={{
              width: SLIDE_WIDTH,
              height: SLIDE_HEIGHT,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
            <SlideCanvas slide={slide} dark={dark} />
          </SlideFrame>
        </div>
      )}
    </div>
  );
};

export const resolveDeckDark = (
  headmatter: Record<string, unknown>,
  appDark: boolean
): boolean => {
  const scheme = headmatter.colorSchema;
  if (scheme === 'dark') {
    return true;
  }

  if (scheme === 'light') {
    return false;
  }

  return appDark;
};

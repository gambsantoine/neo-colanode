import { MutableRefObject, useEffect, useMemo, useRef, useState } from 'react';
import Reveal from 'reveal.js';
import revealCss from 'reveal.js/reveal.css?inline';

import { SlideFrame } from '@colanode/ui/components/presentations/slide-frame';
import { PresentationController } from '@colanode/ui/lib/presentation-controller';
import {
  buildRevealSlidesHtml,
  findRevealIndex,
  RevealDeck,
} from '@colanode/ui/lib/reveal';
import {
  getRevealThemeClass,
  loadRevealTheme,
} from '@colanode/ui/lib/reveal-themes';
import { enhanceCodeBlocks } from '@colanode/ui/lib/slides-code';
import { renderMermaidPlaceholders } from '@colanode/ui/lib/slides-mermaid';
import { cn } from '@colanode/ui/lib/utils';
import slideCodeCss from '@colanode/ui/styles/slide-code.css?inline';

type RevealApi = InstanceType<typeof Reveal>;

interface RevealViewProps {
  deck: RevealDeck;
  index: number;
  onIndexChange?: (index: number) => void;
  // Full screen presentation: keyboard shortcuts, overview, slide numbers.
  interactive?: boolean;
  // Next / previous go through the fragments, as the keyboard does.
  controllerRef?: MutableRefObject<PresentationController | null>;
  className?: string;
}

// A deck displayed by the Reveal.js engine, embedded in its parent.
export const RevealView = ({
  deck,
  index,
  onIndexChange,
  interactive = false,
  controllerRef,
  className,
}: RevealViewProps) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef<HTMLDivElement>(null);
  const slidesRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<RevealApi | null>(null);
  const [ready, setReady] = useState(false);
  // The deck lives in an iframe: only Reveal.js, its theme and Tailwind
  // style it. The engine starts once the frame is ready.
  const [frameDocument, setFrameDocument] = useState<Document | null>(null);
  const [themeCss, setThemeCss] = useState<{
    theme: string;
    css: string;
  } | null>(null);

  const html = useMemo(() => buildRevealSlidesHtml(deck), [deck]);
  const theme = deck.config.theme;

  const deckRef = useRef(deck);
  deckRef.current = deck;
  const onIndexChangeRef = useRef(onIndexChange);
  onIndexChangeRef.current = onIndexChange;

  useEffect(() => {
    let cancelled = false;
    loadRevealTheme(theme)
      .catch(() => '')
      .then((css) => {
        if (!cancelled) {
          setThemeCss({ theme, css });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [theme]);

  // The engine is created once; slides and options are updated in place.
  useEffect(() => {
    const element = revealRef.current;
    const slides = slidesRef.current;
    if (!element || !slides) {
      return;
    }

    slides.innerHTML = html;
    const config = deckRef.current.config;
    const api = new Reveal(element, {
      embedded: true,
      hash: false,
      history: false,
      respondToHashChanges: false,
      fragmentInURL: false,
      keyboard: interactive,
      overview: interactive,
      touch: interactive,
      help: false,
      mouseWheel: false,
      previewLinks: false,
      controls: config.controls,
      controlsTutorial: false,
      progress: config.progress,
      slideNumber: interactive && config.slideNumber ? 'c/t' : false,
      transition: config.transition,
      center: config.center,
      // The preview shows every fragment, the presentation reveals them.
      fragments: interactive,
      plugins: [],
    });

    let destroyed = false;
    api.initialize().then(() => {
      if (destroyed) {
        return;
      }

      apiRef.current = api;
      api.on('slidechanged', (event) => {
        const { indexh, indexv } = event as unknown as {
          indexh: number;
          indexv: number;
        };
        onIndexChangeRef.current?.(
          findRevealIndex(deckRef.current, indexh, indexv)
        );
      });
      setReady(true);
    });

    return () => {
      destroyed = true;
      apiRef.current = null;
      setReady(false);
      try {
        api.destroy();
      } catch {
        // Not initialized yet.
      }
    };
  }, [interactive, frameDocument]);

  // New content: the slides are replaced and the position kept.
  useEffect(() => {
    const api = apiRef.current;
    const slides = slidesRef.current;
    if (!api || !slides || !ready) {
      return;
    }

    const { h, v } = api.getIndices();
    slides.innerHTML = html;
    api.sync();
    api.slide(h, v);
  }, [html, ready]);

  useEffect(() => {
    const api = apiRef.current;
    if (!api || !ready) {
      return;
    }

    const { config } = deck;
    api.configure({
      controls: config.controls,
      progress: config.progress,
      transition: config.transition,
      center: config.center,
      slideNumber: interactive && config.slideNumber ? 'c/t' : false,
    });
  }, [deck, interactive, ready]);

  useEffect(() => {
    const api = apiRef.current;
    if (!controllerRef || !api || !ready) {
      return;
    }

    controllerRef.current = {
      next: () => api.next(),
      previous: () => api.prev(),
      goTo: (target) => {
        const slide = deckRef.current.slides[target];
        if (slide) {
          api.slide(slide.h, slide.v);
        }
      },
    };

    return () => {
      controllerRef.current = null;
    };
  }, [controllerRef, ready]);

  // Follows the slide selected outside (editor caret...).
  useEffect(() => {
    const api = apiRef.current;
    const slide = deck.slides[index];
    if (!api || !ready || !slide) {
      return;
    }

    const { h, v } = api.getIndices();
    if (h !== slide.h || (v ?? 0) !== slide.v) {
      api.slide(slide.h, slide.v);
    }
  }, [index, deck, ready]);

  useEffect(() => {
    const element = revealRef.current;
    if (!element || !ready) {
      return;
    }

    const cancelMermaid = renderMermaidPlaceholders(element, deck.dark);
    const removeCopy = enhanceCodeBlocks(element);
    return () => {
      cancelMermaid();
      removeCopy();
    };
  }, [html, deck.dark, ready]);

  // Reveal only listens to window resizes.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const observer = new ResizeObserver(() => apiRef.current?.layout());
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [frameDocument]);

  const styles = useMemo(
    () => [revealCss, themeCss?.css ?? '', slideCodeCss],
    [themeCss]
  );

  return (
    <div className={cn('relative h-full w-full overflow-hidden', className)}>
      <SlideFrame
        styles={styles}
        title="Presentation"
        onReady={setFrameDocument}
        style={{ width: '100%', height: '100%' }}
      >
        <div
          ref={viewportRef}
          className={cn(
            'reveal-viewport',
            getRevealThemeClass(theme),
            deck.dark ? 'slide-code-dark' : 'slide-code-light'
          )}
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            visibility: themeCss?.theme === theme ? 'visible' : 'hidden',
          }}
        >
          <div ref={revealRef} className="reveal">
            <div ref={slidesRef} className="slides" />
          </div>
        </div>
      </SlideFrame>
    </div>
  );
};

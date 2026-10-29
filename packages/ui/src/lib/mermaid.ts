type MermaidApi = typeof import('mermaid').default;

export const DEFAULT_MERMAID_CODE = `flowchart TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B
`;

export const MERMAID_FILE_EXTENSION = '.mmd';

let enginePromise: Promise<MermaidApi> | null = null;

// Mermaid (~2 MB) is loaded on first use so it stays out of the main bundle.
const loadEngine = (): Promise<MermaidApi> => {
  if (!enginePromise) {
    enginePromise = import('mermaid')
      .then((module) => module.default)
      .catch((error) => {
        enginePromise = null;
        throw error;
      });
  }

  return enginePromise;
};

// Mermaid keeps its configuration globally, so renderings (which may use
// different themes) run one at a time.
let queue: Promise<unknown> = Promise.resolve();
let renderCount = 0;

const CACHE_LIMIT = 50;
const cache = new Map<string, string>();

// Mermaid sizes its SVG with width="100%" and a max-width style, which gives
// no intrinsic size once displayed through an <img>. Use the viewBox instead.
export const setMermaidSvgSize = (svg: string): string => {
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const root = document.documentElement;
  const viewBox = root
    .getAttribute('viewBox')
    ?.split(/[\s,]+/)
    .map(Number);
  if (!viewBox || viewBox.length !== 4 || viewBox.some(Number.isNaN)) {
    return svg;
  }

  root.setAttribute('width', String(Math.ceil(viewBox[2]!)));
  root.setAttribute('height', String(Math.ceil(viewBox[3]!)));
  root.style.removeProperty('max-width');
  return new XMLSerializer().serializeToString(root);
};

export const renderMermaid = (
  code: string,
  options: { dark?: boolean } = {}
): Promise<string> => {
  const dark = options.dark ?? false;
  const key = `${dark ? 'd' : 'l'}:${code}`;
  const cached = cache.get(key);
  if (cached) {
    return Promise.resolve(cached);
  }

  const render = async () => {
    const mermaid = await loadEngine();
    mermaid.initialize({
      startOnLoad: false,
      theme: dark ? 'dark' : 'default',
      securityLevel: 'strict',
      // Plain SVG text instead of HTML labels, so the diagram renders inside
      // an <img> and can be exported to PNG through a canvas.
      htmlLabels: false,
      flowchart: { htmlLabels: false },
      suppressErrorRendering: true,
    });

    renderCount += 1;
    const { svg } = await mermaid.render(`mermaid-${renderCount}`, code);
    const sized = setMermaidSvgSize(svg);

    cache.set(key, sized);
    if (cache.size > CACHE_LIMIT) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) {
        cache.delete(oldest);
      }
    }

    return sized;
  };

  const result = queue.then(render, render);
  queue = result.catch(() => undefined);
  return result;
};

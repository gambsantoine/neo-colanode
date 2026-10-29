type RenderToString = typeof import('@plantuml/core').renderToString;

export const DEFAULT_PLANTUML_CODE = `@startuml
Alice -> Bob: Hello
Bob --> Alice: Hi!
@enduml
`;

export const PLANTUML_FILE_EXTENSION = '.puml';
export const PLANTUML_MIME_TYPE = 'text/plain';

interface PlantUmlGlobals {
  Viz?: { instance?: unknown };
  PLANTUML_VIZ?: unknown;
}

let enginePromise: Promise<RenderToString> | null = null;

// The engine (~5 MB with Graphviz) is loaded on first use so it stays out of
// the main bundle. Nothing is fetched from the network: the stdlib/sprite
// includes (`!include <C4/...>`) are not available offline and will error.
const loadEngine = (): Promise<RenderToString> => {
  if (!enginePromise) {
    enginePromise = (async () => {
      const globals = globalThis as PlantUmlGlobals;
      const vizModule = await import('@plantuml/core/viz-global.js');

      // viz-global.js is a UMD bundle: loaded through a bundler it attaches
      // Viz to the module exports instead of the global object.
      const viz = globals.Viz ?? vizModule?.default ?? vizModule;
      if (viz && typeof viz.instance === 'function') {
        globals.PLANTUML_VIZ = viz;
      }

      // Importing themes.js registers the bundled `!theme` definitions.
      await import('@plantuml/core/themes.js');
      const engine = await import('@plantuml/core');
      return engine.renderToString;
    })().catch((error) => {
      enginePromise = null;
      throw error;
    });
  }

  return enginePromise;
};

const CACHE_LIMIT = 50;
const cache = new Map<string, string>();

export interface PlantUmlRenderOptions {
  dark?: boolean;
}

export const renderPlantUml = async (
  code: string,
  options: PlantUmlRenderOptions = {}
): Promise<string> => {
  const dark = options.dark ?? false;
  const key = `${dark ? 'd' : 'l'}:${code}`;
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }

  const renderToString = await loadEngine();
  const svg = await new Promise<string>((resolve, reject) => {
    renderToString(
      code.split(/\r?\n/),
      resolve,
      (message) => reject(new Error(message)),
      { dark }
    );
  });

  cache.set(key, svg);
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) {
      cache.delete(oldest);
    }
  }

  return svg;
};

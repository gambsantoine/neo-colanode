declare module '@plantuml/core' {
  interface PlantUmlRenderOptions {
    dark?: boolean;
    maxSvgSize?: number;
  }

  export function render(
    lines: string[],
    targetId: string,
    options?: PlantUmlRenderOptions | null
  ): void;

  export function renderToString(
    lines: string[],
    onSuccess: (svg: string) => void,
    onError: (message: string) => void,
    options?: PlantUmlRenderOptions | null
  ): void;
}

declare module '@plantuml/core/viz-global.js';
declare module '@plantuml/core/themes.js';

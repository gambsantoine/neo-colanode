import { RevealTheme } from '@colanode/ui/lib/reveal';

// Reveal.js themes are loaded on first use (they embed their fonts, ~500 KB
// each). Remote font imports are dropped, so decks work offline.
const loaders: Record<RevealTheme, () => Promise<{ default: string }>> = {
  black: () => import('reveal.js/theme/black.css?inline'),
  white: () => import('reveal.js/theme/white.css?inline'),
  dracula: () => import('reveal.js/theme/dracula.css?inline'),
  serif: () => import('reveal.js/theme/serif.css?inline'),
  solarized: () => import('reveal.js/theme/solarized.css?inline'),
  'black-contrast': () => import('reveal.js/theme/black-contrast.css?inline'),
  'white-contrast': () => import('reveal.js/theme/white-contrast.css?inline'),
};

export const getRevealThemeClass = (theme: RevealTheme) =>
  `reveal-theme-${theme}`;

const loading = new Map<RevealTheme, Promise<string>>();

// `:root` and every `.reveal` / `.reveal-viewport` rule are prefixed with the
// theme class, which is set on the deck viewport (see RevealView).
export const scopeThemeCss = (css: string, scope: string): string =>
  css
    // No remote stylesheets (fonts): fallback fonts are used instead.
    .replace(/@import\s+[^;]+;/g, '')
    .replace(/:root\b/g, `.${scope}`)
    .replace(
      /(^|[{},])(\s*)\.reveal-viewport\b/g,
      `$1$2.${scope}.reveal-viewport`
    )
    .replace(
      /(^|[{},])(\s*)\.reveal(?=[\s.,:{[>#~+])/g,
      `$1$2.${scope} .reveal`
    )
    .replace(/(^|[{},])(\s*)section\.has-/g, `$1$2.${scope} section.has-`);

// The theme stylesheet, scoped to its class (see scopeThemeCss), for the
// frame displaying the deck. Loaded once per theme.
export const loadRevealTheme = (theme: RevealTheme): Promise<string> => {
  let promise = loading.get(theme);
  if (!promise) {
    promise = loaders[theme]()
      .then((module) =>
        scopeThemeCss(module.default, getRevealThemeClass(theme))
      )
      .catch((error) => {
        loading.delete(theme);
        throw error;
      });

    loading.set(theme, promise);
  }

  return promise;
};

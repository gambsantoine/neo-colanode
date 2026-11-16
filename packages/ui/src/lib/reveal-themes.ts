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

const loading = new Map<RevealTheme, Promise<void>>();

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

// Themes set their variables on `:root`: they are scoped to a class instead,
// so several themes can be displayed at once without touching the app.
export const loadRevealTheme = (theme: RevealTheme): Promise<void> => {
  let promise = loading.get(theme);
  if (!promise) {
    promise = loaders[theme]()
      .then((module) => {
        const style = document.createElement('style');
        style.dataset.revealTheme = theme;
        style.textContent = scopeThemeCss(
          module.default,
          getRevealThemeClass(theme)
        );
        document.head.appendChild(style);
      })
      .catch((error) => {
        loading.delete(theme);
        throw error;
      });

    loading.set(theme, promise);
  }

  return promise;
};

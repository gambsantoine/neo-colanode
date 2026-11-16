// Stylesheets imported as text (Vite `?inline`).
declare module '*.css?inline' {
  const css: string;
  export default css;
}

// Stylesheets imported as text (Vite `?inline`).
declare module '*.css?inline' {
  const css: string;
  export default css;
}

// Assets imported as URLs (Vite `?url`).
declare module '*?url' {
  const url: string;
  export default url;
}

// Web workers (Vite `?worker`).
declare module '*?worker' {
  const WorkerConstructor: new () => Worker;
  export default WorkerConstructor;
}

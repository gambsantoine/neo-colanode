import * as Comlink from 'comlink';
import { createRoot } from 'react-dom/client';

import { eventBus } from '@colanode/client/lib';
import type { ExportToPdfResult } from '@colanode/ui';
import { BrowserNotSupported } from '@colanode/web/components/browser-not-supported';
import { MobileNotSupported } from '@colanode/web/components/mobile-not-supported';
import { ColanodeWorkerApi } from '@colanode/web/lib/types';
import { isMobileDevice, isOpfsSupported } from '@colanode/web/lib/utils';
import { Root } from '@colanode/web/root';
import DedicatedWorker from '@colanode/web/workers/dedicated?worker';

// Blocks scripts, plugins and external fetches in the printed document as a
// second layer of defense on top of the iframe sandbox.
const PDF_CSP =
  "default-src 'none'; img-src data: blob: https: http:; style-src 'unsafe-inline'; font-src data:";

const injectCsp = (html: string): string => {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${PDF_CSP}">`;
  // The CSP meta must come before any other content to apply to it.
  const headMatch = /<head[^>]*>/i.exec(html);
  if (headMatch) {
    const index = headMatch.index + headMatch[0].length;
    return html.slice(0, index) + meta + html.slice(index);
  }
  return meta + html;
};

const PRINT_CLEANUP_TIMEOUT_MS = 60_000;

// Prints untrusted document HTML from a hidden sandboxed iframe. The sandbox
// omits `allow-scripts`, so inline scripts, event handlers and javascript:
// URLs never run inside it; `allow-same-origin` is only there so this
// (trusted) parent code can call contentWindow.print(). `allow-modals` is
// required for print() to be allowed in a sandboxed frame. Using an iframe
// instead of a popup also avoids popup blockers.
const printHtmlInSandbox = (html: string): Promise<ExportToPdfResult> =>
  new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', 'allow-modals allow-same-origin');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.position = 'fixed';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';

    let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      if (cleanupTimer) {
        clearTimeout(cleanupTimer);
      }
      iframe.remove();
    };

    // Attach the handler before setting srcdoc so load can't be missed.
    iframe.addEventListener(
      'load',
      () => {
        const frameWindow = iframe.contentWindow;
        if (!frameWindow) {
          cleanup();
          resolve({ status: 'failed', error: 'Unable to prepare document' });
          return;
        }

        try {
          frameWindow.addEventListener('afterprint', cleanup, { once: true });
          // Fallback in case afterprint never fires (some browsers).
          cleanupTimer = setTimeout(cleanup, PRINT_CLEANUP_TIMEOUT_MS);
          frameWindow.focus();
          frameWindow.print();
          resolve({ status: 'print-dialog' });
        } catch (error) {
          cleanup();
          resolve({
            status: 'failed',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
      { once: true }
    );

    iframe.srcdoc = injectCsp(html);
    document.body.appendChild(iframe);
  });

const initializeApp = async () => {
  const isMobile = isMobileDevice();
  if (isMobile) {
    const root = createRoot(document.getElementById('root') as HTMLElement);
    root.render(<MobileNotSupported />);
    return;
  }

  const hasOpfsSupport = await isOpfsSupported();
  if (!hasOpfsSupport) {
    const root = createRoot(document.getElementById('root') as HTMLElement);
    root.render(<BrowserNotSupported />);
    return;
  }

  const worker = new DedicatedWorker();
  const workerApi = Comlink.wrap<ColanodeWorkerApi>(worker);

  window.colanode = {
    init: async () => {
      return workerApi.init();
    },
    reset: async () => {
      await workerApi.reset();
      window.location.reload();
    },
    executeMutation: async (input) => {
      return workerApi.executeMutation(input);
    },
    executeQuery: async (input) => {
      return workerApi.executeQuery(input);
    },
    executeQueryAndSubscribe: async (key, input) => {
      return workerApi.executeQueryAndSubscribe(key, input);
    },
    saveTempFile: async (file) => {
      return workerApi.saveTempFile(file);
    },
    unsubscribeQuery: async (queryId) => {
      return workerApi.unsubscribeQuery(queryId);
    },
    openExternalUrl: async (url) => {
      window.open(url, '_blank');
    },
    showItemInFolder: async () => {
      // No-op on web
    },
    showFileSaveDialog: async () => undefined,
    exportToPdf: async ({ html }) => {
      try {
        return await printHtmlInSandbox(html);
      } catch (error) {
        return {
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };

  window.eventBus = eventBus;

  workerApi.subscribe(
    Comlink.proxy((event) => {
      eventBus.publish(event);
    })
  );

  const root = createRoot(document.getElementById('root') as HTMLElement);
  root.render(<Root />);
};

initializeApp().catch(() => {
  const root = createRoot(document.getElementById('root') as HTMLElement);
  root.render(<BrowserNotSupported />);
});

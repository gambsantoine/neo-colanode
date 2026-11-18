import { Block, BlockLeaf, slugify, uniqueSlug } from '@colanode/core';
import { escapeHtml, isSafeUrl } from '@colanode/server/lib/wikis/html';

export interface WikiLinkTarget {
  href: string;
  name: string;
  type: string;
}

export interface WikiFileTarget {
  href: string;
  name: string;
  mimeType: string;
  size: number;
}

export interface BlockRenderContext {
  // Link to another node of the published wiki, null when it is not public.
  nodeLink: (nodeId: string) => WikiLinkTarget | null;
  file: (fileId: string) => WikiFileTarget | null;
  userName: (userId: string) => string | null;
  // Read-only HTML of a database of the wiki, null when it is not public.
  database: (databaseId: string) => string | null;
}

export interface WikiHeading {
  id: string;
  level: number;
  text: string;
}

export interface RenderedDocument {
  html: string;
  headings: WikiHeading[];
}

// Images that browsers display safely. SVG is excluded on purpose: it can
// carry scripts and is always served as a download.
export const INLINE_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/avif',
]);

const HEADING_LEVELS: Record<string, number> = {
  heading1: 2,
  heading2: 3,
  heading3: 4,
};

const formatSize = (size: number) => {
  if (size < 1024) {
    return `${size} o`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(0)} Ko`;
  }

  return `${(size / 1024 / 1024).toFixed(1)} Mo`;
};

class BlockRenderer {
  private readonly childrenByParent = new Map<string, Block[]>();
  private readonly headingIds = new Set<string>();
  public readonly headings: WikiHeading[] = [];

  constructor(
    blocks: Record<string, Block>,
    private readonly context: BlockRenderContext
  ) {
    for (const block of Object.values(blocks)) {
      const list = this.childrenByParent.get(block.parentId) ?? [];
      list.push(block);
      this.childrenByParent.set(block.parentId, list);
    }

    for (const list of this.childrenByParent.values()) {
      list.sort((a, b) => (a.index < b.index ? -1 : a.index > b.index ? 1 : 0));
    }
  }

  public renderChildren(parentId: string, depth = 0): string {
    // Documents are shallow; the limit protects against corrupted cycles.
    if (depth > 50) {
      return '';
    }

    return (this.childrenByParent.get(parentId) ?? [])
      .map((block) => this.renderBlock(block, depth))
      .join('');
  }

  private renderBlock(block: Block, depth: number): string {
    const children = () => this.renderChildren(block.id, depth + 1);
    const inline = () => this.renderLeafs(block.content);

    switch (block.type) {
      case 'paragraph':
        return `<p>${inline()}</p>`;
      case 'heading1':
      case 'heading2':
      case 'heading3': {
        const level = HEADING_LEVELS[block.type]!;
        const text = (block.content ?? [])
          .map((leaf) => leaf.text ?? '')
          .join('');
        const id = uniqueSlug(slugify(text) || 'section', this.headingIds);
        this.headingIds.add(id);
        this.headings.push({ id, level, text });
        return `<h${level} id="${id}"><a class="anchor" href="#${id}" aria-hidden="true">#</a>${inline()}</h${level}>`;
      }
      case 'blockquote':
        return `<blockquote>${children()}</blockquote>`;
      case 'bulletList':
        return `<ul>${children()}</ul>`;
      case 'orderedList':
        return `<ol>${children()}</ol>`;
      case 'listItem':
        return `<li>${children()}</li>`;
      case 'taskList':
        return `<ul class="tasks">${children()}</ul>`;
      case 'taskItem': {
        const checked = block.attrs?.checked === true;
        return `<li class="task${checked ? ' done' : ''}"><span class="box" aria-label="${checked ? 'Fait' : 'À faire'}">${checked ? '✓' : ''}</span><div>${children()}</div></li>`;
      }
      case 'horizontalRule':
        return '<hr>';
      case 'codeBlock': {
        const language =
          typeof block.attrs?.language === 'string' ? block.attrs.language : '';
        const code = (block.content ?? [])
          .map((leaf) => leaf.text ?? '')
          .join('');
        const label = language
          ? `<span class="code-lang">${escapeHtml(language)}</span>`
          : '';
        return `<div class="code">${label}<pre><code>${escapeHtml(code)}</code></pre></div>`;
      }
      case 'plantuml': {
        const code =
          typeof block.attrs?.code === 'string' ? block.attrs.code : '';
        return `<figure class="plantuml"><pre data-plantuml><code>${escapeHtml(code)}</code></pre><figcaption>Diagramme PlantUML</figcaption></figure>`;
      }
      case 'table':
        return `<div class="table"><table><tbody>${children()}</tbody></table></div>`;
      case 'tableRow':
        return `<tr>${children()}</tr>`;
      case 'tableHeader':
      case 'tableCell': {
        const tag = block.type === 'tableHeader' ? 'th' : 'td';
        const colspan =
          Number(block.attrs?.colspan) > 1
            ? ` colspan="${Number(block.attrs?.colspan)}"`
            : '';
        const rowspan =
          Number(block.attrs?.rowspan) > 1
            ? ` rowspan="${Number(block.attrs?.rowspan)}"`
            : '';
        return `<${tag}${colspan}${rowspan}>${children()}</${tag}>`;
      }
      case 'file':
        return this.renderFile(block.id);
      case 'page':
      case 'folder': {
        const target = this.context.nodeLink(block.id);
        if (!target) {
          return '';
        }

        return `<a class="node-link" href="${escapeHtml(target.href)}"><span class="node-type">${target.type === 'folder' ? 'Dossier' : 'Page'}</span>${escapeHtml(target.name)}</a>`;
      }
      case 'database': {
        const html = this.context.database(block.id);
        return html ?? '';
      }
      default:
        // Unknown containers still show their content.
        return children();
    }
  }

  private renderFile(fileId: string): string {
    const file = this.context.file(fileId);
    if (!file) {
      return '';
    }

    if (INLINE_IMAGE_TYPES.has(file.mimeType)) {
      return `<figure class="image"><img src="${escapeHtml(file.href)}" alt="${escapeHtml(file.name)}" loading="lazy"></figure>`;
    }

    return `<a class="file" href="${escapeHtml(file.href)}" download><span class="file-name">${escapeHtml(file.name)}</span><span class="file-size">${formatSize(file.size)}</span></a>`;
  }

  private renderLeafs(leafs: BlockLeaf[] | null | undefined): string {
    if (!leafs) {
      return '';
    }

    return leafs.map((leaf) => this.renderLeaf(leaf)).join('');
  }

  private renderLeaf(leaf: BlockLeaf): string {
    if (leaf.type === 'hardBreak') {
      return '<br>';
    }

    if (leaf.type === 'mention') {
      const target =
        typeof leaf.attrs?.target === 'string' ? leaf.attrs.target : null;
      const name = target ? this.context.userName(target) : null;
      return `<span class="mention">@${escapeHtml(name ?? 'utilisateur')}</span>`;
    }

    let html = escapeHtml(leaf.text ?? '');
    for (const mark of leaf.marks ?? []) {
      switch (mark.type) {
        case 'bold':
          html = `<strong>${html}</strong>`;
          break;
        case 'italic':
          html = `<em>${html}</em>`;
          break;
        case 'underline':
          html = `<u>${html}</u>`;
          break;
        case 'strike':
          html = `<s>${html}</s>`;
          break;
        case 'code':
          html = `<code>${html}</code>`;
          break;
        case 'highlight':
          html = `<mark>${html}</mark>`;
          break;
        case 'link':
          if (isSafeUrl(mark.attrs?.href)) {
            html = `<a href="${escapeHtml(mark.attrs!.href)}" rel="noopener noreferrer nofollow">${html}</a>`;
          }
          break;
        default:
          break;
      }
    }

    return html;
  }
}

export const renderDocumentBlocks = (
  documentId: string,
  blocks: Record<string, Block> | null | undefined,
  context: BlockRenderContext
): RenderedDocument => {
  if (!blocks) {
    return { html: '', headings: [] };
  }

  const renderer = new BlockRenderer(blocks, context);
  const html = renderer.renderChildren(documentId);
  return { html, headings: renderer.headings };
};

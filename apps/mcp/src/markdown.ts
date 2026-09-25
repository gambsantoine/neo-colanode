import { generateKeyBetween } from 'fractional-indexing-jittered';
import { marked, Token, Tokens } from 'marked';
import { monotonicFactory } from 'ulid';

/**
 * Conversion between Markdown and the Colanode rich text document format:
 * a flat map of blocks linked by `parentId` (the node id for top level
 * blocks) and ordered by a fractional `index`. Leaf blocks (paragraphs,
 * headings, code) hold inline `content`; container blocks (lists, quotes,
 * tables) hold child blocks.
 */

export type BlockLeaf = {
  type: string;
  text?: string | null;
  attrs?: Record<string, unknown> | null;
  marks?: { type: string; attrs?: Record<string, unknown> | null }[] | null;
};

export type Block = {
  id: string;
  type: string;
  parentId: string;
  index: string;
  content?: BlockLeaf[] | null;
  attrs?: Record<string, unknown> | null;
};

export type RichTextContent = {
  type: 'rich_text';
  blocks: Record<string, Block>;
};

type Mark = NonNullable<BlockLeaf['marks']>[number];

/** Intermediate tree, before ids and indexes are assigned. */
type TreeNode = {
  type: string;
  attrs?: Record<string, unknown>;
  leafs?: BlockLeaf[];
  children?: TreeNode[];
  /** Existing block kept as is (embedded pages, files, ...). */
  keep?: Block;
};

const LEAF_TYPES = new Set([
  'paragraph',
  'heading1',
  'heading2',
  'heading3',
  'horizontalRule',
  'codeBlock',
]);

// Blocks Markdown cannot express are written as this comment so a round trip
// keeps them.
const KEEP_COMMENT = /^<!--\s*colanode:([\w-]+):([\w-]+)\s*-->$/;

const ulid = monotonicFactory();
const generateBlockId = () => ulid().toLowerCase() + 'bl';

const byIndex = (a: Block, b: Block) =>
  a.index < b.index ? -1 : a.index > b.index ? 1 : 0;

// ---------------------------------------------------------------------------
// Markdown -> blocks

const inlineToLeafs = (tokens: Token[] | undefined, marks: Mark[] = []) => {
  const leafs: BlockLeaf[] = [];

  const pushText = (text: string, extra: Mark[] = []) => {
    if (!text) {
      return;
    }

    const all = [...marks, ...extra];
    leafs.push({ type: 'text', text, ...(all.length > 0 && { marks: all }) });
  };

  for (const token of tokens ?? []) {
    switch (token.type) {
      case 'strong':
        leafs.push(
          ...inlineToLeafs(token.tokens, [...marks, { type: 'bold' }])
        );
        break;
      case 'em':
        leafs.push(
          ...inlineToLeafs(token.tokens, [...marks, { type: 'italic' }])
        );
        break;
      case 'del':
        leafs.push(
          ...inlineToLeafs(token.tokens, [...marks, { type: 'strike' }])
        );
        break;
      case 'link':
        leafs.push(
          ...inlineToLeafs(token.tokens, [
            ...marks,
            { type: 'link', attrs: { href: token.href } },
          ])
        );
        break;
      case 'codespan':
        pushText(decodeEntities(token.text), [{ type: 'code' }]);
        break;
      case 'br':
        leafs.push({ type: 'hardBreak' });
        break;
      case 'image':
        pushText(token.text || token.href, [
          { type: 'link', attrs: { href: token.href } },
        ]);
        break;
      case 'text':
        if ('tokens' in token && token.tokens && token.tokens.length > 0) {
          leafs.push(...inlineToLeafs(token.tokens, marks));
        } else {
          pushText(decodeEntities(token.text));
        }
        break;
      case 'escape':
      case 'html':
        pushText(decodeEntities(token.text ?? token.raw));
        break;
      default:
        pushText(token.raw);
    }
  }

  return leafs;
};

const decodeEntities = (text: string) =>
  text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

const paragraph = (tokens: Token[] | undefined): TreeNode => ({
  type: 'paragraph',
  leafs: inlineToLeafs(tokens),
});

const listItemChildren = (item: Tokens.ListItem, keep: KeepLookup) => {
  const children: TreeNode[] = [];
  for (const token of item.tokens) {
    if (token.type === 'text') {
      children.push(paragraph((token as Tokens.Text).tokens));
    } else if (token.type === 'checkbox') {
      continue;
    } else {
      children.push(...tokensToTree([token], keep));
    }
  }

  return children.length > 0 ? children : [{ type: 'paragraph', leafs: [] }];
};

const tableCell = (type: string, cell: Tokens.TableCell): TreeNode => ({
  type,
  attrs: { colspan: 1, rowspan: 1, colwidth: null },
  children: [paragraph(cell.tokens)],
});

type KeepLookup = (id: string) => Block | undefined;

const tokensToTree = (tokens: Token[], keep: KeepLookup): TreeNode[] => {
  const nodes: TreeNode[] = [];

  for (const token of tokens) {
    switch (token.type) {
      case 'heading': {
        const level = Math.min(Math.max(token.depth, 1), 3);
        nodes.push({
          type: `heading${level}`,
          leafs: inlineToLeafs(token.tokens),
        });
        break;
      }
      case 'paragraph':
        nodes.push(paragraph(token.tokens));
        break;
      case 'text':
        nodes.push(
          paragraph(token.tokens ?? [{ ...token, tokens: undefined }])
        );
        break;
      case 'code':
        nodes.push({
          type: 'codeBlock',
          attrs: { language: token.lang || 'plaintext' },
          leafs: token.text ? [{ type: 'text', text: token.text }] : [],
        });
        break;
      case 'hr':
        nodes.push({ type: 'horizontalRule' });
        break;
      case 'blockquote':
        nodes.push({
          type: 'blockquote',
          children: tokensToTree(token.tokens ?? [], keep),
        });
        break;
      case 'list': {
        const list = token as Tokens.List;
        const isTask = list.items.some((item) => item.task);
        if (isTask) {
          nodes.push({
            type: 'taskList',
            children: list.items.map((item) => ({
              type: 'taskItem',
              attrs: { checked: Boolean(item.checked) },
              children: listItemChildren(item, keep),
            })),
          });
        } else {
          nodes.push({
            type: list.ordered ? 'orderedList' : 'bulletList',
            ...(list.ordered &&
              typeof list.start === 'number' &&
              list.start !== 1 && { attrs: { start: list.start } }),
            children: list.items.map((item) => ({
              type: 'listItem',
              children: listItemChildren(item, keep),
            })),
          });
        }
        break;
      }
      case 'table': {
        const table = token as Tokens.Table;
        nodes.push({
          type: 'table',
          children: [
            {
              type: 'tableRow',
              children: table.header.map((cell) =>
                tableCell('tableHeader', cell)
              ),
            },
            ...table.rows.map((row) => ({
              type: 'tableRow',
              children: row.map((cell) => tableCell('tableCell', cell)),
            })),
          ],
        });
        break;
      }
      case 'html': {
        const match = token.text.trim().match(KEEP_COMMENT);
        const kept = match?.[2] ? keep(match[2]) : undefined;
        if (kept) {
          nodes.push({ type: kept.type, keep: kept });
        } else {
          nodes.push({
            type: 'paragraph',
            leafs: [{ type: 'text', text: token.text.trim() }],
          });
        }
        break;
      }
      case 'space':
        break;
      default:
        if (token.raw.trim()) {
          nodes.push({
            type: 'paragraph',
            leafs: [{ type: 'text', text: token.raw.trim() }],
          });
        }
    }
  }

  return nodes;
};

/**
 * Assigns ids and indexes. Blocks at the same position with the same type as
 * in `previous` keep their id, so an edit only changes what really changed
 * in the Yjs document.
 */
const flatten = (
  nodes: TreeNode[],
  parentId: string,
  previous: Block[],
  output: Record<string, Block>,
  startIndex: string | null = null
) => {
  const previousChildren = previous
    .filter((block) => block.parentId === parentId)
    .sort(byIndex);

  let index = startIndex;
  nodes.forEach((node, position) => {
    index = generateKeyBetween(index, null);

    if (node.keep) {
      output[node.keep.id] = { ...node.keep, parentId, index };
      copyDescendants(node.keep.id, previous, output);
      return;
    }

    const match = previousChildren[position];
    const id = match && match.type === node.type ? match.id : generateBlockId();

    const block: Block = { id, type: node.type, parentId, index };
    if (node.attrs && Object.keys(node.attrs).length > 0) {
      block.attrs = node.attrs;
    }

    if (LEAF_TYPES.has(node.type)) {
      block.content = node.leafs && node.leafs.length > 0 ? node.leafs : null;
    }

    output[id] = block;

    if (node.children) {
      flatten(node.children, id, previous, output);
    }
  });

  return index;
};

const copyDescendants = (
  parentId: string,
  previous: Block[],
  output: Record<string, Block>
) => {
  for (const block of previous) {
    if (block.parentId === parentId) {
      output[block.id] = block;
      copyDescendants(block.id, previous, output);
    }
  }
};

const parseMarkdown = (markdown: string, previous: Block[]) => {
  const byId = new Map(previous.map((block) => [block.id, block]));
  const tokens = marked.lexer(markdown, { gfm: true });
  return tokensToTree(tokens, (id) => byId.get(id));
};

/** Replaces the whole document with `markdown`. */
export const markdownToContent = (
  documentId: string,
  markdown: string,
  current: RichTextContent | null
): RichTextContent => {
  const previous = current ? Object.values(current.blocks) : [];
  const blocks: Record<string, Block> = {};
  flatten(parseMarkdown(markdown, previous), documentId, previous, blocks);
  return { type: 'rich_text', blocks };
};

/** Adds `markdown` after the last top level block, keeping the rest as is. */
export const appendMarkdownToContent = (
  documentId: string,
  markdown: string,
  current: RichTextContent | null
): RichTextContent => {
  const blocks: Record<string, Block> = { ...(current?.blocks ?? {}) };
  const lastIndex =
    Object.values(blocks)
      .filter((block) => block.parentId === documentId)
      .sort(byIndex)
      .at(-1)?.index ?? null;

  flatten(parseMarkdown(markdown, []), documentId, [], blocks, lastIndex);
  return { type: 'rich_text', blocks };
};

// ---------------------------------------------------------------------------
// Blocks -> Markdown

// Marks wrapping text, outermost first. Consecutive leafs sharing a mark are
// rendered inside a single wrapper ("**a `b`**", not "**a ****`b`**").
const WRAPPER_ORDER = ['bold', 'italic', 'strike', 'link'];

type Wrapper = { key: string; open: string; close: string };

const toWrapper = (mark: Mark): Wrapper | null => {
  switch (mark.type) {
    case 'bold':
      return { key: 'bold', open: '**', close: '**' };
    case 'italic':
      return { key: 'italic', open: '*', close: '*' };
    case 'strike':
      return { key: 'strike', open: '~~', close: '~~' };
    case 'link': {
      const href = String(mark.attrs?.href ?? '');
      return { key: `link:${href}`, open: '[', close: `](${href})` };
    }
    default:
      return null;
  }
};

const wrappersOf = (leaf: BlockLeaf) =>
  [...(leaf.marks ?? [])]
    .sort(
      (a, b) => WRAPPER_ORDER.indexOf(a.type) - WRAPPER_ORDER.indexOf(b.type)
    )
    .map(toWrapper)
    .filter((wrapper): wrapper is Wrapper => wrapper !== null);

const renderLeafText = (leaf: BlockLeaf): string => {
  if (leaf.type === 'hardBreak') {
    return '  \n';
  }

  if (leaf.type === 'mention') {
    const label = leaf.attrs?.label ?? leaf.attrs?.name ?? leaf.attrs?.id;
    return `@${String(label ?? '')}`;
  }

  const text = leaf.text ?? '';
  return leaf.marks?.some((mark) => mark.type === 'code')
    ? `\`${text}\``
    : text;
};

const renderInline = (block: Block) => {
  let output = '';
  const open: Wrapper[] = [];

  for (const leaf of block.content ?? []) {
    // Line breaks and mentions stay inside the current wrappers.
    const wanted = leaf.type === 'text' ? wrappersOf(leaf) : open.slice();

    let shared = 0;
    while (
      shared < open.length &&
      shared < wanted.length &&
      open[shared]?.key === wanted[shared]?.key
    ) {
      shared++;
    }

    while (open.length > shared) {
      output += open.pop()?.close ?? '';
    }

    for (const wrapper of wanted.slice(shared)) {
      output += wrapper.open;
      open.push(wrapper);
    }

    output += renderLeafText(leaf);
  }

  while (open.length > 0) {
    output += open.pop()?.close ?? '';
  }

  return output;
};

const indent = (text: string, prefix: string) =>
  text
    .split('\n')
    .map((line) => (line ? prefix + line : line))
    .join('\n');

const renderChildren = (parentId: string, blocks: Block[]): string[] =>
  blocks
    .filter((block) => block.parentId === parentId)
    .sort(byIndex)
    .map((block) => renderBlock(block, blocks));

const renderListItem = (item: Block, blocks: Block[], bullet: string) => {
  const [first = '', ...rest] = renderChildren(item.id, blocks);
  const body = [first, ...rest.map((part) => indent(part, '  '))].join('\n');
  return `${bullet}${body}`;
};

const renderTable = (table: Block, blocks: Block[]) => {
  const rows = blocks
    .filter((block) => block.parentId === table.id)
    .sort(byIndex)
    .map((row) =>
      renderChildren(row.id, blocks).map((cell) =>
        cell.replace(/\n+/g, ' ').replace(/\|/g, '\\|')
      )
    );

  if (rows.length === 0) {
    return '';
  }

  const width = Math.max(...rows.map((row) => row.length));
  const line = (cells: string[]) =>
    `| ${Array.from({ length: width }, (_, i) => cells[i] ?? '').join(' | ')} |`;

  return [
    line(rows[0] ?? []),
    line(Array.from({ length: width }, () => '---')),
    ...rows.slice(1).map(line),
  ].join('\n');
};

const renderBlock = (block: Block, blocks: Block[]): string => {
  switch (block.type) {
    case 'paragraph':
      return renderInline(block);
    case 'heading1':
      return `# ${renderInline(block)}`;
    case 'heading2':
      return `## ${renderInline(block)}`;
    case 'heading3':
      return `### ${renderInline(block)}`;
    case 'horizontalRule':
      return '---';
    case 'codeBlock': {
      const language = block.attrs?.language;
      const code = (block.content ?? [])
        .map((leaf) => leaf.text ?? '')
        .join('');
      return `\`\`\`${language && language !== 'plaintext' ? String(language) : ''}\n${code}\n\`\`\``;
    }
    case 'blockquote':
      return renderChildren(block.id, blocks)
        .join('\n\n')
        .split('\n')
        .map((line) => (line ? `> ${line}` : '>'))
        .join('\n');
    case 'bulletList':
      return blocks
        .filter((child) => child.parentId === block.id)
        .sort(byIndex)
        .map((item) => renderListItem(item, blocks, '- '))
        .join('\n');
    case 'orderedList': {
      const start = Number(block.attrs?.start ?? 1);
      return blocks
        .filter((child) => child.parentId === block.id)
        .sort(byIndex)
        .map((item, i) => renderListItem(item, blocks, `${start + i}. `))
        .join('\n');
    }
    case 'taskList':
      return blocks
        .filter((child) => child.parentId === block.id)
        .sort(byIndex)
        .map((item) =>
          renderListItem(
            item,
            blocks,
            item.attrs?.checked ? '- [x] ' : '- [ ] '
          )
        )
        .join('\n');
    case 'table':
      return renderTable(block, blocks);
    case 'tableRow':
    case 'tableCell':
    case 'tableHeader':
    case 'listItem':
    case 'taskItem':
      return renderChildren(block.id, blocks).join('\n');
    default:
      return `<!-- colanode:${block.type}:${block.id} -->`;
  }
};

export const contentToMarkdown = (
  documentId: string,
  content: RichTextContent | null
): string => {
  if (!content) {
    return '';
  }

  return renderChildren(documentId, Object.values(content.blocks)).join('\n\n');
};

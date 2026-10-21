import { mergeAttributes, Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';

import { EditorNodeTypes } from '@colanode/core';
import { PlantUmlNodeView } from '@colanode/ui/editor/views';

export const PlantUmlNode = Node.create({
  name: EditorNodeTypes.PlantUml,
  group: 'block',
  atom: true,
  defining: true,
  selectable: true,
  // Not draggable: dragging the block would conflict with text selection in
  // the inline code editor.
  draggable: false,
  addAttributes() {
    return {
      id: {
        default: null,
      },
      code: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-code') ?? '',
        renderHTML: (attributes) => ({
          'data-code': attributes.code ?? '',
        }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'plantuml' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['plantuml', mergeAttributes(HTMLAttributes)];
  },
  addNodeView() {
    return ReactNodeViewRenderer(PlantUmlNodeView, {
      as: 'plantuml',
    });
  },
});

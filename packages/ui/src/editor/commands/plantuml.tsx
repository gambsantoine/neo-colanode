import { Workflow } from 'lucide-react';

import { EditorCommand } from '@colanode/client/types';
import { EditorNodeTypes, generateId, IdType } from '@colanode/core';
import { requestPlantUmlEdit } from '@colanode/ui/editor/views/plantuml';

export const PlantUmlCommand: EditorCommand = {
  key: 'plantuml',
  name: 'PlantUML',
  description: 'Insert a PlantUML diagram',
  keywords: ['plantuml', 'uml', 'diagram'],
  icon: Workflow,
  disabled: false,
  handler: ({ editor, range }) => {
    const id = generateId(IdType.Block);
    // The node view opens its code editor on mount for freshly inserted blocks.
    requestPlantUmlEdit(id);
    editor
      .chain()
      .focus()
      .deleteRange(range)
      .insertContent({
        type: EditorNodeTypes.PlantUml,
        attrs: { id, code: '' },
      })
      .run();
  },
};

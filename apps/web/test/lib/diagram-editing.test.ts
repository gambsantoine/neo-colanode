import { describe, expect, it } from 'vitest';

import {
  duplicateLines,
  getCaretPosition,
  indentLines,
  insertSnippet,
  TextEdit,
  toggleComment,
} from '@colanode/ui/lib/diagram-editing';
import { searchTools } from '@colanode/ui/lib/tools';

const apply = (value: string, edit: TextEdit): string =>
  value.slice(0, edit.from) + edit.text + value.slice(edit.to);

describe('lib/diagram-editing', () => {
  describe('insertSnippet', () => {
    it('inserts after the current line and places the caret on $0', () => {
      const value = '@startuml\n  A -> B\n@enduml';
      const caret = value.indexOf('B') + 1;
      const edit = insertSnippet(value, caret, caret, 'loop $0\n  x\nend');
      const result = apply(value, edit);

      expect(result).toBe(
        '@startuml\n  A -> B\n  loop \n    x\n  end\n@enduml'
      );
      expect(result.slice(0, edit.selectionStart)).toBe(
        '@startuml\n  A -> B\n  loop '
      );
    });

    it('replaces a blank line', () => {
      const value = 'a\n\nb';
      const edit = insertSnippet(value, 2, 2, 'actor $0');
      expect(apply(value, edit)).toBe('a\nactor \nb');
      expect(edit.selectionStart).toBe(8);
    });
  });

  describe('toggleComment', () => {
    it('comments then uncomments the selected lines', () => {
      const value = 'A -> B\n  B -> C\n\nC -> D';
      const commented = apply(value, toggleComment(value, 0, 15));
      expect(commented).toBe("' A -> B\n  ' B -> C\n\nC -> D");

      const restored = apply(commented, toggleComment(commented, 0, 18));
      expect(restored).toBe(value);
    });
  });

  describe('indentLines', () => {
    it('inserts spaces at a plain caret', () => {
      const edit = indentLines('ab', 1, 1, 'in');
      expect(apply('ab', edit)).toBe('a  b');
      expect(edit.selectionStart).toBe(3);
    });

    it('indents and outdents every selected line', () => {
      const value = 'a\nb\nc';
      const indented = apply(value, indentLines(value, 0, 3, 'in'));
      expect(indented).toBe('  a\n  b\nc');

      const outdented = apply(indented, indentLines(indented, 0, 7, 'out'));
      expect(outdented).toBe(value);
    });
  });

  it('duplicates the current line', () => {
    const edit = duplicateLines('a\nb', 0, 0);
    expect(apply('a\nb', edit)).toBe('a\na\nb');
    expect(edit.selectionStart).toBe(2);
  });

  it('computes the caret line and column', () => {
    expect(getCaretPosition('ab\ncd', 4)).toEqual({ line: 2, column: 2 });
  });
});

describe('lib/tools searchTools', () => {
  it('matches names, keywords and accents insensitively', () => {
    expect(searchTools('')).not.toHaveLength(0);
    expect(searchTools('PLANT')).toHaveLength(1);
    expect(searchTools('séquence uml')).toHaveLength(1);
    expect(searchTools('spreadsheet')).toHaveLength(0);
  });
});

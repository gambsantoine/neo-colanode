import { describe, expect, it } from 'vitest';

import {
  isDiagramFileName,
  drawioLanguage,
  getDiagramLanguageForFile,
} from '@colanode/ui/lib/diagram-languages';
import {
  buildDrawioUrl,
  drawioDataToText,
  parseDrawioMessage,
  renderDrawio,
} from '@colanode/ui/lib/drawio';

describe('draw.io messages', () => {
  it('reads the events of the editor', () => {
    expect(parseDrawioMessage('{"event":"init"}')).toEqual({ event: 'init' });
    expect(parseDrawioMessage('{"event":"autosave","xml":"<a/>"}')).toEqual({
      event: 'autosave',
      xml: '<a/>',
    });
  });

  it.each([
    ['an object', { event: 'init' }],
    ['invalid JSON', 'not json'],
    ['an unknown event', '{"event":"other"}'],
    ['a message of another library', '{"type":"init"}'],
    ['null', 'null'],
  ])('ignores %s', (_, data) => {
    expect(parseDrawioMessage(data)).toBeNull();
  });
});

describe('draw.io files', () => {
  it('decodes an exported SVG, accents included', () => {
    const svg = '<svg>é</svg>';
    const base64 = btoa(String.fromCharCode(...new TextEncoder().encode(svg)));

    expect(drawioDataToText(`data:image/svg+xml;base64,${base64}`)).toBe(svg);
  });

  it('previews only the files holding an SVG', async () => {
    await expect(renderDrawio('<svg xmlns="x"></svg>')).resolves.toContain(
      '<svg'
    );
    await expect(
      renderDrawio('<?xml version="1.0"?>\n<svg></svg>')
    ).resolves.toContain('<svg');
    await expect(renderDrawio('<mxfile></mxfile>')).rejects.toThrow('draw.io');
  });

  it('recognizes its file names, but not a regular SVG', () => {
    expect(isDiagramFileName(drawioLanguage, 'plan.drawio.svg')).toBe(true);
    expect(isDiagramFileName(drawioLanguage, 'plan.drawio')).toBe(true);
    expect(getDiagramLanguageForFile('logo.svg')).toBeUndefined();
  });

  it('asks for the protocol used by the app', () => {
    const url = new URL(buildDrawioUrl(true));

    expect(url.searchParams.get('embed')).toBe('1');
    expect(url.searchParams.get('proto')).toBe('json');
    expect(url.searchParams.get('dark')).toBe('1');
  });
});

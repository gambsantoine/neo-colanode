import {
  parse as parseYaml,
  stringify as stringifyYaml,
  YAMLParseError,
} from 'yaml';

export type DataFormat = 'json' | 'yaml';
export type DataIndent = 2 | 4 | 'tab';

export interface DataFormatOptions {
  output: DataFormat;
  indent: DataIndent;
  // Sorts object keys alphabetically, at every level.
  sortKeys: boolean;
  // JSON only: everything on one line.
  minify: boolean;
}

export const DEFAULT_DATA_FORMAT_OPTIONS: DataFormatOptions = {
  output: 'json',
  indent: 2,
  sortKeys: false,
  minify: false,
};

export interface DataParseError {
  message: string;
  // 1-based, when the parser reports it.
  line?: number;
  column?: number;
}

export type DataFormatResult =
  | { ok: true; input: DataFormat; output: string }
  | { ok: false; input: DataFormat; error: DataParseError };

// JSON documents start with an object or an array; anything else is read as
// YAML (which also accepts plain JSON).
export const detectDataFormat = (text: string): DataFormat => {
  const start = text.trimStart()[0];
  return start === '{' || start === '[' ? 'json' : 'yaml';
};

// V8 reports "... at position 12 (line 2 column 5)" or "... at position 12".
const jsonErrorLocation = (
  message: string,
  text: string
): { line?: number; column?: number } => {
  const lineColumn = /line (\d+) column (\d+)/.exec(message);
  if (lineColumn) {
    return { line: Number(lineColumn[1]), column: Number(lineColumn[2]) };
  }

  const position = /position (\d+)/.exec(message);
  if (position) {
    const before = text.slice(0, Number(position[1]));
    const lines = before.split('\n');
    return { line: lines.length, column: lines.at(-1)!.length + 1 };
  }

  return {};
};

export const parseData = (
  text: string,
  format: DataFormat
): { ok: true; value: unknown } | { ok: false; error: DataParseError } => {
  try {
    if (format === 'json') {
      return { ok: true, value: JSON.parse(text) };
    }

    return { ok: true, value: parseYaml(text) };
  } catch (error) {
    if (error instanceof YAMLParseError) {
      const [line, column] = error.linePos?.[0]
        ? [error.linePos[0].line, error.linePos[0].col]
        : [undefined, undefined];
      return {
        ok: false,
        error: { message: error.message.split('\n')[0]!, line, column },
      };
    }

    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: { message, ...jsonErrorLocation(message, text) },
    };
  }
};

export const sortDataKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sortDataKeys);
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort((a, b) => a.localeCompare(b))
        .map((key) => [
          key,
          sortDataKeys((value as Record<string, unknown>)[key]),
        ])
    );
  }

  return value;
};

export const stringifyData = (
  value: unknown,
  options: DataFormatOptions
): string => {
  const data = options.sortKeys ? sortDataKeys(value) : value;

  if (options.output === 'json') {
    if (options.minify) {
      return JSON.stringify(data) ?? '';
    }

    const indent = options.indent === 'tab' ? '\t' : options.indent;
    return JSON.stringify(data, null, indent) ?? '';
  }

  // YAML does not allow tabs for indentation.
  const indent = options.indent === 'tab' ? 2 : options.indent;
  return stringifyYaml(data, { indent });
};

// Parses `text` (in `input`, or the detected format) and writes it back in
// the output format.
export const formatData = (
  text: string,
  options: DataFormatOptions,
  input: DataFormat | 'auto' = 'auto'
): DataFormatResult => {
  const format = input === 'auto' ? detectDataFormat(text) : input;
  const parsed = parseData(text, format);
  if (!parsed.ok) {
    return { ok: false, input: format, error: parsed.error };
  }

  return {
    ok: true,
    input: format,
    output: stringifyData(parsed.value, options),
  };
};

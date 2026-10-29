import { ArrowLeftRight, Check, Copy, Download, Eraser } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

import { Container } from '@colanode/ui/components/layouts/containers/container';
import { ToolBreadcrumb } from '@colanode/ui/components/tools/tool-breadcrumb';
import { ToolSegmented } from '@colanode/ui/components/tools/tool-segmented';
import { Button } from '@colanode/ui/components/ui/button';
import { Checkbox } from '@colanode/ui/components/ui/checkbox';
import { Label } from '@colanode/ui/components/ui/label';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { useMetadata } from '@colanode/ui/hooks/use-metadata';
import {
  DataFormat,
  DataFormatOptions,
  DataIndent,
  DEFAULT_DATA_FORMAT_OPTIONS,
  formatData,
} from '@colanode/ui/lib/data-format';
import { downloadBlob } from '@colanode/ui/lib/download';
import { cn } from '@colanode/ui/lib/utils';

type InputFormat = DataFormat | 'auto';

const formatNames: Record<DataFormat, string> = { json: 'JSON', yaml: 'YAML' };

const formatBytes = (value: string): string => {
  const bytes = new TextEncoder().encode(value).length;
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
};

export const JsonToolContainer = () => {
  const workspace = useWorkspace();
  // Only the options are remembered: the pasted data may be sensitive.
  const [storedOptions, setStoredOptions] = useMetadata<DataFormatOptions>(
    workspace.userId,
    'tools.json.options'
  );
  const options = { ...DEFAULT_DATA_FORMAT_OPTIONS, ...storedOptions };
  const updateOptions = (changes: Partial<DataFormatOptions>) =>
    setStoredOptions({ ...options, ...changes });

  const [input, setInput] = useState('');
  const [inputFormat, setInputFormat] = useState<InputFormat>('auto');
  const [copied, setCopied] = useState(false);

  const result = useMemo(
    () =>
      input.trim().length === 0
        ? null
        : formatData(input, options, inputFormat),
    [input, inputFormat, JSON.stringify(options)]
  );

  // Last valid output, kept (dimmed) while the input has an error.
  const lastOutputRef = useRef('');
  if (result?.ok) {
    lastOutputRef.current = result.output;
  } else if (result === null) {
    lastOutputRef.current = '';
  }
  const output = lastOutputRef.current;
  const hasError = result !== null && !result.ok;

  const copy = () => {
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const download = () => {
    const extension = options.output === 'json' ? 'json' : 'yaml';
    const type =
      options.output === 'json' ? 'application/json' : 'application/yaml';
    downloadBlob(new Blob([output], { type }), `data.${extension}`);
  };

  return (
    <Container
      type="full"
      breadcrumb={<ToolBreadcrumb id="json" name="JSON / YAML formatter" />}
      flush
    >
      <div className="flex h-full flex-col">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-input bg-muted/30 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Input</span>
            <ToolSegmented<InputFormat>
              aria-label="Input format"
              value={inputFormat}
              onChange={setInputFormat}
              options={[
                { value: 'auto', label: 'Auto' },
                { value: 'json', label: 'JSON' },
                { value: 'yaml', label: 'YAML' },
              ]}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Output</span>
            <ToolSegmented<DataFormat>
              aria-label="Output format"
              value={options.output}
              onChange={(value) => updateOptions({ output: value })}
              options={[
                { value: 'json', label: 'JSON' },
                { value: 'yaml', label: 'YAML' },
              ]}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Indent</span>
            <ToolSegmented<DataIndent>
              aria-label="Indentation"
              value={options.indent}
              onChange={(value) => updateOptions({ indent: value })}
              disabled={options.output === 'json' && options.minify}
              options={[
                { value: 2, label: '2' },
                { value: 4, label: '4' },
                { value: 'tab', label: 'Tab' },
              ]}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="json-sort-keys"
              checked={options.sortKeys}
              onCheckedChange={(checked) =>
                updateOptions({ sortKeys: checked === true })
              }
            />
            <Label htmlFor="json-sort-keys" className="text-xs font-normal">
              Sort keys
            </Label>
          </div>
          {options.output === 'json' && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="json-minify"
                checked={options.minify}
                onCheckedChange={(checked) =>
                  updateOptions({ minify: checked === true })
                }
              />
              <Label htmlFor="json-minify" className="text-xs font-normal">
                Minify
              </Label>
            </div>
          )}
          <div className="ml-auto flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={copy}
              disabled={!output}
            >
              {copied ? <Check /> : <Copy />}
              Copy
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setInput(output);
                setInputFormat('auto');
              }}
              disabled={!output || hasError}
              title="Use the result as input"
            >
              <ArrowLeftRight />
              Use as input
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={download}
              disabled={!output}
            >
              <Download />
              Download
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setInput('')}
              disabled={!input}
            >
              <Eraser />
              Clear
            </Button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-2">
          <div className="flex min-h-80 flex-col overflow-hidden lg:h-full">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Paste JSON or YAML here"
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              aria-label="Input"
              className="min-h-0 w-full flex-1 resize-none bg-transparent p-3 font-mono text-sm leading-relaxed outline-none dark:bg-input/30"
            />
            <div
              className={cn(
                'flex justify-between gap-3 border-t border-input bg-muted/30 px-3 py-1 text-xs text-muted-foreground tabular-nums',
                hasError && 'text-destructive'
              )}
            >
              <span className="truncate">
                {result === null
                  ? 'Empty'
                  : result.ok
                    ? `Valid ${formatNames[result.input]}`
                    : `${formatNames[result.input]} error${
                        result.error.line
                          ? ` (line ${result.error.line}${
                              result.error.column
                                ? `, col ${result.error.column}`
                                : ''
                            })`
                          : ''
                      }: ${result.error.message}`}
              </span>
              <span className="shrink-0">{formatBytes(input)}</span>
            </div>
          </div>
          <div className="flex min-h-80 flex-col overflow-hidden border-t border-input lg:h-full lg:border-t-0 lg:border-l">
            <pre
              aria-label="Result"
              className={cn(
                'min-h-0 flex-1 overflow-auto p-3 font-mono text-sm leading-relaxed whitespace-pre select-text',
                hasError && 'opacity-50'
              )}
            >
              {output || (
                <span className="font-sans text-muted-foreground">
                  The formatted result appears here.
                </span>
              )}
            </pre>
            <div className="flex justify-between border-t border-input bg-muted/30 px-3 py-1 text-xs text-muted-foreground tabular-nums">
              <span>
                {formatNames[options.output]}
                {hasError && output ? ' · last valid result' : ''}
              </span>
              <span>{formatBytes(output)}</span>
            </div>
          </div>
        </div>
      </div>
    </Container>
  );
};

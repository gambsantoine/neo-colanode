import { Check, Copy, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Container } from '@colanode/ui/components/layouts/containers/container';
import { PasswordToolBreadcrumb } from '@colanode/ui/components/tools/password/password-tool-breadcrumb';
import { Button } from '@colanode/ui/components/ui/button';
import { Checkbox } from '@colanode/ui/components/ui/checkbox';
import { Input } from '@colanode/ui/components/ui/input';
import { Label } from '@colanode/ui/components/ui/label';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { useMetadata } from '@colanode/ui/hooks/use-metadata';
import {
  clampPasswordLength,
  DEFAULT_PASSWORD_OPTIONS,
  DEFAULT_PASSWORD_SYMBOLS,
  generatePassword,
  getPasswordCharacterSets,
  getPasswordEntropy,
  getPasswordStrength,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PasswordOptions,
  PasswordStrength,
  normalizePasswordSymbols,
} from '@colanode/ui/lib/password-generator';
import { cn } from '@colanode/ui/lib/utils';

const strengthLabels: Record<PasswordStrength, string> = {
  weak: 'Weak',
  fair: 'Fair',
  strong: 'Strong',
  'very-strong': 'Very strong',
};

const strengthStyles: Record<PasswordStrength, string> = {
  weak: 'w-1/4 bg-red-500',
  fair: 'w-2/4 bg-orange-500',
  strong: 'w-3/4 bg-green-500',
  'very-strong': 'w-full bg-green-600',
};

const characterOptions: {
  key: 'lowercase' | 'uppercase' | 'digits' | 'symbols' | 'excludeAmbiguous';
  label: string;
}[] = [
  { key: 'lowercase', label: 'Lowercase (a-z)' },
  { key: 'uppercase', label: 'Uppercase (A-Z)' },
  { key: 'digits', label: 'Digits (0-9)' },
  { key: 'symbols', label: 'Symbols' },
  {
    key: 'excludeAmbiguous',
    label: 'Exclude ambiguous characters (0 O 1 l I)',
  },
];

export const PasswordToolContainer = () => {
  const workspace = useWorkspace();
  // Only the options are remembered, never the generated passwords.
  const [storedOptions, setStoredOptions] = useMetadata<PasswordOptions>(
    workspace.userId,
    'tools.password.options'
  );
  const options = { ...DEFAULT_PASSWORD_OPTIONS, ...storedOptions };

  const [password, setPassword] = useState(() => generatePassword(options));
  const [copied, setCopied] = useState(false);

  const regenerate = useCallback((next: PasswordOptions) => {
    setPassword(generatePassword(next));
    setCopied(false);
  }, []);

  const updateOptions = (changes: Partial<PasswordOptions>) => {
    const next = { ...options, ...changes };
    setStoredOptions(next);
    regenerate(next);
  };

  // Options loaded from metadata after the first render.
  useEffect(() => {
    if (storedOptions) {
      regenerate({ ...DEFAULT_PASSWORD_OPTIONS, ...storedOptions });
    }
  }, [storedOptions === undefined]);

  const copy = () => {
    if (!password) {
      return;
    }

    navigator.clipboard.writeText(password).then(() => {
      setCopied(true);
    });
  };

  const entropy = getPasswordEntropy(options);
  const strength = getPasswordStrength(entropy);
  const hasCharacterSet = getPasswordCharacterSets(options).length > 0;
  const symbolCount = normalizePasswordSymbols(options.symbolSet).length;

  return (
    <Container type="full" breadcrumb={<PasswordToolBreadcrumb />}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div
              className="min-h-12 flex-1 rounded-md border border-input bg-muted/30 px-3 py-2.5 font-mono text-lg break-all select-all"
              aria-label="Generated password"
            >
              {password || (
                <span className="font-sans text-sm text-muted-foreground">
                  Select at least one character type
                </span>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-12"
              onClick={copy}
              disabled={!password}
              title="Copy"
            >
              {copied ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-12"
              onClick={() => regenerate(options)}
              disabled={!hasCharacterSet}
              title="Generate another"
            >
              <RefreshCw className="size-4" />
            </Button>
          </div>
          {hasCharacterSet && (
            <div className="flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    strengthStyles[strength]
                  )}
                />
              </div>
              <span className="w-40 text-right text-xs text-muted-foreground tabular-nums">
                {strengthLabels[strength]} · {Math.round(entropy)} bits
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <Label htmlFor="password-length">Length</Label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={PASSWORD_MIN_LENGTH}
              max={PASSWORD_MAX_LENGTH}
              value={options.length}
              onChange={(event) =>
                updateOptions({ length: Number(event.target.value) })
              }
              className="flex-1 accent-primary"
              aria-label="Password length"
            />
            <Input
              id="password-length"
              type="number"
              min={PASSWORD_MIN_LENGTH}
              max={PASSWORD_MAX_LENGTH}
              value={options.length}
              onChange={(event) =>
                updateOptions({
                  length: clampPasswordLength(Number(event.target.value)),
                })
              }
              className="w-20"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Label>Characters</Label>
          {characterOptions.map((option) => (
            <div key={option.key} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`password-${option.key}`}
                  checked={options[option.key]}
                  onCheckedChange={(checked) =>
                    updateOptions({ [option.key]: checked === true })
                  }
                />
                <Label
                  htmlFor={`password-${option.key}`}
                  className="font-normal"
                >
                  {option.label}
                </Label>
              </div>
              {option.key === 'symbols' && options.symbols && (
                <div className="flex flex-col gap-1 pl-6">
                  <div className="flex items-center gap-2">
                    <Input
                      value={options.symbolSet}
                      onChange={(event) =>
                        updateOptions({ symbolSet: event.target.value })
                      }
                      placeholder="Symbols to use, e.g. !@#$%"
                      spellCheck={false}
                      autoComplete="off"
                      aria-label="Symbols to use"
                      className="font-mono"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        updateOptions({ symbolSet: DEFAULT_PASSWORD_SYMBOLS })
                      }
                      disabled={options.symbolSet === DEFAULT_PASSWORD_SYMBOLS}
                    >
                      Reset
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {symbolCount === 0
                      ? 'No symbol: symbols are not used.'
                      : `${symbolCount} symbol${symbolCount > 1 ? 's' : ''} used. Spaces and repeats are ignored.`}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Container>
  );
};

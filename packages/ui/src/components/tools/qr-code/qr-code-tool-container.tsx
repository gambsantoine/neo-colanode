import { Check, Copy, FileImage, ImageDown } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Container } from '@colanode/ui/components/layouts/containers/container';
import { ToolBreadcrumb } from '@colanode/ui/components/tools/tool-breadcrumb';
import { ToolSegmented } from '@colanode/ui/components/tools/tool-segmented';
import { Button } from '@colanode/ui/components/ui/button';
import { Checkbox } from '@colanode/ui/components/ui/checkbox';
import { Input } from '@colanode/ui/components/ui/input';
import { Label } from '@colanode/ui/components/ui/label';
import { Textarea } from '@colanode/ui/components/ui/textarea';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { useMetadata } from '@colanode/ui/hooks/use-metadata';
import { downloadBlob } from '@colanode/ui/lib/download';
import {
  buildWifiQrText,
  DEFAULT_QR_CODE_OPTIONS,
  QR_ERROR_CORRECTION_LABELS,
  QrCodeOptions,
  QrErrorCorrection,
  renderQrCodePng,
  renderQrCodeSvg,
  WifiNetwork,
  WifiSecurity,
} from '@colanode/ui/lib/qr-code';
import { svgToDataUrl } from '@colanode/ui/lib/svg';

type QrMode = 'text' | 'wifi';

const PNG_SIZES = [256, 512, 1024, 2048];

type PreviewState =
  | { status: 'empty' }
  | { status: 'ready'; svg: string }
  | { status: 'error'; message: string };

export const QrCodeToolContainer = () => {
  const workspace = useWorkspace();
  // Only the look of the code is remembered, never its content.
  const [storedOptions, setStoredOptions] = useMetadata<QrCodeOptions>(
    workspace.userId,
    'tools.qrcode.options'
  );
  const options = { ...DEFAULT_QR_CODE_OPTIONS, ...storedOptions };
  const updateOptions = (changes: Partial<QrCodeOptions>) =>
    setStoredOptions({ ...options, ...changes });

  const [mode, setMode] = useState<QrMode>('text');
  const [text, setText] = useState('');
  const [wifi, setWifi] = useState<WifiNetwork>({
    ssid: '',
    password: '',
    security: 'WPA',
    hidden: false,
  });
  const [pngSize, setPngSize] = useState(1024);
  const [preview, setPreview] = useState<PreviewState>({ status: 'empty' });
  const [copied, setCopied] = useState(false);

  const content =
    mode === 'text' ? text : wifi.ssid ? buildWifiQrText(wifi) : '';

  useEffect(() => {
    if (!content) {
      setPreview({ status: 'empty' });
      return;
    }

    let cancelled = false;
    renderQrCodeSvg(content, options)
      .then((svg) => {
        if (!cancelled) {
          setPreview({ status: 'ready', svg });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setPreview({
            status: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'The QR code could not be generated',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [content, JSON.stringify(options)]);

  const downloadPng = async () => {
    downloadBlob(
      await renderQrCodePng(content, options, pngSize),
      'qr-code.png'
    );
  };

  const downloadSvg = () => {
    if (preview.status === 'ready') {
      downloadBlob(
        new Blob([preview.svg], { type: 'image/svg+xml' }),
        'qr-code.svg'
      );
    }
  };

  // Copies the PNG image, for pasting into a chat or a document.
  const copyImage = async () => {
    const blob = await renderQrCodePng(content, options, pngSize);
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const isReady = preview.status === 'ready';

  return (
    <Container
      type="full"
      breadcrumb={<ToolBreadcrumb id="qrcode" name="QR code generator" />}
    >
      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-8 py-6 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="flex flex-col gap-6">
          <ToolSegmented<QrMode>
            aria-label="Content type"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'text', label: 'Text / link' },
              { value: 'wifi', label: 'Wi-Fi' },
            ]}
          />

          {mode === 'text' ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="qr-text">Text or link</Label>
              <Textarea
                id="qr-text"
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="https://example.com"
                rows={4}
                className="font-mono"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="qr-wifi-ssid">Network name (SSID)</Label>
                <Input
                  id="qr-wifi-ssid"
                  value={wifi.ssid}
                  onChange={(event) =>
                    setWifi({ ...wifi, ssid: event.target.value })
                  }
                  autoComplete="off"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Security</Label>
                <ToolSegmented<WifiSecurity>
                  aria-label="Security"
                  value={wifi.security}
                  onChange={(security) => setWifi({ ...wifi, security })}
                  options={[
                    { value: 'WPA', label: 'WPA / WPA2 / WPA3' },
                    { value: 'WEP', label: 'WEP' },
                    { value: 'nopass', label: 'None' },
                  ]}
                />
              </div>
              {wifi.security !== 'nopass' && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="qr-wifi-password">Password</Label>
                  <Input
                    id="qr-wifi-password"
                    type="password"
                    value={wifi.password}
                    onChange={(event) =>
                      setWifi({ ...wifi, password: event.target.value })
                    }
                    autoComplete="off"
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="qr-wifi-hidden"
                  checked={wifi.hidden}
                  onCheckedChange={(checked) =>
                    setWifi({ ...wifi, hidden: checked === true })
                  }
                />
                <Label htmlFor="qr-wifi-hidden" className="font-normal">
                  Hidden network
                </Label>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-4 border-t border-input pt-6">
            <div className="flex flex-col gap-2">
              <Label>Error correction</Label>
              <ToolSegmented<QrErrorCorrection>
                aria-label="Error correction"
                value={options.errorCorrection}
                onChange={(errorCorrection) =>
                  updateOptions({ errorCorrection })
                }
                options={(['L', 'M', 'Q', 'H'] as const).map((level) => ({
                  value: level,
                  label: QR_ERROR_CORRECTION_LABELS[level],
                }))}
              />
              <p className="text-xs text-muted-foreground">
                Higher levels still scan when the code is damaged or covered,
                but make it denser.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-6">
              <div className="flex flex-col gap-2">
                <Label htmlFor="qr-foreground">Color</Label>
                <input
                  id="qr-foreground"
                  type="color"
                  value={options.foreground}
                  onChange={(event) =>
                    updateOptions({ foreground: event.target.value })
                  }
                  className="h-9 w-14 cursor-pointer rounded-md border border-input bg-transparent p-1"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="qr-background">Background</Label>
                <input
                  id="qr-background"
                  type="color"
                  value={options.background}
                  onChange={(event) =>
                    updateOptions({ background: event.target.value })
                  }
                  className="h-9 w-14 cursor-pointer rounded-md border border-input bg-transparent p-1"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Margin</Label>
                <ToolSegmented<number>
                  aria-label="Margin"
                  value={options.margin}
                  onChange={(margin) => updateOptions({ margin })}
                  options={[0, 1, 2, 4].map((margin) => ({
                    value: margin,
                    label: String(margin),
                  }))}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setStoredOptions(DEFAULT_QR_CODE_OPTIONS)}
              >
                Reset style
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-md border border-input bg-muted/30">
            {preview.status === 'ready' && (
              <img
                src={svgToDataUrl(preview.svg)}
                alt="QR code"
                draggable={false}
                className="size-full object-contain"
              />
            )}
            {preview.status === 'empty' && (
              <p className="px-6 text-center text-sm text-muted-foreground">
                {mode === 'text'
                  ? 'Type a text or a link to generate its QR code.'
                  : 'Enter the network name to generate its QR code.'}
              </p>
            )}
            {preview.status === 'error' && (
              <p className="px-6 text-center text-sm text-destructive">
                {preview.message}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Label className="shrink-0 text-xs font-normal text-muted-foreground">
              PNG size
            </Label>
            <ToolSegmented<number>
              aria-label="PNG size"
              value={pngSize}
              onChange={setPngSize}
              options={PNG_SIZES.map((size) => ({
                value: size,
                label: String(size),
              }))}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void downloadPng()}
              disabled={!isReady}
            >
              <ImageDown />
              PNG
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={downloadSvg}
              disabled={!isReady}
            >
              <FileImage />
              SVG
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void copyImage()}
              disabled={!isReady}
            >
              {copied ? <Check /> : <Copy />}
              Copy
            </Button>
          </div>
        </div>
      </div>
    </Container>
  );
};

import QRCode from 'qrcode';

export type QrErrorCorrection = 'L' | 'M' | 'Q' | 'H';

export interface QrCodeOptions {
  errorCorrection: QrErrorCorrection;
  // Quiet zone around the code, in modules.
  margin: number;
  foreground: string;
  background: string;
}

export const DEFAULT_QR_CODE_OPTIONS: QrCodeOptions = {
  errorCorrection: 'M',
  margin: 2,
  foreground: '#000000',
  background: '#ffffff',
};

export const QR_ERROR_CORRECTION_LABELS: Record<QrErrorCorrection, string> = {
  L: 'Low (7%)',
  M: 'Medium (15%)',
  Q: 'Quartile (25%)',
  H: 'High (30%)',
};

export type WifiSecurity = 'WPA' | 'WEP' | 'nopass';

export interface WifiNetwork {
  ssid: string;
  password: string;
  security: WifiSecurity;
  hidden: boolean;
}

// Characters with a meaning in the WIFI: format are escaped with a backslash.
const escapeWifiValue = (value: string): string =>
  value.replace(/([\\;,:"])/g, '\\$1');

// Text of a QR code that phones read as "join this Wi-Fi network".
export const buildWifiQrText = (network: WifiNetwork): string => {
  const parts = [`T:${network.security}`, `S:${escapeWifiValue(network.ssid)}`];
  if (network.security !== 'nopass') {
    parts.push(`P:${escapeWifiValue(network.password)}`);
  }
  if (network.hidden) {
    parts.push('H:true');
  }

  return `WIFI:${parts.join(';')};;`;
};

const toQrOptions = (options: QrCodeOptions) => ({
  errorCorrectionLevel: options.errorCorrection,
  margin: options.margin,
  color: { dark: options.foreground, light: options.background },
});

// Rejects when the text is empty or too long for a QR code.
export const renderQrCodeSvg = (
  text: string,
  options: QrCodeOptions
): Promise<string> =>
  QRCode.toString(text, { ...toQrOptions(options), type: 'svg' });

export const renderQrCodePng = async (
  text: string,
  options: QrCodeOptions,
  size: number
): Promise<Blob> => {
  const dataUrl = await QRCode.toDataURL(text, {
    ...toQrOptions(options),
    width: size,
  });
  const response = await fetch(dataUrl);
  return await response.blob();
};

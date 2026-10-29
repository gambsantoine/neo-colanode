import { describe, expect, it } from 'vitest';

import {
  buildWifiQrText,
  DEFAULT_QR_CODE_OPTIONS,
  renderQrCodeSvg,
} from '@colanode/ui/lib/qr-code';

describe('lib/qr-code', () => {
  it('builds the Wi-Fi QR text', () => {
    expect(
      buildWifiQrText({
        ssid: 'Home',
        password: 'secret',
        security: 'WPA',
        hidden: false,
      })
    ).toBe('WIFI:T:WPA;S:Home;P:secret;;');
  });

  it('escapes special characters and handles open or hidden networks', () => {
    expect(
      buildWifiQrText({
        ssid: 'My;Net',
        password: 'a:b,c\\"',
        security: 'WPA',
        hidden: true,
      })
    ).toBe('WIFI:T:WPA;S:My\\;Net;P:a\\:b\\,c\\\\\\";H:true;;');

    expect(
      buildWifiQrText({
        ssid: 'Cafe',
        password: 'ignored',
        security: 'nopass',
        hidden: false,
      })
    ).toBe('WIFI:T:nopass;S:Cafe;;');
  });

  it('renders an SVG with the chosen colors', async () => {
    const svg = await renderQrCodeSvg('https://colanode.com', {
      ...DEFAULT_QR_CODE_OPTIONS,
      foreground: '#112233',
    });
    expect(svg).toContain('<svg');
    expect(svg).toContain('#112233');
  });
});

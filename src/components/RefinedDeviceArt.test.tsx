import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nProvider } from '../i18n';
import { RefinedDeviceArt } from './RefinedDeviceArt';

function renderArt(kind: 'contactor' | 'thermal' | 'motor', blockWireTerminals: boolean): string {
  return renderToStaticMarkup(
    <I18nProvider>
      <svg>
        <RefinedDeviceArt
          kind={kind}
          id={kind === 'motor' ? 'MOTOR' : `${kind}-1`}
          blockWireTerminals={blockWireTerminals}
        />
      </svg>
    </I18nProvider>,
  );
}

describe('device-side terminal hit targets', () => {
  it('marks only physical terminal screws while routing a new wire', () => {
    expect(renderArt('contactor', true).match(/data-wire-block="terminal"/g)).toHaveLength(16);
    expect(renderArt('thermal', true).match(/data-wire-block="terminal"/g)).toHaveLength(6);
    expect(renderArt('motor', true).match(/data-wire-block="terminal"/g)).toHaveLength(6);
  });

  it('leaves the device artwork non-interactive outside wire routing', () => {
    for (const kind of ['contactor', 'thermal', 'motor'] as const) {
      expect(renderArt(kind, false)).not.toContain('data-wire-block="terminal"');
    }
  });
});

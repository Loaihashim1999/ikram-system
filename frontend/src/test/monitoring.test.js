import { describe, expect, it } from 'vitest';
import { sentryOptions } from '../monitoring';

describe('Sentry monitoring configuration', () => {
  it('keeps error integrations and excludes the faulty performance observers', () => {
    const defaults = [
      { name: 'GlobalHandlers' },
      { name: 'BrowserTracing' },
      { name: 'WebVitals' },
      { name: 'BrowserProfiling' },
      { name: 'Replay' },
    ];

    expect(sentryOptions.integrations(defaults).map(({ name }) => name))
      .toEqual(['GlobalHandlers']);
    expect(sentryOptions.tracesSampleRate).toBe(0);
    expect(sentryOptions.replaysSessionSampleRate).toBe(0);
    expect(sentryOptions.replaysOnErrorSampleRate).toBe(0);
  });
});

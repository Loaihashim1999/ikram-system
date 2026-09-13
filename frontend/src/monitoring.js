export const sentryOptions = {
  dsn: 'https://8241b7d9db67980ffefbe95c034847ad@o4512063801786368.ingest.us.sentry.io/4512075558354944',
  integrations(defaultIntegrations) {
    const performanceIntegrations = new Set([
      'BrowserTracing',
      'WebVitals',
      'BrowserProfiling',
      'Replay',
    ]);

    return defaultIntegrations.filter(
      (integration) => !performanceIntegrations.has(integration.name),
    );
  },
  tracesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  dataCollection: {},
};

import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    esmExternals: true,
    serverComponentsExternalPackages: ['@sparticuz/chromium', 'playwright-core'],
  },
};

export default withSentryConfig(nextConfig, {
  org: "source-capital",
  project: "javascript-nextjs",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  webpack: {
    automaticVercelMonitors: true,
    treeshake: {
      removeDebugLogging: true,
    },
  },
});

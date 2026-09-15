import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    esmExternals: true,
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

// Trigger rebuild #2: SENTRY_AUTH_TOKEN now actually deployed in Vercel -- verify source maps upload this time.

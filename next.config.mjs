import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow long-running API routes for PDF analysis (up to 5 minutes on Vercel Pro)
  experimental: {},

  // Consolidate deck submission intake to single canonical route
  redirects: async () => [
    // Redirect old /upload route to canonical investment-score flow
    {
      source: '/upload',
      destination: '/investment-score',
      permanent: false,
    },
    // Redirect deprecated investability-score branding to investment-score
    {
      source: '/investability-score',
      destination: '/investment-score',
      permanent: false,
    },
    {
      source: '/investability-score/upload',
      destination: '/investment-score/upload',
      permanent: false,
    },
    {
      source: '/investability-score/analysing/:id',
      destination: '/investment-score/analysing/:id',
      permanent: false,
    },
    {
      source: '/investability-score/results/:id',
      destination: '/investment-score/results/:id',
      permanent: false,
    },
  ],
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "source-capital",

  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});

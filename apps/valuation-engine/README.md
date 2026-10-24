# valuation-engine

Next.js app for the Raise HQ valuation engine: the founder wizard, the report, and the headless `/api/valuation/compute` route that the portal's n8n flow calls. See `claude.md` for the development log.

## The valuation library

The maths lives in the package `@edwardjanes/valuation-core` (source: `packages/valuation-core/` in this repo), published to GitHub Packages. This app depends on an exact version. Only `src/lib/valuation/pdf.ts` stays here, because it uses Sentry, Supabase and PDFShift.

Installing needs a token with package read access, exported as `NPM_GITHUB_TOKEN` (`.npmrc` reads it). On Vercel it is a project environment variable.

## Local development against the package source

The Vercel project is rooted at this directory and does not upload `packages/`, so this app never uses a `file:` dependency. To work against local package changes:

```
cd ../../packages/valuation-core && npm install && npm run build
cd ../../apps/valuation-engine && npm run link:core
```

`link:core` runs `npm link ../../packages/valuation-core`, which symlinks the package into `node_modules`. Rebuild the package after each change to it (`npm run build` there). A plain `npm install` here replaces the link with the published version.

## Scripts

- `npm run dev`, `npm run build`, `npm start`
- `npm test`: this app's own tests (the report render test). The library's tests run in the package.

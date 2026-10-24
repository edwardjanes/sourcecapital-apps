declare const __ENGINE_VERSION__: string;

/**
 * The package version, baked in from package.json at build time (tsup.config.ts,
 * and vitest.config.ts for tests). TheAngel stores it on every run as
 * engine_version, so two runs under different versions are never compared
 * without a note.
 */
export const ENGINE_VERSION: string = __ENGINE_VERSION__;

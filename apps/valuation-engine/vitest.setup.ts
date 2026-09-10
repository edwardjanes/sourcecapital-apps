// Prevent any SSR-related initialization
if (typeof global !== 'undefined') {
  global.fetch = (() => Promise.reject(new Error('fetch not available'))) as any;
}

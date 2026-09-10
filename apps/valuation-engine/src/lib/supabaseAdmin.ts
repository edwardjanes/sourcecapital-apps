import { createClient, SupabaseClient } from "@supabase/supabase-js";

function createAdminClient(): SupabaseClient {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Missing Supabase environment variables. Copy .env.local.example to .env.local and fill in your values."
    );
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        fetch: (url: RequestInfo | URL, options?: RequestInit) =>
          fetch(url, { ...options, cache: "no-store" }),
      },
    }
  );
}

let _client: SupabaseClient | null = null;

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop: string | symbol) {
    if (!_client) _client = createAdminClient();
    const value = (_client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? (value as Function).bind(_client) : value;
  },
});

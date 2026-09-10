import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const requestUrl = new URL(request.url);
      requestUrl.pathname = "/dashboard";
      return NextResponse.redirect(requestUrl);
    }
  }

  return NextResponse.redirect(new URL("/auth/auth-code-error", request.url));
}

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Resolves the signed-in user from the request cookies and checks they own the
// listing. Returns either the user id or the error response to send back.
export async function requireListingOwner(
  req: NextRequest,
  listingId: string
): Promise<{ userId: string } | { response: NextResponse }> {
  const cookieHeader = req.headers.get('cookie') || '';
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => {
          return cookieHeader.split('; ').map(c => {
            const [name, value] = c.split('=');
            return { name, value };
          });
        },
        setAll: () => {},
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: listing, error: fetchError } = await supabaseAdmin
    .from('raise_listings')
    .select('user_id')
    .eq('id', listingId)
    .maybeSingle();

  if (fetchError || !listing) {
    return { response: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  if (listing.user_id !== user.id) {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { userId: user.id };
}

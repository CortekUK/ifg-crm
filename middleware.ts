import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    // Font files are excluded for the same reason images are: they are public
    // static assets, and running auth on them breaks them.
    //
    // /fonts/LiberationSans-*.ttf is fetched by the player-portal invoice PDF
    // to embed a Unicode font. Without the exclusion the middleware answered
    // that fetch with a 307 to /login (or, for a signed-in player, to /portal),
    // so the PDF builder received HTML instead of a font, quietly fell back to
    // Helvetica, and went on mangling accented names — the exact bug the font
    // was added to fix, invisible because the fallback is silent.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ttf|otf|woff|woff2)$).*)',
  ],
}

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Invite links land on /auth/callback with the session in the URL hash
        // (#access_token=…&type=invite). That page parses the hash and calls
        // setSession() itself. If the client ALSO auto-detects the URL, both
        // paths contend for the same auth lock (navigator.locks) and the page
        // hangs on "Setting up your account…" forever. We own the parsing in
        // the callback, so turn auto-detection off. PKCE links (password reset)
        // are handled explicitly via exchangeCodeForSession and are unaffected.
        detectSessionInUrl: false,
      },
    }
  )
}

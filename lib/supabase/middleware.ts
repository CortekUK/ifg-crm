import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Skip auth redirect for API routes (they handle their own auth and return JSON errors)
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/')

  // Routes that must behave the same whether or not somebody is signed in.
  // These arrive as links in emails, so the person following one is just as
  // likely to have a player portal session in that browser as not — and the
  // role routing below sends every signed-in player back to /portal. That
  // turned every unsubscribe link into a trip to the portal (the person keeps
  // getting emails, which is how a mailing list earns spam complaints) and
  // every "Pay Now" button into the same dead end. The signed token in the
  // link is the authorisation here; a session is beside the point.
  const isAuthNeutralRoute =
    request.nextUrl.pathname.startsWith('/unsubscribe') ||
    request.nextUrl.pathname.startsWith('/pay/')

  // Public routes that don't require auth
  const isPublicRoute =
    request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/register') ||
    request.nextUrl.pathname.startsWith('/auth') ||
    request.nextUrl.pathname.startsWith('/forgot-password') ||
    request.nextUrl.pathname.startsWith('/set-password') ||
    request.nextUrl.pathname.startsWith('/unauthorized') ||
    request.nextUrl.pathname === '/portal/login' ||
    // Email unsubscribe and /pay/<invoice>. Both are emailed to players and
    // parents who may have no CRM account at all, so a redirect to /login
    // made every unsubscribe link and every "Pay Now" button a dead end. It
    // only ever looked fine to staff, who are already signed in. /pay
    // resolves the invoice with the service key and 307s to Stripe; it
    // exposes nothing beyond the payment page.
    isAuthNeutralRoute

  if (!user && !isApiRoute && !isPublicRoute) {
    const url = request.nextUrl.clone()
    // If trying to access portal, redirect to portal login
    if (request.nextUrl.pathname.startsWith('/portal')) {
      url.pathname = '/portal/login'
    } else {
      url.pathname = '/login'
    }
    return NextResponse.redirect(url)
  }

  const pathname = request.nextUrl.pathname

  // Role-based route protection
  if (user && !isApiRoute && !isAuthNeutralRoute) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role

    // Player-specific routing
    if (role === 'player') {
      // Players can only access /portal/* routes
      if (!pathname.startsWith('/portal') && !pathname.startsWith('/auth') && !pathname.startsWith('/set-password')) {
        const url = request.nextUrl.clone()
        url.pathname = '/portal'
        return NextResponse.redirect(url)
      }
    }

    // Portal routes are player-only
    if (pathname.startsWith('/portal') && pathname !== '/portal/login' && role !== 'player') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    // Admin-only route protection.
    // NOTE: /settings is intentionally NOT here — recruiters need it to manage
    // their own profile (email signature, phone, title) and connect their
    // Calendly. The settings page itself restricts admin-only sections by role.
    // /lists and /tags are absent on purpose — recruiters manage both.
    // /brochures is present because it was only ever hidden from the sidebar,
    // so anyone who typed the URL walked straight in.
    const adminOnlyPaths = [
      '/campaigns', '/brochures', '/templates', '/automations',
      '/invoices', '/payments', '/analytics', '/reports',
      '/users', '/form-submissions', '/website-content',
      // The Website Content editor itself lives at /cms/[slug].
      '/cms',
    ]

    const isAdminRoute = adminOnlyPaths.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`)
    )

    if (isAdminRoute) {
      if (role !== 'admin' && role !== 'super_admin') {
        const url = request.nextUrl.clone()
        url.pathname = '/unauthorized'
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}

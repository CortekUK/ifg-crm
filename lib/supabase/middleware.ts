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

  // Public routes that don't require auth
  const isPublicRoute =
    request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/register') ||
    request.nextUrl.pathname.startsWith('/auth') ||
    request.nextUrl.pathname.startsWith('/forgot-password') ||
    request.nextUrl.pathname.startsWith('/set-password') ||
    request.nextUrl.pathname.startsWith('/unauthorized') ||
    request.nextUrl.pathname === '/portal/login' ||
    request.nextUrl.pathname.startsWith('/landing')

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
  if (user && !isApiRoute) {
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

    // Admin-only route protection
    const adminOnlyPaths = [
      '/campaigns', '/lists', '/templates', '/automations',
      '/invoices', '/payments', '/analytics', '/reports',
      '/users', '/settings', '/form-submissions',
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

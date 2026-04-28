import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export type AuthStatus = {
  last_sign_in_at: string | null
  email_confirmed_at: string | null
}

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = getSupabaseAdmin()
    const { data: { users }, error } = await admin.auth.admin.listUsers({ perPage: 1000 })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // We only return last_sign_in_at and email_confirmed_at here. The
    // "has the user saved a real password" signal is profiles.password_set_at,
    // queried directly off the profiles table by useUsers — Supabase's auth
    // admin API redacts encrypted_password and the other auth.users fields
    // are unreliable indicators (set during invite/magic-link, before any
    // password is stored).
    const statusMap: Record<string, AuthStatus> = {}
    for (const u of users) {
      statusMap[u.id] = {
        last_sign_in_at: u.last_sign_in_at || null,
        email_confirmed_at: u.email_confirmed_at || null,
      }
    }

    return NextResponse.json(statusMap)
  } catch (error) {
    console.error('Error fetching auth status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

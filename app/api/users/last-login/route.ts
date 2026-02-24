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

export async function GET() {
  try {
    // Verify caller is authenticated
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch auth users via admin API to get last_sign_in_at
    const admin = getSupabaseAdmin()
    const { data: { users }, error } = await admin.auth.admin.listUsers({ perPage: 1000 })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Return a map of user_id -> last_sign_in_at
    const lastLoginMap: Record<string, string | null> = {}
    for (const u of users) {
      lastLoginMap[u.id] = u.last_sign_in_at || null
    }

    return NextResponse.json(lastLoginMap)
  } catch (error) {
    console.error('Error fetching last login times:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

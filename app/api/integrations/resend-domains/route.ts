import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  // Verify user is authenticated and admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return NextResponse.json({ domains: [], error: 'Resend API key not configured' })
  }

  try {
    const response = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    if (!response.ok) {
      return NextResponse.json({ domains: [], error: `Resend API error: ${response.status}` })
    }

    const data = await response.json()
    const domains = (data.data || []).map((d: {
      id: string
      name: string
      status: string
      records: { record: string; name: string; type: string; value: string; status: string }[]
    }) => ({
      id: d.id,
      name: d.name,
      status: d.status,
      records: (d.records || []).map((r: { record: string; status: string }) => ({
        record: r.record,
        status: r.status,
      })),
    }))

    return NextResponse.json({ domains })
  } catch (err) {
    return NextResponse.json({ domains: [], error: err instanceof Error ? err.message : 'Unknown error' })
  }
}

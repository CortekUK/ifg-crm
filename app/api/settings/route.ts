import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const key = request.nextUrl.searchParams.get('key')

    if (key) {
      const { data, error } = await supabase
        .from('crm_settings')
        .select('key, value')
        .eq('key', key)
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
      return NextResponse.json(data)
    }

    const { data, error } = await supabase
      .from('crm_settings')
      .select('key, value')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Convert array to object keyed by setting key
    const settings: Record<string, unknown> = {}
    for (const row of data || []) {
      settings[row.key] = row.value
    }

    return NextResponse.json(settings)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { key, value } = body

    if (!key || value === undefined) {
      return NextResponse.json({ error: 'Missing key or value' }, { status: 400 })
    }

    const { error } = await supabase
      .from('crm_settings')
      .upsert({
        key,
        value,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      }, { onConflict: 'key' })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

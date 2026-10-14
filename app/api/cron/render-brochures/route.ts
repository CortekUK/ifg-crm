import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { renderPendingBrochures } from '@/lib/brochures/render'

/**
 * Turns uploaded brochure PDFs into page images.
 *
 * Runs every minute (vercel.json) and does nothing on almost all of them — it
 * claims a brochure only when one is waiting, which is a few times a year.
 *
 * Unlike the other cron routes this does the work itself instead of calling an
 * Edge Function: rendering needs pdfium's WebAssembly build and libvips, which
 * is a Node runtime, not the edge one. Hence the explicit runtime below.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// A 44-page, 157MB brochure measured at ~90s end to end. The renderer stops
// itself at 240s; this is the hard ceiling behind that.
export const maxDuration = 300

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const isVercelCron = request.headers.get('x-vercel-cron') === '1'
  const hasValidSecret = Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`
  const isDevelopment = process.env.NODE_ENV === 'development'

  if (!isVercelCron && !hasValidSecret && !isDevelopment) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('render-brochures: missing Supabase credentials')
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  })

  try {
    const results = await renderPendingBrochures(supabase)
    if (results.length > 0) {
      console.log('render-brochures:', JSON.stringify(results))
    }
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      rendered: results.length,
      results,
    })
  } catch (error) {
    console.error('render-brochures failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}

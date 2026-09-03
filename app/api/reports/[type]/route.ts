import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { findReport } from '@/lib/reports/catalogue'
import { RUNNERS, toCSV } from '@/lib/reports/runners'

/**
 * Generate a report as CSV.
 *
 * Reports used to be built in the browser, which quietly capped every one
 * of them: PostgREST returns at most 1000 rows, so "Contacts export" handed
 * over 1000 of 105,285 contacts and called it a full export. Running here
 * lets the query page through everything.
 *
 * The route uses the caller's session, so RLS still decides what any given
 * user is allowed to export.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ type: string }> },
) {
  try {
    const { type } = await context.params

    // Authenticate before looking anything up, so an unauthenticated
    // caller learns nothing about which reports exist.
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const definition = findReport(type)
    const runner = RUNNERS[type]
    if (!definition || !runner) {
      return NextResponse.json({ error: `Unknown report "${type}".` }, { status: 404 })
    }

    const params = request.nextUrl.searchParams
    const fromParam = params.get('from')
    const toParam = params.get('to')

    let start: Date | null = null
    let end: Date | null = null

    // A snapshot report answers "what is true now", so a window would
    // change the question rather than narrow it.
    if (!definition.snapshot && fromParam && toParam) {
      start = new Date(fromParam)
      end = new Date(toParam)
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return NextResponse.json({ error: 'Invalid date range.' }, { status: 400 })
      }
      if (start > end) {
        return NextResponse.json({ error: 'Start date must be before end date.' }, { status: 400 })
      }
      end.setHours(23, 59, 59, 999)
    }

    const { columns, rows } = await runner({
      supabase,
      start,
      end,
      pipelineId: definition.pipelineFilter ? params.get('pipelineId') || null : null,
      recruiterId: definition.recruiterFilter ? params.get('recruiterId') || null : null,
    })

    // An empty result is a fact about the data, not a failure. The client
    // reads this header to say "nothing in that range" instead of showing
    // a red error, which is what the old modal did for every empty report.
    const csv = toCSV(rows, columns)
    const slug = type.replace(/[^a-z0-9-]/gi, '')
    const stamp = start && end
      ? `${start.toISOString().slice(0, 10)}-to-${end.toISOString().slice(0, 10)}`
      : new Date().toISOString().slice(0, 10)

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="ifg-${slug}-${stamp}.csv"`,
        'X-Report-Rows': String(rows.length),
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Report generation failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Report generation failed.' },
      { status: 500 },
    )
  }
}

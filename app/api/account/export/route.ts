import { NextResponse } from 'next/server'
import JSZip from 'jszip'
import { createClient } from '@/lib/supabase/server'
import { REPORTS } from '@/lib/reports/catalogue'
import { RUNNERS, toCSV } from '@/lib/reports/runners'

/**
 * A full CRM backup, as one ZIP of CSVs.
 *
 * Built from the same runners the Reports page uses, so a table cannot be
 * exported one way here and another way there — and adding a report adds
 * it to the backup for free.
 *
 * Everything is "all time": a backup with a date range on it is not a
 * backup. The runners page through PostgREST's 1000-row limit, so the
 * contacts file really does contain every contact.
 *
 * Runs with the caller's session, so RLS decides what goes in the file.
 */

export const maxDuration = 300

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    // A full export is every player's personal data. Only admins.
    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Only an admin can export the full database.' },
        { status: 403 },
      )
    }

    const zip = new JSZip()
    const manifest: string[] = [
      'IFG CRM export',
      `Generated: ${new Date().toISOString()}`,
      `Requested by: ${user.email ?? user.id}`,
      '',
      'Every file covers the complete history — this export is not date-filtered.',
      'Files are UTF-8 CSV with a byte-order mark, so Excel opens them correctly.',
      '',
      'Contents:',
    ]

    for (const report of REPORTS) {
      const runner = RUNNERS[report.id]
      if (!runner) continue

      try {
        const { columns, rows } = await runner({
          supabase,
          start: null,
          end: null,
          pipelineId: null,
          recruiterId: null,
        })

        zip.file(`${report.id}.csv`, toCSV(rows, columns))
        manifest.push(
          `  ${report.id}.csv — ${report.name}: ${rows.length.toLocaleString()} rows`,
        )
      } catch (err) {
        // One failing table must not cost the user the whole backup. The
        // manifest records the gap so nobody mistakes it for "no data".
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.error(`Export failed for ${report.id}:`, err)
        manifest.push(`  ${report.id}.csv — FAILED: ${message}`)
      }
    }

    zip.file('README.txt', manifest.join('\n'))

    const buffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    })

    const stamp = new Date().toISOString().slice(0, 10)

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="ifg-crm-export-${stamp}.zip"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Full export failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Export failed.' },
      { status: 500 },
    )
  }
}

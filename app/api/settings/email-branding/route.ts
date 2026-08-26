// Global email branding — read and save.
//
// GET  returns the stored config (merged over the shipped defaults) plus a
//      freshly-rendered preview, so the Settings screen always shows what
//      the current renderer produces rather than whatever was last saved.
// PUT  validates, re-renders, and persists config + HTML together. Rendering
//      here (server-side) rather than in the browser matters: resolveAssetUrl
//      falls back to window.location.origin in a browser, which would bake
//      localhost URLs into every outgoing email when saved from dev.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  resolveBranding,
  BRANDING_RENDERER_VERSION,
  type EmailBranding,
  type EmailBrandingRecord,
} from '@/lib/templates/branding-types'
import { renderBrandingSlots } from '@/lib/templates/render-branding'

const SETTINGS_KEY = 'email_branding'

/**
 * Flatten shared links to { merge_tag_key: url }. Stored next to the
 * rendered HTML so the send path can fold them straight into merge data —
 * the Deno functions never have to parse the branding config.
 */
function flattenLinks(config: EmailBranding): Record<string, string> {
  const out: Record<string, string> = {}
  for (const link of config.links ?? []) {
    if (link.key && link.url) out[link.key] = link.url
  }
  return out
}

export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('crm_settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const stored = (data?.value ?? null) as Partial<EmailBrandingRecord> | null
    const config = resolveBranding(stored?.config ?? null)

    return NextResponse.json({
      config,
      rendered: renderBrandingSlots(config),
      rendered_at: stored?.rendered_at ?? null,
      // True when the saved HTML predates the current renderer. The screen
      // surfaces this so an admin can republish after a deploy that changed
      // the markup, instead of silently sending stale branding.
      stale:
        !stored?.rendered || stored?.renderer_version !== BRANDING_RENDERER_VERSION,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // RLS also enforces this (migration 163), but an explicit check returns a
    // readable error instead of a silent zero-row update.
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Only admins can change email branding.' },
        { status: 403 },
      )
    }

    const body = (await request.json()) as { config?: Partial<EmailBranding> }
    if (!body?.config) {
      return NextResponse.json({ error: 'Missing config' }, { status: 400 })
    }

    // Merge over defaults so a partial payload can never drop a section.
    const config = resolveBranding(body.config)
    const rendered = renderBrandingSlots(config)

    // Guard against the dev-origin trap: if anything resolved to a localhost
    // URL, refuse rather than shipping images that no recipient can load.
    const allHtml = `${rendered.header}${rendered.footer}${rendered.legal}`
    if (/localhost|127\.0\.0\.1/i.test(allHtml)) {
      return NextResponse.json(
        {
          error:
            'Branding contains a localhost URL. Upload logos through this screen, or set NEXT_PUBLIC_APP_URL, then try again.',
        },
        { status: 400 },
      )
    }

    const record: EmailBrandingRecord = {
      config,
      rendered,
      link_values: flattenLinks(config),
      rendered_at: new Date().toISOString(),
      renderer_version: BRANDING_RENDERER_VERSION,
    }

    const { error } = await supabase.from('crm_settings').upsert(
      {
        key: SETTINGS_KEY,
        value: record,
        updated_at: record.rendered_at,
        updated_by: user.id,
      },
      { onConflict: 'key' },
    )

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, config, rendered })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

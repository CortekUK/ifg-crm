// Regenerate body_html from body_json for any template missing it.
// Renders typed blocks with the same shape the editor's Save flow uses,
// so campaigns and automations that read body_html have content to send.

const PROJECT_ID = process.env.SUPABASE_PROJECT_ID || 'jiuxsintslqryrvgevmc'
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN
if (!ACCESS_TOKEN) {
  console.error('Set SUPABASE_ACCESS_TOKEN env var.')
  process.exit(1)
}

async function query(sql) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    },
  )
  if (!res.ok) throw new Error(`Query failed (${res.status}): ${await res.text()}`)
  return res.json()
}

function renderBlock(block) {
  const c = block.content || {}
  switch (block.type) {
    case 'text': {
      const align = c.alignment || 'left'
      const pt = c.paddingTop ?? 8
      const pb = c.paddingBottom ?? 8
      return `<div style="padding:${pt}px 24px ${pb}px 24px;text-align:${align};font-size:16px;line-height:1.5;color:#1f2937;">${c.html || ''}</div>`
    }
    case 'button': {
      const align = c.alignment || 'center'
      const pt = c.paddingTop ?? 12
      const pb = c.paddingBottom ?? 12
      const px = c.paddingX ?? 24
      const py = c.paddingY ?? 12
      return `<div style="padding:${pt}px 24px ${pb}px 24px;text-align:${align};">` +
        `<a href="${c.url || '#'}" target="_blank" style="display:inline-block;background:${c.backgroundColor || '#2563eb'};color:${c.textColor || '#ffffff'};padding:${py}px ${px}px;border-radius:${c.borderRadius || 6}px;text-decoration:none;font-weight:600;font-size:16px;">${c.text || 'Button'}</a>` +
        `</div>`
    }
    case 'divider': {
      const pt = c.paddingTop ?? 10
      const pb = c.paddingBottom ?? 10
      return `<div style="padding:${pt}px 24px ${pb}px 24px;"><hr style="border:none;border-top:${c.thickness || 1}px ${c.style || 'solid'} ${c.color || '#e5e7eb'};margin:0;" /></div>`
    }
    case 'spacer': {
      return `<div style="height:${c.height || 16}px;"></div>`
    }
    case 'recruiter_signature': {
      const pt = c.paddingTop ?? 20
      const pb = c.paddingBottom ?? 10
      return `<div style="padding:${pt}px 24px ${pb}px 24px;font-size:14px;color:#1f2937;line-height:1.5;">` +
        `<div><strong>{{deal_owner_name}}</strong></div>` +
        `{{#if deal_owner_title}}<div style="color:#6b7280;">{{deal_owner_title}}</div>{{/if}}` +
        `{{#if deal_owner_email}}<div><a href="mailto:{{deal_owner_email}}" style="color:#2563eb;text-decoration:none;">{{deal_owner_email}}</a></div>{{/if}}` +
        `{{#if deal_owner_phone}}<div style="color:#6b7280;">{{deal_owner_phone}}</div>{{/if}}` +
        `{{#if deal_owner_calendly}}<div><a href="{{deal_owner_calendly}}" style="color:#2563eb;text-decoration:none;">Book a call</a></div>{{/if}}` +
        `</div>`
    }
    case 'html': {
      return c.code || ''
    }
    default:
      return ''
  }
}

function wrap(body) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{{subject}}</title></head>` +
    `<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">` +
    `<div style="max-width:600px;margin:0 auto;background:#ffffff;">` +
    `<div style="background:#0f172a;color:#ffffff;padding:20px 24px;text-align:center;">` +
    `<span style="font-size:20px;font-weight:bold;letter-spacing:1px;">IFG</span> ` +
    `<span style="font-size:14px;">International Football Group</span></div>` +
    body +
    `<div style="background:#f3f4f6;padding:20px 24px;text-align:center;font-size:12px;color:#6b7280;">` +
    `<p style="margin:0 0 6px;">International Football Group · Macclesfield FC, United Kingdom</p>` +
    `<p style="margin:0;"><a href="{{unsubscribe_url}}" style="color:#6b7280;">Unsubscribe</a></p></div>` +
    `</div></body></html>`
}

function buildHtml(blocks) {
  const body = blocks.map(renderBlock).join('\n')
  return wrap(body)
}

async function main() {
  // Pull every template — we'll regenerate body_html for any with valid
  // body_json (so the editor's typed blocks are the source of truth).
  const templates = await query(
    `select id, name, body_json, length(body_html) as html_len from email_templates where body_json is not null`,
  )
  console.log(`Found ${templates.length} templates with body_json\n`)

  let updated = 0
  for (const t of templates) {
    let blocks
    try {
      const raw = typeof t.body_json === 'string' ? t.body_json : JSON.stringify(t.body_json)
      const parsed = JSON.parse(raw)
      blocks = Array.isArray(parsed) ? parsed : null
    } catch {
      blocks = null
    }
    if (!Array.isArray(blocks) || blocks.length === 0) {
      console.log(`  - ${t.name}: skipped (body_json not a block array)`)
      continue
    }
    const html = buildHtml(blocks)
    const escaped = html.replace(/'/g, "''")
    await query(
      `update email_templates set body_html = '${escaped}', updated_at = now() where id = '${t.id}'`,
    )
    updated += 1
    console.log(`  ✓ ${t.name}: ${html.length} chars`)
  }

  console.log(`\nUpdated ${updated} templates.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

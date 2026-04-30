// One-shot repair: rebuild body_json for templates that were seeded with
// rich body_html but only a placeholder body_json block. Wraps the inner
// <body> content of each template in a single editor 'html' block so the
// editor canvas matches the preview.
//
// Run: node scripts/fix-template-body-json.mjs

const PROJECT_ID = process.env.SUPABASE_PROJECT_ID || 'jiuxsintslqryrvgevmc'
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN
if (!ACCESS_TOKEN) {
  console.error('Set SUPABASE_ACCESS_TOKEN env var first.')
  process.exit(1)
}

async function query(sql, params = []) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql, params }),
    },
  )
  if (!res.ok) {
    throw new Error(`Query failed (${res.status}): ${await res.text()}`)
  }
  return res.json()
}

function extractBodyContent(html) {
  // Pull the inside of <body>...</body>. If there's no body tag, just
  // strip the <!DOCTYPE> and outer <html>/<head> blocks. Falls back to
  // the original string if neither pattern matches.
  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)
  if (bodyMatch) return bodyMatch[1].trim()
  return html
    .replace(/^<!DOCTYPE[^>]*>\s*/i, '')
    .replace(/<\/?html\b[^>]*>/gi, '')
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, '')
    .trim()
}

function buildBlocks(htmlInside) {
  return [
    {
      id: `block_imported_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: 'html',
      content: { code: htmlInside },
    },
  ]
}

async function main() {
  const candidates = await query(
    `select id, name, body_html, length(body_html) as html_len, length(body_json::text) as json_len
     from email_templates
     where body_html is not null
       and length(body_html) > 1000
       and (length(body_json::text) < 400 or body_json is null)
     order by html_len desc`,
  )

  console.log(`Found ${candidates.length} templates to fix:\n`)

  for (const tpl of candidates) {
    const inside = extractBodyContent(tpl.body_html)
    const blocks = buildBlocks(inside)
    const stringified = JSON.stringify(blocks)

    // Send via update query that uses to_jsonb on the stringified value
    // — matches the existing convention where body_json is a JSON string
    // whose content parses as an array.
    const escaped = stringified.replace(/'/g, "''")
    await query(
      `update email_templates
       set body_json = to_jsonb('${escaped}'::text)
       where id = '${tpl.id}'`,
    )
    console.log(
      `  ✓ ${tpl.name} (${tpl.html_len} → 1 html block, ${stringified.length} chars)`,
    )
  }

  console.log(`\nDone. Open any of those templates in the editor — the canvas now shows the full content as an HTML block, editable.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

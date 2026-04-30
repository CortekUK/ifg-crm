// Rebuilds every seeded email template as a tree of typed editor blocks
// (text / button / divider / spacer / recruiter_signature) instead of a
// single opaque HTML block. The editor canvas can now drag-edit each
// piece, and rendering goes through the same renderBlocksToHTML pipeline
// as user-built templates.
//
// Phase 1: 14 automation templates (Initial Contact, Welcome×3,
//          Pre-Departure×3, Interview Reminder×2, Payment Overdue,
//          Application Reminder, Follow Up, Post-Interview, Application
//          Received).
//
// Phase 2: 5 campaign templates (Newsletter, Programme Announcement,
//          Event Invitation, Re-engagement, General Update).
//
// Run: node scripts/rebuild-templates-typed-blocks.mjs

const PROJECT_ID = process.env.SUPABASE_PROJECT_ID || 'jiuxsintslqryrvgevmc'
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN
if (!ACCESS_TOKEN) {
  console.error('Set SUPABASE_ACCESS_TOKEN env var first.')
  process.exit(1)
}

let blockCounter = 0
function blockId(prefix) {
  blockCounter += 1
  return `block_${Date.now()}_${blockCounter}_${prefix}`
}

// ─── Block factories ───────────────────────────────────────────────────

const text = (html, opts = {}) => ({
  id: blockId('txt'),
  type: 'text',
  content: {
    html,
    alignment: opts.alignment || 'left',
    fontSize: opts.fontSize || 'normal',
    paddingTop: opts.paddingTop ?? 8,
    paddingBottom: opts.paddingBottom ?? 8,
  },
})

const heading = (htmlText) =>
  text(`<p style="margin:0;font-size:24px;line-height:32px;font-weight:700;color:#0f172a;">${htmlText}</p>`, {
    fontSize: 'xlarge',
    paddingTop: 16,
    paddingBottom: 4,
  })

const button = (label, urlMergeTag, opts = {}) => ({
  id: blockId('btn'),
  type: 'button',
  content: {
    text: label,
    url: urlMergeTag,
    backgroundColor: opts.backgroundColor || '#2563eb',
    textColor: '#ffffff',
    borderRadius: 8,
    width: 'auto',
    alignment: 'center',
    paddingTop: 16,
    paddingBottom: 16,
    paddingX: 32,
    paddingY: 14,
  },
})

const divider = () => ({
  id: blockId('div'),
  type: 'divider',
  content: {
    style: 'solid',
    color: '#e5e7eb',
    thickness: 1,
    width: '100',
    paddingTop: 12,
    paddingBottom: 12,
  },
})

const spacer = (height = 16) => ({
  id: blockId('sp'),
  type: 'spacer',
  content: { height },
})

const signature = () => ({
  id: blockId('sig'),
  type: 'recruiter_signature',
  content: {
    showPhoto: true,
    showName: true,
    showTitle: true,
    showEmail: true,
    showPhone: true,
    showCalendly: true,
    layout: 'inline',
    alignment: 'left',
    photoSize: 'medium',
    paddingTop: 24,
    paddingBottom: 12,
  },
})

// ─── Template definitions ─────────────────────────────────────────────

const automationTemplates = [
  {
    name: 'Initial Contact Email',
    blocks: () => [
      heading('Welcome to IFG, {{first_name|there}}'),
      text(`<p>Thanks for reaching out to International Football Group. We're glad to have you on the radar — every player who comes through us starts with a quick chat so we understand your goals and what programme would suit you.</p>`),
      text(`<p>I'd love to learn more about your story. Pick a 15-minute slot below and we'll take it from there:</p>`),
      button('Book a 15-min intro call', '{{deal_owner_calendly|https://theinternationalfootballgroup.com/contact}}'),
      text(`<p style="font-size:14px;color:#6b7280;text-align:center;">Or paste this into your browser: <a href="{{deal_owner_calendly}}" style="color:#2563eb;">{{deal_owner_calendly}}</a></p>`, { alignment: 'center', fontSize: 'small' }),
      divider(),
      signature(),
    ],
  },
  {
    name: 'Application Reminder',
    blocks: () => [
      heading('Quick reminder, {{first_name|there}}'),
      text(`<p>Just a nudge — we haven't received your application yet. The earlier you submit, the better your chances of locking in a slot for the upcoming intake.</p>`),
      text(`<p>If anything's holding you back or you have questions, hit reply and I'll help.</p>`),
      button('Continue your application', '{{deal_owner_calendly|https://theinternationalfootballgroup.com/contact}}'),
      divider(),
      signature(),
    ],
  },
  {
    name: 'Follow Up Email',
    blocks: () => [
      heading('Following up, {{first_name|there}}'),
      text(`<p>Wanted to check in on where you are in your decision. No pressure — just letting you know we're here whenever you're ready to take the next step.</p>`),
      text(`<p>If it's easier to chat than to write, grab a slot below:</p>`),
      button('Book a quick call', '{{deal_owner_calendly|https://theinternationalfootballgroup.com/contact}}'),
      divider(),
      signature(),
    ],
  },
  {
    name: 'Application Received',
    blocks: () => [
      heading('Application received, {{first_name|there}}'),
      text(`<p>Thanks for submitting your application to IFG. We've got it on file and our team will review it over the next few working days.</p>`),
      text(`<p><strong>What happens next:</strong></p><ul><li>We review your application and football background</li><li>If your profile fits the programme, we'll invite you to an interview</li><li>You'll hear back either way within 5 working days</li></ul>`),
      text(`<p>If you have anything you forgot to mention or want to ask in the meantime, just reply to this email.</p>`),
      divider(),
      signature(),
    ],
  },
  {
    name: 'Interview Reminder — 1 Day',
    blocks: () => [
      heading('Your IFG interview is tomorrow'),
      text(`<p>Hi {{first_name|there}}, just a quick reminder of your upcoming interview with us.</p>`),
      text(`<div style="background:#f3f4f6;padding:16px;border-radius:8px;"><strong>When:</strong> {{meeting_time|tomorrow}}<br><strong>What:</strong> {{meeting_event_name|IFG Interview}}</div>`),
      spacer(12),
      button('Join the meeting', '{{meeting_link|#}}', { backgroundColor: '#16a34a' }),
      text(`<p style="font-size:14px;color:#6b7280;">Need to reschedule? <a href="{{schedule_link}}" style="color:#2563eb;">Pick a new time here</a>.</p>`, { fontSize: 'small' }),
      divider(),
      signature(),
    ],
  },
  {
    name: 'Interview Reminder — 1 Hour',
    blocks: () => [
      heading('Starting in an hour, {{first_name|there}}'),
      text(`<p>Your IFG interview kicks off in about an hour. Here's the join link so you've got it ready:</p>`),
      button('Join the meeting now', '{{meeting_link|#}}', { backgroundColor: '#16a34a' }),
      text(`<p style="font-size:14px;color:#6b7280;text-align:center;">Or copy this link: <a href="{{meeting_link}}" style="color:#2563eb;">{{meeting_link}}</a></p>`, { alignment: 'center', fontSize: 'small' }),
      text(`<p>See you in a bit!</p>`),
      divider(),
      signature(),
    ],
  },
  {
    name: 'Post-Interview Thank You',
    blocks: () => [
      heading('Great chat, {{first_name|there}}'),
      text(`<p>Thanks so much for taking the time today. It was great hearing about your goals and where you want to take your game.</p>`),
      text(`<p><strong>Next up:</strong> we'll review the conversation as a team and circle back with a decision in the next few working days. If you have any documents you want to share — references, school transcripts, footage — just reply to this email.</p>`),
      divider(),
      signature(),
    ],
  },
  {
    name: 'Welcome — Day 0',
    blocks: () => [
      heading('Welcome to the IFG family, {{first_name|there}}!'),
      text(`<p>This is the start of an exciting chapter. Your deposit is in, your spot is locked, and we couldn't be happier to have you with us.</p>`),
      text(`<p>You'll get a player portal account where you can track everything — invoices, schedule, programme info — all in one place. Your login details land in a separate email shortly.</p>`),
      text(`<p>Over the next few weeks, expect a welcome pack and onboarding info from us. If you ever need anything, my contact details are below — don't hesitate.</p>`),
      divider(),
      signature(),
    ],
  },
  {
    name: 'Welcome — Day 3',
    blocks: () => [
      heading('How are you settling in, {{first_name|there}}?'),
      text(`<p>It's been a few days since you joined us — wanted to check in. Anything we can help clarify? Questions about the programme, paperwork, what to bring?</p>`),
      text(`<p>Reply to this email anytime — I'm your direct point of contact through the whole process.</p>`),
      divider(),
      signature(),
    ],
  },
  {
    name: 'Welcome — Day 7',
    blocks: () => [
      heading('One week in, {{first_name|there}}'),
      text(`<p>It's been a week since you joined us — hope everything's making sense so far!</p>`),
      text(`<p><strong>Have you had a chance to:</strong></p><ul><li>Log into your player portal?</li><li>Review the programme schedule?</li><li>Sort travel and visa paperwork (if you're coming internationally)?</li></ul>`),
      text(`<p>If anything's outstanding, reply and we'll work through it together.</p>`),
      divider(),
      signature(),
    ],
  },
  {
    name: 'Pre-Departure — 1 Month',
    blocks: () => [
      heading('One month to go, {{first_name|there}}'),
      text(`<p>Your programme starts in a month. Now's the time to make sure all the logistics are sorted.</p>`),
      text(`<p><strong>Checklist:</strong></p><ul><li>Visa application submitted (if applicable)</li><li>Flights booked</li><li>Insurance arranged</li><li>Final payment scheduled</li></ul>`),
      text(`<p>Anything blocking you? Reply and let me know — we've helped hundreds of players through this and there's almost always a way forward.</p>`),
      divider(),
      signature(),
    ],
  },
  {
    name: 'Pre-Departure — 1 Week',
    blocks: () => [
      heading('See you in a week, {{first_name|there}}!'),
      text(`<p>You're a week out from arrival. The team is buzzing to meet you.</p>`),
      text(`<p><strong>Final reminders:</strong></p><ul><li>Bring your passport, visa documents, and travel insurance details</li><li>Pack training gear (and warm clothing — UK weather!)</li><li>Have my number saved on your phone in case of travel issues</li></ul>`),
      text(`<p>Safe travels — see you soon.</p>`),
      divider(),
      signature(),
    ],
  },
  {
    name: 'Pre-Departure — 1 Day',
    blocks: () => [
      heading('Travel day tomorrow, {{first_name|there}}'),
      text(`<p>This is the one. Tomorrow you fly out and your IFG journey kicks off.</p>`),
      text(`<p><strong>Last things:</strong></p><ul><li>Double-check your passport and travel docs are packed</li><li>Save my phone number — call/WhatsApp anytime if you hit a snag at the airport</li><li>Send a quick message when you land so we know you're in</li></ul>`),
      text(`<p>Have a smooth journey. We'll see you soon.</p>`),
      divider(),
      signature(),
    ],
  },
  {
    name: 'Payment Overdue',
    blocks: () => [
      heading('Payment reminder, {{first_name|there}}'),
      text(`<p>Heads up — we noticed your invoice for the programme is past its due date. Sometimes these things slip through, no judgement.</p>`),
      text(`<p>Please use the link below to settle the balance and keep your spot secure:</p>`),
      button('Pay invoice now', '{{schedule_link|#}}', { backgroundColor: '#dc2626' }),
      text(`<p style="font-size:14px;color:#6b7280;">If you've already paid in the last day or so, you can ignore this. If something's blocking the payment, reply and we'll help sort it.</p>`, { fontSize: 'small' }),
      divider(),
      signature(),
    ],
  },
]

const campaignTemplates = [
  {
    name: 'Newsletter — Monthly Update',
    subject: 'IFG Monthly: {{first_name|there}}, here\'s what\'s new',
    preheader: 'Programme news, player stories, and what\'s coming up',
    category: 'campaign',
    blocks: () => [
      heading('IFG Monthly Update'),
      text(`<p>Hi {{first_name|there}}, here's a quick round-up of what's been happening at IFG over the past month.</p>`),
      divider(),
      text(`<p><strong>Programme highlights</strong></p><p>Add a paragraph here about programme news, player success stories, results, etc.</p>`),
      divider(),
      text(`<p><strong>Coming up</strong></p><p>List the next intake dates, application deadlines, or events.</p>`),
      spacer(16),
      button('Read more on our site', 'https://theinternationalfootballgroup.com'),
      divider(),
      signature(),
    ],
  },
  {
    name: 'Programme Announcement',
    subject: '{{first_name|there}}, applications now open for our next programme',
    preheader: 'New intake dates announced — apply today',
    category: 'campaign',
    blocks: () => [
      heading('A new programme intake is open'),
      text(`<p>Hi {{first_name|there}}, we're opening applications for the next IFG programme intake. If you've been thinking about taking your game to the next level, this is the moment.</p>`),
      text(`<p><strong>What you'll get:</strong></p><ul><li>Professional coaching with UK-based coaches</li><li>Match exposure with affiliated academies</li><li>Education pathway alongside training</li><li>Full residential support</li></ul>`),
      spacer(16),
      button('Apply now', '{{deal_owner_calendly|https://theinternationalfootballgroup.com/contact}}'),
      text(`<p style="font-size:14px;color:#6b7280;text-align:center;">Limited spots — first come, first served.</p>`, { alignment: 'center', fontSize: 'small' }),
      divider(),
      signature(),
    ],
  },
  {
    name: 'Event Invitation',
    subject: '{{first_name|there}}, you\'re invited',
    preheader: 'Join us for an upcoming IFG event',
    category: 'campaign',
    blocks: () => [
      heading('You\'re invited'),
      text(`<p>Hi {{first_name|there}}, we're hosting an event and want you there.</p>`),
      text(`<div style="background:#f3f4f6;padding:16px;border-radius:8px;"><strong>What:</strong> Add event name<br><strong>When:</strong> Add date and time<br><strong>Where:</strong> Add location or video link</div>`),
      spacer(16),
      button('RSVP', '{{deal_owner_calendly|https://theinternationalfootballgroup.com/contact}}'),
      text(`<p>Hope to see you there!</p>`),
      divider(),
      signature(),
    ],
  },
  {
    name: 'Re-engagement — We Miss You',
    subject: 'Long time no speak, {{first_name|there}}',
    preheader: 'Just checking in — anything we can help with?',
    category: 'campaign',
    blocks: () => [
      heading('Hi again, {{first_name|there}}'),
      text(`<p>It's been a while since we last spoke. We don't want to bug you, but we did want to check in — sometimes life gets in the way of a decision and that's totally fine.</p>`),
      text(`<p>If you're still thinking about IFG, the door is wide open. If your plans changed, no problem — just hit reply and let us know so we can take you off the list.</p>`),
      spacer(16),
      button('Let\'s talk again', '{{deal_owner_calendly|https://theinternationalfootballgroup.com/contact}}'),
      divider(),
      signature(),
    ],
  },
  {
    name: 'General Update',
    subject: '{{first_name|there}}, an update from IFG',
    preheader: 'A quick note from the team',
    category: 'campaign',
    blocks: () => [
      heading('Quick update from IFG'),
      text(`<p>Hi {{first_name|there}}, edit this template to send any general announcement or update to your contacts.</p>`),
      text(`<p>Add the body of your message here. Keep it short and direct — campaign emails get the best response when they feel like a personal note rather than a corporate broadcast.</p>`),
      divider(),
      signature(),
    ],
  },
]

// ─── DB helpers ───────────────────────────────────────────────────────

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
  if (!res.ok) {
    throw new Error(`Query failed (${res.status}): ${await res.text()}`)
  }
  return res.json()
}

function escapeSqlString(s) {
  return s.replace(/'/g, "''")
}

async function updateAutomationTemplate(name, blocks) {
  const json = JSON.stringify(blocks)
  const escaped = escapeSqlString(json)
  const result = await query(
    `update email_templates set body_json = to_jsonb('${escaped}'::text), updated_at = now()
     where name = '${escapeSqlString(name)}'
     returning id`,
  )
  return result.length > 0
}

async function upsertCampaignTemplate(tpl) {
  const json = JSON.stringify(tpl.blocks())
  const escaped = escapeSqlString(json)
  const exists = await query(
    `select id from email_templates where name = '${escapeSqlString(tpl.name)}'`,
  )
  if (exists.length > 0) {
    await query(
      `update email_templates set body_json = to_jsonb('${escaped}'::text),
         subject = '${escapeSqlString(tpl.subject)}',
         preheader = '${escapeSqlString(tpl.preheader)}',
         category = '${tpl.category}',
         from_name_type = 'deal_owner',
         updated_at = now()
       where id = '${exists[0].id}'`,
    )
    return 'updated'
  } else {
    await query(
      `insert into email_templates (name, subject, body_html, body_json, category, from_name_type, preheader)
       values (
         '${escapeSqlString(tpl.name)}',
         '${escapeSqlString(tpl.subject)}',
         '',
         to_jsonb('${escaped}'::text),
         '${tpl.category}',
         'deal_owner',
         '${escapeSqlString(tpl.preheader)}'
       )`,
    )
    return 'inserted'
  }
}

async function main() {
  console.log('Phase 1 — rebuilding automation templates...\n')
  for (const tpl of automationTemplates) {
    const blocks = tpl.blocks()
    const ok = await updateAutomationTemplate(tpl.name, blocks)
    console.log(`  ${ok ? '✓' : '✗ (not found)'} ${tpl.name} — ${blocks.length} blocks`)
  }

  console.log('\nPhase 2 — campaign templates...\n')
  for (const tpl of campaignTemplates) {
    const blocks = tpl.blocks()
    const action = await upsertCampaignTemplate(tpl)
    console.log(`  ✓ ${tpl.name} (${action}) — ${blocks.length} blocks`)
  }

  console.log('\nDone. Open any template in the editor — every block is now drag-edit-able.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

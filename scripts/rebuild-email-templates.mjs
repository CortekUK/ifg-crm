// Rebuilds all 15 email templates with a professional, email-safe HTML shell
// and proper copy. Idempotent — matches by name and overwrites subject + body_html.
//
// Merge tags used (all are populated by process-automations/index.ts):
//   {{first_name}} {{last_name}} {{deal_title}}
//   {{deal_owner_name}} {{deal_owner_email}} {{deal_owner_phone}}
//   {{deal_owner_title}} {{deal_owner_calendly}} {{deal_owner_signature}}
//   {{position}} {{club_name}} {{graduation_year}} {{country}}
// Conditional helpers: {{#if field}}...{{/if}} and {{field|fallback}}.

import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

fs.readFileSync('.env.local', 'utf8').split('\n').forEach((line) => {
  const m = line.match(/^([A-Z_]+)=(.+)$/)
  if (m) process.env[m[1]] = m[2]
})

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

// ---------- Shared shell ----------

const COLORS = {
  bg: '#f4f5f7',
  card: '#ffffff',
  ink: '#0f172a',
  body: '#1f2937',
  muted: '#6b7280',
  border: '#e5e7eb',
  brand: '#ff3300',
  brandDark: '#cc2900',
}

const PREHEADER_STYLE =
  'display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;font-size:1px;line-height:1px;mso-hide:all;overflow:hidden'

function shell({ preheader, hero, body, cta, signOff = 'The IFG Team' }) {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>{{subject}}</title>
  <!--[if mso]><style type="text/css">body,table,td,a,p,h1,h2,h3{font-family:Arial,Helvetica,sans-serif!important;}</style><![endif]-->
  <style>
    @media only screen and (max-width:620px){
      .container{width:100%!important;}
      .px{padding-left:24px!important;padding-right:24px!important;}
      .h1{font-size:24px!important;line-height:32px!important;}
      .btn{display:block!important;width:100%!important;}
    }
    a{color:${COLORS.brand};text-decoration:none;}
    a:hover{text-decoration:underline;}
  </style>
</head>
<body style="margin:0;padding:0;background:${COLORS.bg};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:${COLORS.body};-webkit-font-smoothing:antialiased;">
  <div style="${PREHEADER_STYLE}">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.bg};">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:${COLORS.card};border-radius:8px;overflow:hidden;border:1px solid ${COLORS.border};">

        <!-- Header -->
        <tr><td style="background:${COLORS.ink};padding:20px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="left" style="font-size:0;">
                <span style="display:inline-block;background:${COLORS.brand};color:#ffffff;font-weight:700;font-size:18px;letter-spacing:1px;padding:6px 10px;border-radius:4px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">IFG</span>
                <span style="display:inline-block;color:#ffffff;font-size:14px;font-weight:500;letter-spacing:.3px;padding-left:12px;vertical-align:middle;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">International Football Group</span>
              </td>
              <td align="right" style="color:#94a3b8;font-size:12px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">theinternationalfootballgroup.com</td>
            </tr>
          </table>
        </td></tr>

        <!-- Hero -->
        <tr><td class="px" style="padding:40px 40px 16px 40px;">
          <h1 class="h1" style="margin:0 0 8px 0;font-size:28px;line-height:36px;color:${COLORS.ink};font-weight:700;letter-spacing:-.3px;">${hero}</h1>
        </td></tr>

        <!-- Body -->
        <tr><td class="px" style="padding:8px 40px 24px 40px;font-size:16px;line-height:1.65;color:${COLORS.body};">
          ${body}
        </td></tr>

        ${cta ? `
        <!-- CTA -->
        <tr><td class="px" align="left" style="padding:8px 40px 32px 40px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr><td align="center" bgcolor="${COLORS.brand}" style="border-radius:6px;">
              <a class="btn" href="${cta.url}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:600;color:#ffffff;background:${COLORS.brand};border-radius:6px;text-decoration:none;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${cta.label}</a>
            </td></tr>
          </table>
        </td></tr>` : ''}

        <!-- Signature -->
        <tr><td class="px" style="padding:0 40px 32px 40px;border-top:1px solid ${COLORS.border};">
          <p style="margin:24px 0 4px 0;font-size:15px;color:${COLORS.body};">${signOff},</p>
          <p style="margin:0 0 4px 0;font-size:16px;font-weight:600;color:${COLORS.ink};">{{deal_owner_name|The IFG Team}}</p>
          {{#if deal_owner_title}}<p style="margin:0 0 8px 0;font-size:14px;color:${COLORS.muted};">{{deal_owner_title}}</p>{{/if}}
          <p style="margin:8px 0 0 0;font-size:14px;color:${COLORS.muted};line-height:1.6;">
            {{#if deal_owner_email}}<a href="mailto:{{deal_owner_email}}" style="color:${COLORS.muted};text-decoration:none;">{{deal_owner_email}}</a>{{/if}}
            {{#if deal_owner_phone}} &nbsp;&middot;&nbsp; <a href="tel:{{deal_owner_phone}}" style="color:${COLORS.muted};text-decoration:none;">{{deal_owner_phone}}</a>{{/if}}
            {{#if deal_owner_calendly}}<br /><a href="{{deal_owner_calendly}}" target="_blank" style="color:${COLORS.brand};font-weight:600;">Book a call</a>{{/if}}
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#fafbfc;padding:20px 40px;border-top:1px solid ${COLORS.border};text-align:center;">
          <p style="margin:0 0 4px 0;font-size:12px;color:${COLORS.muted};line-height:1.6;">International Football Group &middot; theinternationalfootballgroup.com</p>
          <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">You're receiving this because you applied or expressed interest in an IFG programme. If this isn't you, just reply and we'll sort it out.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

const p = (s) => `<p style="margin:0 0 16px 0;">${s}</p>`
const ul = (items) => `<ul style="margin:0 0 16px 20px;padding:0;color:${COLORS.body};">${items.map((i) => `<li style="margin:0 0 6px 0;">${i}</li>`).join('')}</ul>`
const note = (s) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff7ed;border-left:3px solid ${COLORS.brand};border-radius:4px;margin:0 0 16px 0;"><tr><td style="padding:14px 16px;font-size:14px;color:#7c2d12;line-height:1.6;">${s}</td></tr></table>`

// ---------- Templates ----------

const templates = [
  {
    name: 'Initial Contact Email',
    subject: 'Welcome to IFG, {{first_name}}',
    preheader: 'A warm welcome from the IFG team — here\'s what happens next.',
    hero: 'Welcome to IFG, {{first_name}}',
    body:
      p('Thanks for reaching out to International Football Group. We\'re glad to have you on the radar.') +
      p('My name is {{deal_owner_name|The IFG Team}}, and I\'ll be your main point of contact through the recruitment process. Here\'s what you can expect from us in the coming days:') +
      ul([
        'A short call to learn about your goals, playing background, and what you\'re looking for.',
        'A clear plan of which programmes and clubs are the right fit for you.',
        'Honest feedback at every step — no pressure, no surprises.',
      ]) +
      p('If you\'d like to skip the back-and-forth and book a call straight away, you can do that with the link below.'),
    cta: { label: 'Book a 15-min intro call', url: '{{deal_owner_calendly|https://theinternationalfootballgroup.com/contact}}' },
  },

  {
    name: 'Follow Up Email',
    subject: 'Following up — {{first_name}}',
    preheader: 'Just checking in to see if you\'ve had a chance to think things over.',
    hero: 'Quick check-in, {{first_name}}',
    body:
      p('I wanted to follow up on my last note. I know inboxes get busy, so no pressure at all — but I didn\'t want this to slip through the cracks.') +
      p('To recap, IFG helps players like you find the right programme abroad, with full support on placement, paperwork, and arrival logistics. The next step would be a quick call so I can understand your goals and put together a tailored shortlist.') +
      p('If now isn\'t the right time, just hit reply and let me know — I\'ll circle back in a few weeks.'),
    cta: { label: 'Find a time that works', url: '{{deal_owner_calendly|https://theinternationalfootballgroup.com/contact}}' },
  },

  {
    name: 'Application Received',
    subject: 'We\'ve received your application, {{first_name}}',
    preheader: 'Your application is in. Here\'s what happens next.',
    hero: 'Application received',
    body:
      p('Hi {{first_name}},') +
      p('Thanks for submitting your application to <strong>{{deal_title|our programme}}</strong>. We\'ve got everything on our end and your file is now with the recruitment team for review.') +
      p('Here\'s what to expect over the next 5–7 working days:') +
      ul([
        'Initial review of your application and any supporting materials.',
        'A short interview to discuss your goals and answer your questions.',
        'A decision on next steps, including programme fit and timelines.',
      ]) +
      p('If anything is missing or we need extra details, I\'ll be in touch directly. In the meantime, if you have any questions just hit reply.'),
  },

  {
    name: 'Application Reminder',
    subject: 'Complete your application, {{first_name}}',
    preheader: 'A few quick steps left to finish your IFG application.',
    hero: 'Almost there, {{first_name}}',
    body:
      p('I noticed your application for <strong>{{deal_title|our programme}}</strong> hasn\'t been submitted yet. It only takes a few more minutes to wrap up.') +
      note('Spaces fill on a first-completed basis, not first-started — so finishing the form is what locks in your place in the queue.') +
      p('If you\'ve hit a snag with any section, reply to this email and I\'ll walk you through it personally.'),
    cta: { label: 'Continue your application', url: '{{deal_owner_calendly|https://theinternationalfootballgroup.com}}' },
  },

  {
    name: 'Interview Reminder — 1 Day',
    subject: 'Reminder: your IFG interview tomorrow',
    preheader: 'A quick reminder of what to expect — and how to prep.',
    hero: 'Looking forward to speaking tomorrow',
    body:
      p('Hi {{first_name}},') +
      p('Just a heads-up that we\'re scheduled to chat tomorrow about <strong>{{deal_title|your programme}}</strong>. The call will be around 20–30 minutes and is informal — we just want to get to know you.') +
      p('A few things worth thinking about beforehand:') +
      ul([
        'What you\'re hoping to get out of the programme — football, education, life experience.',
        'Your current playing level and recent form.',
        'Any questions you have about logistics, accommodation, or costs.',
      ]) +
      p('No need to prepare slides or anything formal — just be yourself.'),
    cta: { label: 'View call details', url: '{{deal_owner_calendly|#}}' },
  },

  {
    name: 'Interview Reminder — 1 Hour',
    subject: '{{first_name}}, we\'re on in 1 hour',
    preheader: 'Quick heads-up — your call with IFG is in an hour.',
    hero: 'See you in an hour',
    body:
      p('Hi {{first_name}},') +
      p('One hour to go. Looking forward to it.') +
      p('If you can\'t see the call link in your calendar, the booking confirmation has it — or you can use the link below to jump in when it\'s time.') +
      p('If something has come up and you need to reschedule, just reply to this email and we\'ll find another slot.'),
    cta: { label: 'Open meeting link', url: '{{deal_owner_calendly|#}}' },
  },

  {
    name: 'Post-Interview Thank You',
    subject: 'Thanks for the chat, {{first_name}}',
    preheader: 'Great speaking with you — here\'s a recap and what comes next.',
    hero: 'Great speaking with you',
    body:
      p('Hi {{first_name}},') +
      p('Thanks for taking the time to chat about <strong>{{deal_title|our programme}}</strong>. It was great to learn more about you and what you\'re looking for.') +
      p('Here\'s what happens from here:') +
      ul([
        'I\'ll review our conversation and discuss your profile internally with the recruitment team.',
        'Within 3–5 working days, you\'ll hear back with a clear next step — whether that\'s a programme offer, a follow-up question, or a referral to a better-fit option.',
        'If you have any questions in the meantime, my contact details are at the bottom of this email.',
      ]) +
      p('Thanks again — speak soon.'),
  },

  {
    name: 'On Boarding',
    subject: 'You\'re in — welcome to the IFG platform',
    preheader: 'Set up your portal and get started in two minutes.',
    hero: 'You\'re officially on board, {{first_name}}',
    body:
      p('Welcome to International Football Group. Now that you\'re part of the programme, your IFG portal is the home for everything you\'ll need:') +
      ul([
        '<strong>Documents</strong> — upload your passport, contracts, and supporting paperwork in one place.',
        '<strong>Schedule</strong> — see your interviews, milestones, and arrival timeline at a glance.',
        '<strong>Messages</strong> — direct line to your recruiter and the IFG support team.',
        '<strong>Pre-departure checklist</strong> — clear, week-by-week prep so nothing slips.',
      ]) +
      p('You should have received a separate email with a link to set your password. If you can\'t find it, click the button below and we\'ll resend it.'),
    cta: { label: 'Open your IFG portal', url: 'https://app.theinternationalfootballgroup.com' },
  },

  {
    name: 'Payment Overdue',
    subject: 'Action needed: payment overdue',
    preheader: 'Your invoice is past its due date — let\'s sort it out.',
    hero: 'Payment overdue',
    body:
      p('Hi {{first_name}},') +
      p('Our records show that an invoice on your account has passed its due date. To keep your place on <strong>{{deal_title|the programme}}</strong> secure, we need to settle this as soon as possible.') +
      note('If the payment is already on its way, please ignore this email — it can take a few working days to clear and we\'ll update your account once it lands.') +
      p('If you\'re experiencing any difficulty with payment, please reply to this email directly. We\'d much rather hear from you and find a solution together than leave it unresolved.'),
    cta: { label: 'View invoice & pay now', url: '{{deal_owner_calendly|https://app.theinternationalfootballgroup.com}}' },
  },

  {
    name: 'Welcome — Day 0',
    subject: 'Welcome to IFG, {{first_name}}!',
    preheader: 'You\'re officially in. Here\'s what to expect over the next few weeks.',
    hero: 'Welcome to the IFG family',
    body:
      p('Hi {{first_name}},') +
      p('Congratulations — you\'re officially part of <strong>{{deal_title|the IFG programme}}</strong>. We\'re thrilled to have you with us.') +
      p('Over the next few days you\'ll receive a few short emails from me to help you get oriented. Here\'s the rough timeline:') +
      ul([
        '<strong>Today</strong> — this welcome email and your portal access.',
        '<strong>Day 3</strong> — a tour of your IFG portal and where to find everything.',
        '<strong>Day 7</strong> — an introduction to the team you\'ll be working with.',
      ]) +
      p('You don\'t need to do anything right now — just keep an eye on your inbox. If you\'ve got any questions in the meantime, you know where to find me.'),
  },

  {
    name: 'Welcome — Day 3',
    subject: 'Your IFG portal — a quick tour',
    preheader: 'Two minutes to get familiar with where everything lives.',
    hero: 'Your IFG portal, in two minutes',
    body:
      p('Hi {{first_name}},') +
      p('Hope you\'re settling in. By now you should have set up your IFG portal — if you haven\'t, the original invitation is still valid (or hit reply and I\'ll resend it).') +
      p('Here\'s what to look for inside:') +
      ul([
        '<strong>Documents</strong> — upload anything we\'ve asked for (passport, school records, references).',
        '<strong>Schedule</strong> — your milestones, interviews, and the date your programme starts.',
        '<strong>Messages</strong> — the fastest way to reach me or any of the IFG team.',
        '<strong>Resources</strong> — guides on accommodation, visas, kit, and what to expect on arrival.',
      ]) +
      p('Take ten minutes today to click around — it\'ll save you a lot of email back-and-forth later on.'),
    cta: { label: 'Open my IFG portal', url: 'https://app.theinternationalfootballgroup.com' },
  },

  {
    name: 'Welcome — Day 7',
    subject: 'Meet the team you\'ll be working with',
    preheader: 'A quick intro to the people behind your IFG experience.',
    hero: 'Meet your IFG team',
    body:
      p('Hi {{first_name}},') +
      p('Hope your first week with us has been smooth. I wanted to take a moment to introduce the people you\'ll be working with through the rest of your IFG journey:') +
      ul([
        '<strong>Recruitment</strong> — your main point of contact (that\'s me) for everything programme-related.',
        '<strong>Player support</strong> — handles accommodation, kit, and on-the-ground logistics once you\'re out there.',
        '<strong>Compliance</strong> — visas, contracts, and anything official.',
        '<strong>Operations</strong> — the team making sure the whole programme runs without a hitch.',
      ]) +
      p('Every name and email lives inside your portal under <em>Team</em>. If you\'re ever unsure who to ask, default to me and I\'ll route it to the right person.') +
      p('More soon — for now, enjoy the rest of your week.'),
  },

  {
    name: 'Pre-Departure — 1 Month',
    subject: '4 weeks to go — your pre-departure checklist',
    preheader: 'A month out: paperwork, packing, and what you can do now.',
    hero: '4 weeks until {{deal_title|departure}}',
    body:
      p('Hi {{first_name}},') +
      p('It\'s getting close. With four weeks until your programme starts, here\'s what should be on your radar this week:') +
      ul([
        '<strong>Passport & visa</strong> — confirm your passport has at least 6 months\' validity. If you need a visa, the application should be in by now.',
        '<strong>Travel insurance</strong> — get a policy that covers the full duration plus a few weeks\' buffer.',
        '<strong>Health</strong> — book any vaccinations you need; some require a course over multiple weeks.',
        '<strong>Banking</strong> — set up a card that works abroad without nasty fees (Wise, Revolut, or your bank\'s travel card).',
        '<strong>Goodbyes</strong> — start telling friends and family you\'re leaving. Sounds obvious, but the time goes fast.',
      ]) +
      p('We\'ll send another checklist a week out, and a final note 24 hours before you fly. Any questions in the meantime, just hit reply.'),
    cta: { label: 'View full checklist in portal', url: 'https://app.theinternationalfootballgroup.com' },
  },

  {
    name: 'Pre-Departure — 1 Week',
    subject: '7 days to go — final checklist',
    preheader: 'A week out — here\'s what should already be done and what\'s left.',
    hero: 'One week to go, {{first_name}}',
    body:
      p('Hi {{first_name}},') +
      p('A week from now you\'ll be on your way. Here\'s the final checklist to run through this week:') +
      ul([
        '<strong>Travel</strong> — confirm flights, print or save boarding passes offline, set arrival reminders.',
        '<strong>Documents</strong> — passport, visa, programme acceptance letter, and travel insurance somewhere both digital and physical.',
        '<strong>Pack</strong> — boots, training kit, weather-appropriate everyday clothes, adapters, basic medications.',
        '<strong>Phone</strong> — international roaming or a local SIM plan sorted before you fly.',
        '<strong>Money</strong> — a small amount of local currency on arrival, plus your travel card activated.',
      ]) +
      note('Don\'t leave packing until the last 24 hours. Lay everything out by mid-week so you have time to grab anything missing.') +
      p('You\'ll get one more note from me the day before you travel.'),
  },

  {
    name: 'Pre-Departure — 1 Day',
    subject: 'See you tomorrow, {{first_name}}!',
    preheader: 'Last note before you fly — safe travels.',
    hero: 'See you tomorrow',
    body:
      p('Hi {{first_name}},') +
      p('This is the last email before you arrive. Quick final reminders:') +
      ul([
        'Passport, visa, acceptance letter, and travel insurance — on you, not in checked baggage.',
        'A fully charged phone and a backup power bank for the journey.',
        'Arrival contact details (in your portal) saved offline in case you don\'t have signal.',
        'Get some sleep tonight — travel days are longer than they look.',
      ]) +
      p('We\'re really looking forward to having you with us. Travel safe, and don\'t hesitate to message me if anything comes up on the way.') +
      p('See you on the other side.'),
    cta: { label: 'Arrival info & contacts', url: 'https://app.theinternationalfootballgroup.com' },
  },
]

// ---------- Run ----------

async function run() {
  // Match by exact name. "On Boarding " in the DB has a trailing space — we
  // also rename it to remove that.
  for (const t of templates) {
    const html = shell({ preheader: t.preheader, hero: t.hero, body: t.body, cta: t.cta })

    // try exact match first, then trimmed-trailing-space variant for "On Boarding "
    const matchNames = [t.name, `${t.name} `]
    const { data: rows } = await sb
      .from('email_templates')
      .select('id, name')
      .in('name', matchNames)

    if (!rows || rows.length === 0) {
      console.log(`MISS  ${t.name} — no row found`)
      continue
    }

    for (const row of rows) {
      const { error } = await sb
        .from('email_templates')
        .update({
          name: t.name, // strips trailing space if present
          subject: t.subject,
          body_html: html,
        })
        .eq('id', row.id)
      console.log(error ? `FAIL  ${t.name}: ${error.message}` : `OK    ${t.name}  (${html.length} chars)`)
    }
  }
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})

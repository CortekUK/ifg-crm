// DEPRECATED (2026-08-18): the recruiter signature, divider, social row,
// partner logos and disclaimer are no longer per-template. They live in one
// global record edited at Settings -> Email Branding and are stitched into
// every email at send time (see lib/templates/render-branding.ts).
//
// The create-*.mjs scripts that import from here are historical one-offs
// that have already run. DO NOT re-run them as-is: they append footer blocks
// to body_json, and the send path would then add the global footer underneath
// — the recipient gets two signatures and two disclaimers. Strip the footer
// blocks from any script you revive.

// Shared building blocks for IFG email-template scripts. Every per-template
// script under /scripts/create-*.mjs imports from here so the polished
// "Follow up 1" frame (padding rhythm, dynamic recruiter sig, thick black
// divider, MFC International Academy social row, partner-logo footer) is
// guaranteed identical across templates.
//
// Extract reasoning: before this module, every new template script
// duplicated ~150 lines of factories + render boilerplate. A typo in
// one would silently diverge from the rest. Centralising means a per-
// template script is now just (name + subject + body blocks) — usually
// 40-60 lines.
//
// Update Nathan's fallback details / social URLs / partner logos here
// once and every script picks it up next run.

import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// ─── Env + Supabase client ──────────────────────────────────────────────

fs.readFileSync('.env.local', 'utf8').split('\n').forEach((line) => {
  const m = line.match(/^([A-Z_]+)=(.+)$/)
  if (m) process.env[m[1]] = m[2]
})

export const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

// ─── Brand constants ────────────────────────────────────────────────────

// Macclesfield FC International Academy — canonical social URLs. Update
// these in one place and every template picks them up next run.
export const SOCIAL_URLS = {
  facebook: 'https://www.facebook.com/MFCIntAcademy',
  twitter: 'https://twitter.com/MFCIntAcademy',
  instagram: 'https://www.instagram.com/mfcintacademy/?hl=en',
  tiktok: 'https://www.tiktok.com/tag/macclesfieldfc?lang=en',
  flickr: 'https://www.flickr.com/people/193009807@N04/',
}

// Default fallback recruiter — used by render-html.ts at send time when a
// deal has no owner. Mirrored here so the body_html stub the script writes
// matches what the canonical renderer would produce.
export const FALLBACK_RECRUITER = {
  name: 'Nathan Bibby',
  title: 'Director of Recruitment & Scouting',
  email: 'nathan@macclesfieldfc.com',
  phone: '+1 (714) 515-2767',
}

export const STANDARD_DISCLAIMER =
  'Macc Football Club Limited, a company registered in England. Company number 12931817. Registered office address: The Leasing.com Stadium, London Rd, Macclesfield, SK11 7SP. **Confidentiality:** Privileged / Confidential information may be contained in this message and may be subject to legal privilege. Access to this email by anyone other than the intended is unauthorised. If you are not the intended recipient (or responsible for delivery of the message to such person), you may not use, copy, distribute or deliver to anyone this message (or any part of its contents) or take any action in reliance on it. In such case, you should destroy this message, and notify us immediately. If you have received this email in error, please notify us immediately by email or telephone and delete the email from any company. All reasonable precautions have been taken to ensure no viruses are present in this email. As our company cannot accept responsibility for any loss or damage arising from the use of this email or attachments we recommend that you subject these to your virus checking procedures prior to use.'

// DEPRECATED — see the note at STANDARD_FOOTER_BLOCKS usage below. Kept so
// the historical create-*.mjs scripts still parse; updated to the current
// University of Lancashire mark so a re-run can't resurrect the retired crest.
export const STANDARD_LOGOS = [
  { src: '/signatures/lancashire.png', alt: 'University of Lancashire' },
  { src: '/signatures/ifg.png', alt: 'The International Football Group' },
  { src: '/signatures/macclesfield-fc.png', alt: 'Macclesfield FC' },
]

// SharePoint download URL for the IFG Academy Registration Form PDF —
// short shareable link form. Used by every UK GAP follow-up email.
export const REGISTRATION_FORM_URL =
  'https://netorgft7310925-my.sharepoint.com/:b:/g/personal/info_macclesfieldfc_com/ESiqxO1wJVVIvQS5RypEtOkBoQV6a2xk2c86giecL3B9fA?e=SzArWl'

// Same registration PDF, but the long OneDrive web-app URL Ghulam pasted
// for the Summer Residency campaign. Kept separate so we mirror exactly
// what's wired into AC — if the two URL forms ever resolve to different
// documents we don't accidentally cross-contaminate campaigns.
export const RESIDENCY_REGISTRATION_FORM_URL =
  'https://netorgft7310925-my.sharepoint.com/personal/info_macclesfieldfc_com/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Finfo%5Fmacclesfieldfc%5Fcom%2FDocuments%2FInternational%2FIFG%20Player%20Registration%20Form%2Epdf&parent=%2Fpersonal%2Finfo%5Fmacclesfieldfc%5Fcom%2FDocuments%2FInternational&ga=1'

// UCLan Masters degree catalogue — used by MASTERS follow up 1 + 3 to
// render a clickable course bullet list. Edit URLs / labels here once
// when UCLan rotates a course.
export const MASTERS_COURSES = [
  {
    label: 'Sports Coaching Masters - MSc Degree - UCLan',
    url: 'https://www.lancashire.ac.uk/postgraduate/courses/sports-coaching-performance-msc',
  },
  {
    label: 'Performance Analysis & Talent Management, MSc - UCLan',
    url: 'https://www.lancashire.ac.uk/postgraduate/courses/performance-analysis-and-talent-management-msc',
  },
  {
    label: 'Physical Education & School Sport, MA - UCLan',
    url: 'https://www.lancashire.ac.uk/postgraduate/courses/physical-education-leadership-ma',
  },
  {
    label: 'Sport Business Management MSc - Postgraduate - UCLan',
    url: 'https://www.lancashire.ac.uk/subjects/sports-coaching-and-leadership',
  },
  {
    label: 'Sport & Exercise Science MSc, Postgraduate Course - UCLan',
    url: 'https://www.lancashire.ac.uk/postgraduate/courses/sport-exercise-science-msc',
  },
  {
    label: 'Nutrition & Exercise Sciences, MSc - UCLan',
    url: 'https://www.lancashire.ac.uk/postgraduate/courses/nutrition-exercise-sciences-msc',
  },
]

// Render the Masters catalogue as `<ul><li><a>…</a></li>…</ul>`.
export function mastersCoursesListHtml() {
  const items = MASTERS_COURSES.map(
    (c) => `<li><a href="${c.url}">${c.label}</a></li>`,
  ).join('')
  return `<ul>${items}</ul>`
}

// Matthew Morgan's hardcoded signature for the MASTERS — MM variant
// templates. AC has these emails sending AS Matthew specifically (no
// dynamic deal_owner), so we mirror the static sig verbatim. Note the
// title on these is "Technical Lead" — different from "Technical
// Director" in his deal-owner profile entry (AC inconsistency we're
// preserving).
export const MATTHEW_MORGAN = {
  name: 'Matthew Morgan',
  title: 'Technical Lead',
  email: 'matthew@macclesfieldfc.com',
  phone: '+447480218319',
  calendly: 'https://calendly.com/matthewjmorgan',
}

// Chris Bunten — fixed sender for the MASTERS 2024 initial-contact and
// some retention emails. AC body sigs only show name (no title / phone),
// so use staticSignature({ name: CHRIS_BUNTEN.name }).
export const CHRIS_BUNTEN = {
  name: 'Chris Bunten',
  title: 'Director of Growth',
  email: 'chris@theinternationalfootballgroup.com',
  phone: '+447588584053',
  calendly: 'https://calendly.com/chris-theinternationalfootballgroup',
}

// Generic static signature — used when a template has a fixed sender
// (not deal_owner-driven). Pass any subset of fields; only ones with
// values render. `salutation` defaults to "Kind Regards," — pass
// "Kind Regards" (no comma) to match templates that omit the comma
// (e.g. the MASTERS — MM variants do).
export function staticSignature({
  name,
  title,
  email,
  phone,
  salutation = 'Kind Regards,',
  paddingTop = 24,
  paddingBottom = 12,
}) {
  const lines = [salutation]
  if (name) lines.push(name)
  if (title) lines.push(title)
  if (email) lines.push(`<a href="mailto:${email}">${email}</a>`)
  if (phone) lines.push(phone)
  return {
    id: blockId('sig'),
    type: 'text',
    content: {
      html: `<p>${lines.join('<br>')}</p>`,
      alignment: 'left',
      fontSize: 'normal',
      paddingTop,
      paddingBottom,
    },
  }
}

// MASTERS — MM templates use Matthew's sig with NO comma after
// "Kind Regards" (per AC), and only show name / title / phone (no email).
export function matthewMorganSignature() {
  return staticSignature({
    name: MATTHEW_MORGAN.name,
    title: MATTHEW_MORGAN.title,
    phone: MATTHEW_MORGAN.phone,
    salutation: 'Kind Regards',
  })
}

// ─── Juventus Training Experience brand assets ─────────────────────────
//
// Juventus emails use a separate brand setup from the UCLan / MFC ones:
//   * dual-logo strip (IFG + Juventus Training Experience SUMMER) — no
//     UCLan, no Macclesfield FC
//   * no confidentiality disclaimer paragraph
//   * Instagram-only social row (their dedicated handle)
//   * sender is the shared "Juventus Training Experience 2025" mailbox
//   * body sig is just "Kind Regards, Nathan Bibby" — no title/phone
//
// All three Juventus follow-ups share these — define here so a brand
// rotation is one edit.

export const JUVENTUS_INSTAGRAM_URL =
  'https://www.instagram.com/juvesummertrainingexp?igsh=NTc4MTIwNjQ2YQ=='

export const JUVENTUS_LOGOS = [
  {
    src: 'https://content.app-us1.com/cdn-cgi/image/onerror=redirect,width=650,dpr=2,fit=scale-down,format=auto/K5q56/2023/01/24/1fa33ed0-b931-4b6f-bf86-9becc8495d3d.png',
    alt: 'The International Football Group',
  },
  {
    src: 'https://content.app-us1.com/cdn-cgi/image/onerror=redirect,width=650,dpr=2,fit=scale-down,format=auto/K5q56/2023/01/24/f790d0a7-95cf-43da-bbad-320ff5d152a0.png',
    alt: 'Juventus Training Experience SUMMER',
  },
]

// JTE Summer hero-logo URL — shorthand for the second JUVENTUS_LOGOS entry.
// Used as the centered header image at the top of every Juventus initial-
// contact email.
export const JUVENTUS_HERO_LOGO_URL = JUVENTUS_LOGOS[1].src

// Juventus-specific footer disclaimer. Different from STANDARD_DISCLAIMER
// (no "Macc Football Club Limited" preamble; opens with "A licensor of
// Juventus FC."). Used by the Juventus initial-contact emails — the
// follow-up emails leave the disclaimer empty.
export const JUVENTUS_DISCLAIMER =
  'A licensor of Juventus FC. **Confidentiality:** Privileged/ Confidential information may be contained in this message and may be subject to legal privilege. Access to this email by anyone other than the intended is unauthorised. If you are not the intended recipient (or responsible for delivery of the message to such person), you may not use, copy, distribute or deliver to anyone this message (or any part of its contents) or take any action in reliance on it. In such case, you should destroy this message, and notify us immediately. If you have received this email in error, please notify us immediately by email or telephone and delete the email from any company. All reasonable precautions have been taken to ensure no viruses are present in this email. As our company cannot accept responsibility for any loss or damage arising from the use of this email or attachments we recommend that you subject these to your virus checking procedures prior to use.'

// Instagram-only social row — only Juventus social channel referenced
// in the AC templates. Centred, coloured.
export function juventusSocial() {
  return {
    id: blockId('soc'),
    type: 'social',
    content: {
      style: 'coloured',
      alignment: 'center',
      platforms: {
        facebook: { url: '', enabled: false },
        twitter: { url: '', enabled: false },
        instagram: { url: JUVENTUS_INSTAGRAM_URL, enabled: true },
        tiktok: { url: '', enabled: false },
        flickr: { url: '', enabled: false },
        linkedin: { url: '', enabled: false },
        youtube: { url: '', enabled: false },
        threads: { url: '', enabled: false },
      },
    },
  }
}

// Juventus dual-logo footer block — IFG + Juventus Training Experience
// SUMMER. Disclaimer defaults to empty (matches Juventus follow-up emails);
// pass { disclaimer: JUVENTUS_DISCLAIMER } for the initial-contact emails
// which include the "A licensor of Juventus FC..." paragraph.
export function juventusCompanySignature({ disclaimer = '' } = {}) {
  return {
    id: blockId('co'),
    type: 'company_signature',
    content: {
      logos: JUVENTUS_LOGOS,
      logoWidth: 180,
      disclaimer,
      paddingTop: 24,
      paddingBottom: 16,
      alignment: 'center',
    },
  }
}

// ─── Block ID helper ────────────────────────────────────────────────────

let blockCounter = 0
export function blockId(prefix) {
  blockCounter += 1
  return `block_${Date.now()}_${blockCounter}_${prefix}`
}

// ─── Block factories ────────────────────────────────────────────────────
//
// All factories mirror the patterns in "UCLan follow up 1" — see
// memory/project_email_template_conventions.md for the rationale.

// Standard paragraph: paddingTop 0, paddingBottom 12. Override with opts.
export const para = (html, opts = {}) => ({
  id: blockId('txt'),
  type: 'text',
  content: {
    html,
    alignment: opts.alignment || 'left',
    fontSize: opts.fontSize || 'normal',
    paddingTop: opts.paddingTop ?? 0,
    paddingBottom: opts.paddingBottom ?? 12,
  },
})

// Image block — used for the JTE Summer hero logo at the top of Juventus
// initial-contact emails. Centred, generous padding so the logo breathes.
export const image = (src, opts = {}) => ({
  id: blockId('img'),
  type: 'image',
  content: {
    src,
    alt: opts.alt || '',
    alignment: opts.alignment || 'center',
    width: opts.width ?? 400,
    paddingTop: opts.paddingTop ?? 16,
    paddingBottom: opts.paddingBottom ?? 16,
  },
})

// Section heading — 20px bold dark, with breathing room above.
export const heading = (label, opts = {}) => ({
  id: blockId('h'),
  type: 'text',
  content: {
    html: `<p style="margin:0;font-size:20px;line-height:28px;font-weight:700;color:#0f172a;">${label}</p>`,
    alignment: opts.alignment || 'left',
    fontSize: 'large',
    paddingTop: opts.paddingTop ?? 16,
    paddingBottom: opts.paddingBottom ?? 8,
  },
})

// CTA button. Defaults to dark navy + white text (matches AC's "Schedule
// a Call Now" style). Pass `backgroundColor` to override (e.g. '#b91c1c'
// for the IFG primary red used in Follow up 1's CTA).
export const button = (text, url, opts = {}) => ({
  id: blockId('btn'),
  type: 'button',
  content: {
    text,
    url,
    backgroundColor: opts.backgroundColor || '#0f172a',
    textColor: opts.textColor || '#ffffff',
    borderRadius: opts.borderRadius ?? 6,
    width: opts.width || 'auto',
    alignment: opts.alignment || 'center',
    paddingTop: opts.paddingTop ?? 16,
    paddingBottom: opts.paddingBottom ?? 16,
    paddingX: opts.paddingX ?? 32,
    paddingY: opts.paddingY ?? 14,
  },
})

// Dynamic recruiter signature — pulls deal_owner_* at send time, falls
// back to Nathan Bibby (handled in render-html.ts) when no deal owner.
export const recruiterSignature = (opts = {}) => ({
  id: blockId('sig'),
  type: 'recruiter_signature',
  content: {
    layout: opts.layout || 'stacked',
    showName: opts.showName ?? true,
    alignment: opts.alignment || 'left',
    photoSize: opts.photoSize || 'medium',
    showEmail: opts.showEmail ?? true,
    showPhone: opts.showPhone ?? true,
    showPhoto: opts.showPhoto ?? false,
    showTitle: opts.showTitle ?? true,
    paddingTop: opts.paddingTop ?? 24,
    showCalendly: opts.showCalendly ?? false,
    paddingBottom: opts.paddingBottom ?? 12,
  },
})

// Thick black horizontal rule — sits between recruiter sig and social row.
export const divider = (opts = {}) => ({
  id: blockId('div'),
  type: 'divider',
  content: {
    color: opts.color || '#141414',
    style: opts.style || 'solid',
    width: opts.width || '100',
    thickness: opts.thickness ?? 3,
    paddingTop: opts.paddingTop ?? 10,
    paddingBottom: opts.paddingBottom ?? 10,
  },
})

// 5-platform social row (FB / X / Instagram / TikTok / Flickr) with the
// MFC International Academy URLs already filled in.
export const social = (opts = {}) => ({
  id: blockId('soc'),
  type: 'social',
  content: {
    style: opts.style || 'coloured',
    alignment: opts.alignment || 'center',
    platforms: {
      facebook: { url: SOCIAL_URLS.facebook, enabled: true },
      twitter: { url: SOCIAL_URLS.twitter, enabled: true },
      instagram: { url: SOCIAL_URLS.instagram, enabled: true },
      tiktok: { url: SOCIAL_URLS.tiktok, enabled: true },
      flickr: { url: SOCIAL_URLS.flickr, enabled: true },
      linkedin: { url: '', enabled: false },
      youtube: { url: '', enabled: false },
      threads: { url: '', enabled: false },
    },
  },
})

// Partner-logo strip + standard confidentiality disclaimer.
export const companySignature = (opts = {}) => ({
  id: blockId('co'),
  type: 'company_signature',
  content: {
    logos: opts.logos || STANDARD_LOGOS,
    logoWidth: opts.logoWidth ?? 120,
    disclaimer: opts.disclaimer || STANDARD_DISCLAIMER,
    paddingTop: opts.paddingTop ?? 24,
    paddingBottom: opts.paddingBottom ?? 16,
    alignment: opts.alignment || 'center',
  },
})

// ─── body_html stub renderer ────────────────────────────────────────────
//
// The script writes a minimal-but-sendable body_html so the template is
// usable immediately. The canonical renderer in lib/templates/render-html.ts
// regenerates body_html with full IFG chrome the moment the user opens
// the template in the editor and clicks Save & Exit.

function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c],
  )
}

export function renderBodyHtml(blocks) {
  const parts = []
  for (const b of blocks) {
    if (b.type === 'text') {
      parts.push(
        `<div style="padding:${b.content.paddingTop}px 0 ${b.content.paddingBottom}px 0;text-align:${b.content.alignment};font-family:Arial,Helvetica,sans-serif;color:#1f2937;font-size:14px;line-height:1.5;">${b.content.html}</div>`,
      )
    } else if (b.type === 'button') {
      parts.push(
        `<div style="padding:${b.content.paddingTop}px 0 ${b.content.paddingBottom}px 0;text-align:${b.content.alignment};"><a href="${b.content.url}" target="_blank" style="display:inline-block;background:${b.content.backgroundColor};color:${b.content.textColor};padding:${b.content.paddingY}px ${b.content.paddingX}px;text-decoration:none;border-radius:${b.content.borderRadius}px;font-weight:bold;font-size:16px;font-family:Arial,Helvetica,sans-serif;">${b.content.text}</a></div>`,
      )
    } else if (b.type === 'divider') {
      parts.push(
        `<div style="padding:${b.content.paddingTop}px 0 ${b.content.paddingBottom}px 0;"><hr style="border:0;border-top:${b.content.thickness}px ${b.content.style} ${b.content.color};margin:0;width:${b.content.width}%;"></div>`,
      )
    } else if (b.type === 'recruiter_signature') {
      // Mirrors render-html.ts post-Nathan-fallback: per-field |fallback
      // merge tags so orphan deals render coherent sigs.
      const F = FALLBACK_RECRUITER
      parts.push(
        `<div style="padding:24px 0 12px 0;font-family:Arial,Helvetica,sans-serif;color:#1f2937;font-size:14px;line-height:1.5;"><p style="margin:0 0 8px 0;">Kind Regards,</p><p style="margin:0;"><strong>{{deal_owner_name|${F.name}}}</strong><br>{{deal_owner_title|${F.title}}}<br><a href="mailto:{{deal_owner_email|${F.email}}}">{{deal_owner_email|${F.email}}}</a><br>{{deal_owner_phone|${F.phone}}}</p></div>`,
      )
    } else if (b.type === 'social') {
      const enabled = Object.entries(b.content.platforms).filter(
        ([, v]) => v.enabled,
      )
      const icons = enabled
        .map(
          ([name, v]) =>
            `<a href="${escapeHtml(v.url || '#')}" target="_blank" style="display:inline-block;margin:0 8px;color:#1f2937;text-decoration:none;font-size:13px;">${name}</a>`,
        )
        .join('')
      parts.push(
        `<div style="padding:8px 0;text-align:${b.content.alignment};">${icons}</div>`,
      )
    } else if (b.type === 'company_signature') {
      const logos = b.content.logos
        .map(
          (l) =>
            `<img src="${escapeHtml(l.src)}" alt="${escapeHtml(l.alt)}" width="${b.content.logoWidth}" style="margin:0 12px;vertical-align:middle;">`,
        )
        .join('')
      const disclaimerHtml = escapeHtml(b.content.disclaimer).replace(
        /\*\*(.+?)\*\*/g,
        '<strong>$1</strong>',
      )
      parts.push(
        `<div style="padding:${b.content.paddingTop}px 0 ${b.content.paddingBottom}px 0;text-align:center;font-family:Arial,Helvetica,sans-serif;"><div style="margin-bottom:16px;">${logos}</div><p style="margin:0;font-size:11px;color:#6b7280;line-height:1.5;font-style:italic;">${disclaimerHtml}</p></div>`,
      )
    }
  }
  return parts.join('\n')
}

// ─── Upsert ────────────────────────────────────────────────────────────
//
// Idempotent: matches by name. Updates the existing row in place if
// found (preserves id, so wired automation steps stay connected),
// inserts a new row otherwise.

export async function upsertTemplate({
  name,
  subject,
  preheader = '',
  category = 'automation',
  fromNameType = 'deal_owner',
  fixedFromName = null,
  fixedFromEmail = null,
  isDraft = false,
  blocks,
}) {
  if (!name) throw new Error('upsertTemplate: name is required')
  if (!subject) throw new Error('upsertTemplate: subject is required')
  if (!Array.isArray(blocks)) throw new Error('upsertTemplate: blocks must be an array')

  const bodyHtml = renderBodyHtml(blocks)

  const { data: existing, error: selErr } = await sb
    .from('email_templates')
    .select('id')
    .eq('name', name)
    .maybeSingle()
  if (selErr) throw selErr

  const payload = {
    name,
    subject,
    preheader,
    body_html: bodyHtml,
    body_json: blocks,
    category,
    from_name_type: fromNameType,
    fixed_from_name: fixedFromName,
    fixed_from_email: fixedFromEmail,
    is_draft: isDraft,
    updated_at: new Date().toISOString(),
  }

  if (existing?.id) {
    const { error } = await sb
      .from('email_templates')
      .update(payload)
      .eq('id', existing.id)
    if (error) throw error
    console.log(`✓ Updated "${name}" (id ${existing.id}) — ${blocks.length} blocks`)
    return { id: existing.id, action: 'updated' }
  } else {
    const { data, error } = await sb
      .from('email_templates')
      .insert(payload)
      .select('id')
      .single()
    if (error) throw error
    console.log(`✓ Inserted "${name}" (id ${data.id}) — ${blocks.length} blocks`)
    return { id: data.id, action: 'inserted' }
  }
}

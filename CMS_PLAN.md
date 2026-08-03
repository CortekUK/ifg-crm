# IFG CMS Rebuild — Plan & Spec

Turning the current tab/dialog "Website Content" tool into a proper page-by-page CMS
with media control, per-programme package pricing, and "restore default" everywhere.

Status: **planning approved on scope; awaiting go to implement Phase 1.**

---

## 1. Where we are today

- The CMS is **not page-based** — it's 6 flat lists on one tabbed screen
  (`app/(dashboard)/website-content/page.tsx`): Success Stories, Gallery,
  University Courses, Staff, FAQs, ID Clinics.
- Backed by 3 tables: `website_success_stories`, `website_gallery_categories`,
  and the overloaded `website_site_content` (keyed by a `type` string).
- **~80% of the site is not editable at all** — Home, About, Summer Residency,
  University, Gap Year, Macclesfield sub-pages, Contact, News are hardcoded in
  `web/lib/data.ts` (1,245 lines).
- The website reads published rows via `web/lib/content.ts` (Supabase REST, anon
  key, ISR 60s) and **falls back to bundled `data.ts`** when the CMS is empty.
  → "default content" already exists as a concept; "restore default" = remove the override.
- Media upload already works: `lib/website-content/upload.ts` → Supabase `uploads` bucket.
- Security: RLS via `is_content_admin()` (admin/super_admin only); public sees `published = true`.

### Pricing lives in two disconnected places (the risk)
- **Display** (`web/lib/data.ts`): Summer packages A–F (£3,500/£6,000/£8,000, deposit
  £2,000), University "From £18,500", Gap Year Full/Half season (no deposit).
- **Charge** (`app/api/public/deposit/route.ts`): deposit `£2,000` (env), residency
  full amounts **hardcoded** `[3500,6000,8000]`, university `18500` (env), card fee
  gross-up (3.5% + £0.20).
- They match today only by hand-syncing. Change one, not the other → silent money bug.

---

## 2. Approved scope

- **Edit depth:** key content + media (headings, copy, hero/section images & video,
  CTAs, and each page's existing collections). Layout stays fixed. No drag-drop builder.
- **First pages:** Home, Summer Residency, University, Gap Year.
- **Pricing:** dedicated module; per-programme default deposit with optional
  per-package override; card fee = admin-only advanced setting.
- **Restore default:** per field, per section, and per whole page/programme.

---

## 3. Architecture

Schema-driven **page overrides** merged onto bundled defaults, plus a money-safe
**packages** table that is the single source of truth for display *and* checkout.

### 3a. Data model (additive — existing tables untouched)

```
website_pages
  slug        text unique     'home' | 'summer-residency' | 'university' | 'gap-year' | …
  title       text            CMS display name
  route       text            '/', '/programmes/…'
  overrides   jsonb           ONLY changed fields (partial doc, path-keyed)
  published   boolean         draft vs live
  updated_by  uuid / timestamps

website_packages
  programme       text        'residency' | 'university' | 'gapyear'
  key             text        stable id: 'A'…'F', 'full-season', 'half-1' …
  label           text        "Full 6 Weeks"
  subtitle        text        dates / season
  duration        text        "6 weeks"
  full_amount     int         authoritative charge amount (£, whole units)
  deposit_amount  int null    per-package override; null → use programme default
  deposit_enabled boolean
  full_enabled    boolean
  currency        text        default 'GBP'
  breakdown       jsonb       display-only lines [{label,value}]
  featured        boolean
  published       boolean
  sort_order      int
  UNIQUE(programme, key)

website_pricing_settings          -- one row per programme
  programme        text unique
  deposit_default  int            e.g. 2000 (0/null → programme has no deposit, e.g. gapyear)
  fee_rate         numeric        default 0.035   (admin-only advanced)
  fee_fixed        numeric        default 0.20    (admin-only advanced)
```

RLS on all three: public read where `published = true` (packages/pages), admin-all via
`is_content_admin()`. Mirrors migration 140.

### 3b. Shared page-schema format
One code module defines, per page, its sections → fields (text / richtext / image /
image[] / link / repeater) and the `data.ts` path each maps to. Used by **both** the
CRM editor (to render inputs) and the web merge (to apply overrides). No schema field
= not editable (keeps a premium page from being broken).

### 3c. Web consumption
- `getPage(slug)` → overrides or null (ISR, null-safe).
- `mergePage(BUNDLED_DEFAULT, overrides)` → deep-merge; no override = identical to today.
- `getPackages(programme)` → published packages or `[]`; pages fall back to bundled
  `SUMMER_RESIDENCY.options` / `UNIVERSITY` / `GAP_YEAR` when empty.

### 3d. Money-safe checkout
`app/api/public/deposit/route.ts` stops using the hardcoded array. It resolves the
package by `programme` + `key` from `website_packages` and uses DB `full_amount` /
resolved deposit as **authoritative** — client can't invent amounts; server validates
against *published* packages. Fee gross-up unchanged. Seed migration inserts today's
exact prices → zero day-one change.

---

## 4. Admin UX
Replace tabs with a CMS shell:
- Left rail: website pages + programmes, grouped (Main · Programmes · Pricing · Collections),
  each with a status pill: `Default` / `Customised` / `Draft`.
- Page editor: real sections, inline text, first-class media picker (upload + preview +
  alt text, reusing `uploadWebsiteImage`), per-field/section/page **Reset to default**,
  Publish toggle, Preview + View-live links.
- Programmes & Pricing: per-programme package list (add/edit/reorder, full price + deposit
  + toggles + breakdown), plus a per-programme deposit-settings panel; card fee under an
  advanced/admin section.
- Existing 6 modals kept and re-homed under their page/collection.

---

## 5. Phases
1. **Foundation** (invisible): migrations for `website_pages`, `website_packages`,
   `website_pricing_settings` + RLS; seed packages with current prices; shared schema
   format; web `getPage` / `mergePage` / `getPackages`. Wire 4 pages to read merged
   output (no overrides yet → pixel-identical).
2. **Pricing** (highest value + money-critical): DB-drive the checkout API; wire
   Summer/University/Gap display to `getPackages`; build Programmes & Pricing admin;
   verify checkout charges the DB amount end-to-end.
3. **Page content**: admin shell + schema-driven editor + media picker + reset-to-default
   for Home + programme pages.
4. Fold in existing collections; expand schemas; QA vs `QA_CHECKLIST.md`, mobile,
   build/lint/typecheck.

---

## 6. Risks & guardrails
- Existing tables/modals untouched; new tables additive; pages fall back to `data.ts`
  until an override is saved; RLS unchanged.
- **Money:** exact price seeding (zero day-one change); server-authoritative validation
  preserved; per-package deposit override + Gap Year no-deposit case; audit every other
  reference to these amounts (`apply.tsx`, exit-intent, chatbot) for stale hardcodes.
- Read `DESIGN.md` / `CONTENT_GUIDE.md` / `PROJECT_BRIEF.md` / `QA_CHECKLIST.md` before
  building UI so the admin matches CRM conventions and brand voice.

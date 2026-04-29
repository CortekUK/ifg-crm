# IFG CRM — Demo Run-Through & Factsheet

> A walkthrough of the three primary lead-acquisition flows in the IFG CRM, with talking points and a product factsheet. Use this as the script when demoing to stakeholders.

---

## Factsheet

**Product:** IFG CRM — a recruitment CRM for the International Football Group, purpose-built around moving prospective players from first touch to enrolment.

**Who uses it:**
- **Recruiters** — work the deal pipeline, follow up on replies.
- **Admins / Super-Admins** — run marketing, automations, invoicing, settings, user management.
- **Players (external)** — log in to a separate **Player Portal** to view invoices, pay, and manage settings.

**Core capabilities:**
- **Contacts** — single record of every prospect, with custom fields, lists, tags, and source tracking.
- **Pipelines & Deals** — Kanban + list views, drag-and-drop stages, owner assignment, deal activities timeline.
- **Automations** — stage-triggered email/SMS sequences, time-based triggers, contact enrolment, run history.
- **Campaigns** — broadcast email/SMS to lists, tags or pipeline-stage cohorts; scheduled or immediate.
- **Templates** — reusable email + SMS templates with a built-in editor.
- **Replies (Email & SMS)** — inbound reply inbox with **Smart Match** (auto-link to contacts) and **Smart Deal** (auto-create deals in pipelines).
- **Invoices & Payments** — invoice generation, Stripe checkout, payment plans, cancellation flow, overdue automations.
- **Player Portal** — players see and pay their invoices, manage profile, view analytics.
- **Analytics & Reports** — dashboards plus generated/scheduled reports.

**Integrations / inbound channels:**
- **ActiveCampaign** webhook (form submissions from the public website)
- **WordPress / Gravity / WPForms** webhook (alternative form path)
- **Calendly** webhook (booked calls)
- **Stripe** webhook (payment events)
- **Resend** webhook (email events + inbound replies)
- **ClickSend** webhook (SMS delivery + inbound)

**Backend rhythms (Vercel Cron):**
- `process-campaigns` — every 1 minute (sends queued campaign batches)
- `process-automations` — every 5 minutes (advances enrolled contacts through automation steps)
- `check-time-triggers` — daily 09:00 UTC (fires date-based triggers)

**Roles model:** `admin`, `super_admin`, `recruiter`. Recruiters see Dashboard / Contacts / Pipelines / Replies. Marketing, Automation, Finance, Insights, and Admin sections are admin-gated. RLS enforces this at the database layer too.

---

## Automation Catalogue

Twelve automation types ship with the CRM, fired by seven trigger sources. Each one is a configurable workflow — admins pick the trigger, the steps (email / SMS / wait / move stage / notify), and any exit conditions.

| Automation Type | Triggered By | What It Does | What Happens After |
|---|---|---|---|
| **Deal Creation** | `form_submission` (ActiveCampaign / WordPress) | Spins up a deal in the chosen pipeline when a website form is submitted. Optionally assigns owner via round-robin and adds contact to lists. | A new deal appears in the entry stage with a recruiter assigned; the contact is added to relevant lists; downstream stage-triggered automations can fire. |
| **List Assignment** | `form_submission` | Adds the new contact to one or more static lists, plus dynamic lists based on field rules (e.g., `position = goalkeeper` → Goalkeepers list). | Contact becomes targetable by future campaigns segmented by list. |
| **Initial Contact** | `enters_stage` | Sends the first outreach email when a deal lands in the entry stage. | If the player replies, deal can auto-move to a "Replied" stage and the sequence stops; if no reply, follow-up automations pick up. |
| **Follow-Up** | `enters_stage` | Multi-step sequence (e.g., follow-up after 2 days, 5 days, 10 days) if no reply to initial contact. | Reply → exit to "Replied" stage; no reply by end of sequence → move to "No Reply" / "Lost" stage. |
| **Application Received** | `enters_stage` (Application stage) or `form_submission` | Sends confirmation email acknowledging the application and setting expectations (3–5 day review window). | Player knows their application is in; recruiter has time to review without the player chasing. |
| **Interview Reminder** | `time_before_date` (interview_date) | Sends scheduled reminders — typically 1 day before and 1 hour before the interview, with the Zoom link and prep tips. | Reduced no-shows; player arrives prepared with CV and questions. |
| **Post-Interview** | `stage_change` (after interview stage) | Sends a thank-you / next-steps email immediately after the interview stage is reached. | Player understands what happens next (offer, deposit invoice timeline); reduces inbound "what's the status?" messages. |
| **Deposit Invoice** | `enters_stage` (Offer Accepted) | Generates and sends the deposit invoice email with Stripe payment link. | Player can pay online; payment event triggers the Welcome Sequence. |
| **Payment Overdue** | `invoice_overdue` | Sends a chase email when an invoice passes its due date without payment. Optionally stops on payment. | Player either pays (sequence auto-stops) or finance team gets visibility on the unpaid invoice. |
| **Welcome Sequence** | `payment_received` / `stage_change` (Enrolled) | Onboarding sequence: Day 0 welcome, Day 3 portal walkthrough, Day 7 next steps. Can auto-create a Player Portal account. | New player is engaged from day one, has portal access, and knows what's coming next. |
| **Pre-Departure** | `time_before_date` (programme_start_date / arrival_date) | Time-based reminders before the player departs — typically 1 month, 1 week, 1 day before. | Player arrives with paperwork, packing list, and arrival-day instructions all confirmed. |
| **Custom** | Any of the seven trigger types | Admin-built sequence using any combination of step types: send email, send SMS, wait, move stage, notify (parent / deal owner / admin), create portal account. | Whatever the admin configured — fully bespoke flows for edge cases not covered by the templates above. |

**Step types available inside any automation:**
`send_email`, `send_sms`, `wait` (days/hours), `move_to_stage`, `create_deal`, `notify` (parent / deal owner / admin), `create_portal_account`.

**Universal exit conditions:**
- **Exit on reply** — if the player replies during the sequence, stop and (optionally) move the deal to a positive-outcome stage.
- **No-reply stage** — if the sequence completes without engagement, move the deal to a "Lost" / "No Reply" stage.
- **Stop on payment** — for invoice-related automations, halt as soon as payment is received.

---

## The Three Flows

There are three ways a prospective player ends up in a recruiter's pipeline:

| # | Flow | Who initiates | Speed |
|---|------|---------------|-------|
| 1 | **ActiveCampaign Form Submission** | The player fills a form on the public website | Real-time |
| 2 | **Campaign + Smart Match** | We send a broadcast; replies are smart-matched to contacts and deals | Async (campaign-driven) |
| 3 | **Manual Entry** | A recruiter or admin adds the contact + deal directly | Real-time |

The flows below are ordered the way they're best demoed — start with the most automated (Flow 1), then show the smart matching capability (Flow 2), then the manual fallback (Flow 3).

---

## Flow 1 — ActiveCampaign Form Submission (Inbound Lead)

### The scenario
A player visits one of the IFG public-facing pages and submits an enquiry form. We have **three live forms** behind ActiveCampaign:
- **Gap Year Programme** (`form_id=gap`)
- **University Programme — UCLan** (`form_id=uclan`)
- **Training Experience — Masters** (`form_id=masters`)

ActiveCampaign posts the submission to our webhook, the contact is created or updated automatically, and the form submission is logged. From there, downstream automations and assignment rules can pick it up.

### What happens under the hood
1. AC fires a webhook to `/api/webhooks/activecampaign?form_id=<form>`.
2. Field-mapping is **fuzzy** — handles AC's varying field names (`first_name`, `firstname`, `fname`, etc.) so changes on the AC side don't break the integration.
3. If the email already exists, the contact is **updated** (without overwriting good data with nulls). If new, a contact is **created** with `source: 'website_form'`.
4. The submission is logged to `form_submissions` for an audit trail.
5. Custom fields like `length_of_stay` and `expected_year_of_entry` are stored in the contact's `custom_fields` JSONB.

### Demo walkthrough

**Step 1 — Show the public form (or describe it)**
> "When a player fills the Gap Year Programme form on our website, ActiveCampaign captures it and forwards it to the CRM."

**Step 2 — Open Contacts**
- Navigate to **Contacts** in the sidebar.
- Sort by Created (newest first).
- Point out the most recent contact tagged with `source: website_form`.

> "Here's the player who just submitted — name, email, phone, gender, country, position, and date of birth all populated automatically. No manual data entry."

**Step 3 — Open the Contact Detail sheet**
- Click into the contact.
- Show the **custom fields** section (`length_of_stay`, `expected_year_of_entry`).
- Show the **Form Submissions** related section.

> "We also keep the original form submission attached to the contact, so we always know which programme they applied for and when."

**Step 4 — Show Form Submissions audit log**
- Settings → Integrations → Form Submissions (or wherever you've surfaced it).

> "Every webhook payload is logged. If a submission ever fails — bad data, missing email — we can see exactly what came in and why it didn't process."

**Step 5 — Show an automation reacting to it**
- Navigate to **Automations**.
- Open an automation triggered by `source = website_form` or by entering the relevant pipeline stage.

> "This is where the magic happens — as soon as the contact is created, an automation kicks off: a welcome email, a follow-up after 24 hours if no reply, and so on."

### Talking points
- **Zero manual data entry** for inbound leads.
- **Resilient to AC field renames** — fuzzy mapping means marketing can edit forms without engineering involvement.
- **Three forms, one endpoint** — adding a fourth programme is a config change, not a deploy.
- **Full audit trail** — every submission is recorded.

---

## Flow 2 — Campaign + Smart Match (Outbound + Inbound Match)

### The scenario
The marketing team wants to re-engage a cohort — for example, all contacts from the 2024 University Programme who never converted. They send a broadcast email or SMS campaign. When players reply, our **Smart Match** system links the reply to the right contact and **Smart Deal** drops them into the appropriate pipeline with a recruiter assigned.

### What happens under the hood
1. **Campaign creation** — admin builds a campaign in `Campaigns → New Campaign`: pick recipients (lists, tags, pipeline stages), template, schedule.
2. **Sending** — `process-campaigns` cron runs every 60 seconds and sends batches via Resend (email) or ClickSend (SMS).
3. **Replies arrive** — inbound emails hit `resend-inbound`, inbound SMS hits `clicksend-inbound`. Both edge functions log the reply and try to match it to an existing contact by email/phone.
4. **Unmatched replies** land in the **Replies inbox** (`/replies`).
5. **Smart Match** — uses Levenshtein-distance string matching on names + normalised phone matching to suggest contact links for unmatched replies, with a confidence score.
6. **Smart Deal** — for matched replies (especially positive-intent ones), creates a deal in the campaign's linked pipeline, assigning to a recruiter via **round-robin** or manual selection.

### Demo walkthrough

**Step 1 — Build a campaign**
- Navigate to **Campaigns**.
- Click **New Campaign**.
- Walk through the modal:
  - Channel: Email or SMS.
  - Recipients tab: pick a **list**, one or more **tags**, or **pipeline stages** — show the live recipient count update.
  - Content tab: pick a template (or write inline), preview it.
  - Schedule tab: send now or schedule.

> "Notice we can target by list, tag, or pipeline stage — so 'everyone in Stage 3 who hasn't moved in 14 days' is a 30-second campaign."

**Step 2 — Send (or show a recently sent campaign)**
- Save & send.
- Open the campaign detail sheet.
- Show stats: sent, delivered, opens, clicks, replies.

> "The cron picks this up within a minute and starts sending. As replies come in, they're tracked here in real time."

**Step 3 — Replies inbox**
- Navigate to **Replies**.
- Show the **Email** and **SMS** tabs.
- Show the **Unmatched** sub-tab — replies from numbers/emails not in the contacts table.

> "Some replies come from numbers we don't recognise — maybe a parent replying from their phone, or a different email address. Those land here."

**Step 4 — Smart Match**
- Click the **Smart Match** button (sparkles icon).
- Show the modal analysing — it suggests contact matches with confidence scores (High / Medium / Low) and a reason ("Phone number matches", "Name similarity 85%").
- Tick the high-confidence ones, click **Apply**.

> "The system uses fuzzy matching on names and normalised phone numbers — UK 07xxx becomes 447xxx automatically — so it catches 'Sarah Jones' from a +447xxx number even if the original record was '07xxx'. We just confirm and move on."

**Step 5 — Smart Deal**
- Switch to the **Matched** tab — replies now linked to contacts.
- Click **Smart Deal** (briefcase icon).
- Show the modal: each matched reply with **positive intent** becomes a candidate deal, ready to drop into the campaign's linked pipeline.
- Choose **Round-robin** or **Manual** assignment.
- Apply.

> "Round-robin distributes new deals fairly across the recruiters assigned to that pipeline. Or we can hand-pick the recruiter for a specific reply. Either way, three clicks turns a campaign reply into an active pipeline deal."

**Step 6 — Show the new deal in Pipelines**
- Navigate to **Pipelines**, open the relevant pipeline.
- Show the deal that just appeared in the entry stage with the assigned recruiter.

> "From a marketing broadcast to an assigned, qualified pipeline deal — fully in-app, no spreadsheets, no copy-paste."

### Talking points
- **Closed-loop marketing-to-sales** — the campaign system and the pipeline system aren't separate tools, they hand off seamlessly.
- **Fuzzy matching catches the messy cases** — different email, different phone, slight name variations.
- **Round-robin built in** — fair distribution without anyone managing it manually.
- **Intent detection** — replies are classified (positive / question / negative / neutral) so we can prioritise.

---

## Flow 3 — Manual Entry (Recruiter-Driven)

### The scenario
A recruiter meets a player at a tournament, gets a referral, or talks to a parent on the phone. They need to add the contact and create a pipeline deal directly — no form, no campaign.

### What happens under the hood
1. Admin/Super-Admin creates the contact (RLS enforces admin-only contact inserts).
2. The contact appears in Contacts immediately.
3. From the contact (or from the pipeline directly), a deal is created and dropped into a pipeline stage.
4. Automations linked to that pipeline stage fire as normal — manual entry doesn't bypass the engagement flow.

### Demo walkthrough

**Step 1 — Create the contact**
- Navigate to **Contacts → Add Contact**.
- Fill the form: name, email, phone, gender, country, position, DOB, programme of interest, notes.
- Save.

> "All the same fields as the form-driven flow — same data model, same downstream behaviour."

**Step 2 — Add a deal from the contact**
- Open the contact's detail sheet.
- Click **Add Deal**.
- Choose the pipeline (e.g., Gap Year 2026), the entry stage, owner.
- Save.

> "We can add a deal directly from the contact, so we never lose the link between the player and the work they're in."

**Step 3 — Show it on the Kanban board**
- Navigate to **Pipelines**, open the chosen pipeline.
- Show the new deal card in the entry stage.

> "Now the recruiter can drag it through stages — and any automations attached to those stages fire automatically, just like the inbound flows."

**Step 4 — Drag the deal to the next stage**
- Drag from "New Lead" to "Contacted".
- Show the toast / activity timeline confirming the move.
- If an automation is wired to that stage, mention it: "And that triggers our follow-up email automation in the background."

### Talking points
- **Manual is a first-class flow** — not an afterthought. Manually-entered contacts get the same downstream treatment as inbound ones.
- **RLS-protected** — only admins/super-admins can create contacts, preventing data sprawl.
- **Stage-triggered automations work uniformly** — moving a deal to a stage runs the same automation regardless of how the contact got into the system.

---

## Closing the Demo

Bring it together:

> "So we've got three doors into the system — the website forms via ActiveCampaign, our outbound campaigns with smart-matched replies, and direct manual entry from recruiters. Whichever door a player walks through, they end up in the same place: a pipeline, with an assigned recruiter, with automations engaging them. That's the value — one consistent system, three lead sources, zero gaps."

# QA_FIX_VERIFICATION.md

How to verify the 34 fixes made against the Notion QA board (7 Oct 2026 round).
Written so QA can work top to bottom without reading any code.

Each test gives: **where to go → what you saw before → what you should see now →
what to screenshot**.

---

## 📍 CURRENT STATE — updated 7 Oct 2026, after the Supabase push

| Target | Status | What that unblocks |
| --- | --- | --- |
| **Migration 192** (`activated_at`) | ✅ **APPLIED** — all 26 automations backfilled | prerequisite for 3.1 |
| **`process-automations`** | ✅ **DEPLOYED** (v90) | **all of Part 3 and Part 5 are testable now** |
| **`resend-inbound`** | ✅ **DEPLOYED** (v67) | test 3.12 |
| **Web app** | ❌ **NOT DEPLOYED** | Parts 1, 2.1, and full 3.1/3.4 are blocked |
| **Migrations 190 / 191 / 193** | ❌ **NOT APPLIED** — awaiting sign-off | tests 2.1, 2.2, 2.3 blocked |

**So today: start with Part 5, then Part 3.** Parts 1 and 2 need a Vercel deploy
and the remaining migrations.

### One caveat on test 3.1 until the web app ships

`activated_at` is written by the **toggle**, which is web-app code. Until that
deploys, a newly created automation has `activated_at = NULL` and the engine
falls back to `created_at`. Practical effect:

- ✅ **Works now:** move the QA players onto the stage **first**, *then* create
  the automation, *then* activate. (Players arrived before `created_at`.)
- ❌ **Needs the web deploy:** create the automation first, then move players on,
  then activate. Without the toggle stamping `activated_at`, those players
  *would* be enrolled.

Test 3.1 is written in the working order, so run it as written.

---

## ⚠️ READ THIS FIRST — three things deploy separately

A fix only appears once its deploy target is live. Most "it didn't work" reports
on this round will be a missing deploy, not a missing fix.

| Target | What it covers | How it ships |
| --- | --- | --- |
| **WEB** (25 fixes) | every screen, button, form, warning | normal Vercel deploy of the Next.js app |
| **EDGE** (14 fixes) | the automation engine — sending, waiting, stopping, invoicing | `npx supabase functions deploy process-automations` and `... resend-inbound` |
| **MIG** (4 fixes) | repairs to live data + one new column | `node scripts/apply-migration.mjs supabase/migrations/<file>.sql` |

**The EDGE functions do NOT ship with the web app.** Nothing in Part 3 of this
document will change until `process-automations` is redeployed.

### Apply the migrations before testing Part 2 or 3

They are deliberately unapplied and need Ghulam's sign-off, because they edit
live automations and one live user account. **192 is not optional** — the
switch-on fix reads a column it adds.

```bash
node scripts/apply-migration.mjs supabase/migrations/192_automations_activated_at.sql   # REQUIRED
node scripts/apply-migration.mjs supabase/migrations/190_initial_contact_trailing_wait.sql
node scripts/apply-migration.mjs supabase/migrations/191_list_assignment_form_trigger.sql
node scripts/apply-migration.mjs supabase/migrations/193_deactivate_test_staff_account.sql
```

Each prints `applied: <file>`. Screenshot that output — it is the evidence the
migration ran.

### Safety rules — this is the production database

- **Use `+test` inboxes only.** e.g. `hamna+testing@gmail.com`,
  `hamza.shafique12123+30@gmail.com`. Delete the rows afterwards.
- **Never activate an automation on a stage that holds real players.** Build
  every test automation on an empty stage, or on a throwaway pipeline.
- Emails are sent by a cron that runs **every 5 minutes** (`vercel.json`). Wait
  two ticks — ~10 minutes — before calling a send a failure.
- A campaign cannot be recalled. Only ever point one at a QA list.

Local testing: `npm run dev` → **http://localhost:3016**

---

# PART 1 — WEB only. Test these first, they need no deploy beyond the app.

These are fast, visual, and give the cleanest screenshots.

## 1.1 — QA-13 · Won/Lost has no loader and no selected state

**Go to:** `/pipelines` → click any deal card → sheet opens on the **Overview**
tab. The **Won** / **Lost** buttons are in the header, right of "Move to Stage".

| Before | Now |
| --- | --- |
| Clicking **Won** gave no feedback at all. The button stayed identical while the request ran, so you could not tell it had registered — and this route has silently failed before. | The clicked button shows a **spinner and the word "Saving…"** while it saves. |
| Nothing on the card showed which outcome was already set. A won deal looked identical to an open one. | A won deal shows **Won filled solid green**; a lost deal shows **Lost filled solid red**. Open deals show both as plain outlines. |

**Steps**
1. Open a QA deal. Screenshot the Won/Lost buttons — both plain outlines.
2. Click **Won**. Screenshot *immediately* — you should catch the spinner +
   "Saving…".
3. The sheet closes. Reopen the same deal.
4. **Screenshot:** **Won** is now filled green.
5. Repeat on a second QA deal with **Lost** → give a reason → reopen →
   **Lost** is filled red, and the "Lost reason" panel shows your text.

**Also confirm (QA-13's own warning — don't trust the toast):** after marking
won, refresh and check Reports/dashboard won count went up by one.

---

## 1.2 — QA-13 · Delete button and the close X were overlapping and misaligned

**Go to:** `/pipelines` → open any deal → look at the **top-right of the sheet
header** (as an admin, so the bin icon is visible).

| Before | Now |
| --- | --- |
| The bin sat in the header while the sheet's X was absolutely positioned 8px away on a different baseline — two different sizes, touching, with overlapping hit areas. | Bin and X are the **same size, in one row, on one baseline**, with a clear gap. |

**Screenshot:** the header's top-right corner, zoomed in. Compare against the
Jam recording from the original ticket.

Also click the X — it must still close the sheet (it is now our own button, not
the library's).

---

## 1.3 — QA-13 · The email icon was unreadable on hover

**Go to:** `/pipelines` (Kanban view) → hover a deal card → the action icons
appear top-right of the card.

| Before | Now |
| --- | --- |
| The buttons were translucent, sitting directly over the player's name — the name showed **through** the mail/phone/calendar icons, so none read cleanly. | The icon row sits on an **opaque panel with a thin border and shadow**. Icons are fully legible over the name. |
| At rest the buttons were invisible but still clickable — a click at the card's top-right corner could fire "send email" instead of opening the deal. | Invisible = not clickable. Clicking that corner without hovering opens the deal. |

**Screenshot:** a hovered card, zoomed, showing the icons crisp against the
opaque panel.

---

## 1.4 — QA-21 Bug 2 · Interview date saved one day early  ← highest-value visual

**Go to:** `/pipelines` → open a deal → **Overview** tab → **Deal Forecast**
section → **Interview Date**.

| Before | Now |
| --- | --- |
| Picking **8 October** saved and displayed **07/10/2026**. Every pick was a day early (5 Oct→4 Oct, 10 Oct→9 Oct). Hit anyone ahead of UTC — Pakistan always, the UK during summer time. | The date you pick is the date that saves. |

**Steps**
1. Click the Interview Date value → calendar opens.
2. Pick **any date** — note exactly which day you clicked. **Screenshot the
   calendar with your chosen day highlighted.**
3. Popover closes. **Screenshot the saved value** — it must be the *same* day.
4. Refresh the page and screenshot again — still the same day.
5. Repeat for **Programme Start** and **Arrival Date** in the same section.

> This was fixed everywhere a date is picked, so also worth a quick check on
> **Add Deal** (`/pipelines` → New Deal) and the **Reports** date range.

---

## 1.5 — QA-21 Suggestion 2 · Interview date had no time

**Same place as 1.4.**

| Before | Now |
| --- | --- |
| Date only. A reminder set to "3 hours before" counted back from **midnight**, so it fired at 21:00 the night before. Real meeting times could not be entered at all. | The calendar popover has a **"Meeting time"** field (defaults 09:00). The saved value now shows **date and time**. |

**Steps**
1. Open the Interview Date popover. **Screenshot** — the "Meeting time" input is
   below the calendar.
2. Set the time to **14:30 first**, *then* click a day (picking a day saves
   immediately).
3. **Screenshot:** the row now reads e.g. `15 Jan 2026, 14:30`.

---

## 1.6 — QA-21 Bug 1 · Calendly said "Connected" when bookings were not syncing

**Go to:** `/settings` → **Calendly** tab.

| Before | Now |
| --- | --- |
| A green **"Connected"** badge appeared as soon as *any* Calendly link was saved on the profile — even for an account never linked to Calendly. No booking has ever reached the CRM, and the only thing on screen said everything was fine. | Three honest states. |

Which you see depends on the account:

| Account state | Badge | Panel |
| --- | --- | --- |
| Nothing set up | grey **Not connected** | setup instructions |
| Booking link on profile, never connected | amber **Booking link only** | "A booking link is saved, but your account is not connected" |
| Token stored, no webhook (free Calendly plan) | amber **Bookings not syncing** | amber panel explaining bookings won't appear on the deal and reminders have no meeting time |
| Token + webhook registered | green **Connected** | green panel: "Meetings booked through your link appear on the player's deal" |

**Screenshot:** the badge and the panel for whichever state your account is in.
Oli Kendrick / the `test` user are good examples of the "no link" case.

---

## 1.7 — QA-21 Suggestion 1 · A waiting player showed no reason why

**Go to:** `/pipelines` → open a deal that is enrolled in a Meeting Scheduler
automation with no interview date → **Overview** tab → **Automations** section.

| Before | Now |
| --- | --- |
| Just a green **Active** badge and nothing else. A player parked forever waiting on a meeting date nobody would ever set looked identical to one mid-sequence. | An **amber line** under the name: *"Waiting for an interview date on this deal. Set one below, or have the player book through Calendly — until then no reminder can be scheduled."* |

**Screenshot:** the automation row with the amber explanation.

> Hamza QA (`+23`) was left in exactly this state in the original testing, if
> that record still exists.

---

## 1.8 — QA-19.1 · Nothing warned when two automations shared a stage

**Go to:** `/automations` → **Create Automation** → pick **Initial Contact
(3-Email Sequence)** → choose a pipeline → open the **trigger stage** dropdown
and pick a stage that an existing live automation already uses (e.g. Initial
Lead on University 2027).

| Before | Now |
| --- | --- |
| Silence. Initial Contact says it triggers on "enters stage" and Follow Up on "stage change", which reads as two different things — but the engine treats them identically. Point both at one stage and a player gets **three emails from each**. Nothing told you the other one was there. | An **amber warning** under the dropdown naming the clash: *"UNIVERSITY OF LANCASHIRE - INITIAL CONTACT MAP already runs on this stage. A player landing here will be enrolled in both and receive both sets of emails."* |

**Screenshot:** the dropdown with the amber warning beneath it.

**Do not save or activate this automation.** Cancel out.

---

## 1.9 — QA-18f / QA-19.3 · A reply stopped the emails but didn't move the deal

**Go to:** `/automations` → **Create Automation** → **Initial Contact** or
**Follow Up** → pick a pipeline → scroll to **Exit Goals** → **Goal 1 — Contact
replies**.

| Before | Now |
| --- | --- |
| "Move deal to" defaulted to **"Don't move the deal"**. Two of the three live Follow Up automations were saved that way — a player replied, emails stopped, the card never moved, and the recruiter never knew. | "Move deal to" is **pre-filled with Contact Response**. |
| No warning if you left it unset. | Set it back to "Don't move the deal" and an **amber warning** appears: *"A reply will stop the emails but leave the card where it is, so nothing on the board shows that the player wrote back."* |

**Steps**
1. **Screenshot:** Goal 1 showing **Contact Response** pre-selected.
2. Change it to **"Don't move the deal"**. **Screenshot** the amber warning.
3. Cancel out.

**Also confirm the safety behaviour:** open an **existing** live automation for
editing. Its Goal 1 must show **whatever it was already set to** — editing must
never silently re-point a live sequence. Screenshot one that was previously
unset still reading "Don't move the deal".

---

## 1.10 — QA-19.2 / QA-19.3 · "Predictive" label and the false stage claim

**Go to:** `/automations` → **Create Automation** → find **Follow Up (3-Email
Sequence)** on the template picker.

| Before | Now |
| --- | --- |
| Description: *"…then update the stage"* — it does not. There is no stage step; the deal only moves if an exit stage is set. | *"Send 3 follow-up emails when a deal moves to the Follow Up stage. Set an exit stage under Exit Goals if you want the deal to move when the player replies."* |
| Workflow step 3 read **"Send Follow Up Email 3 (Predictive)"**. Nothing in the system read that setting; it sent exactly like emails 1 and 2. | Reads **"Send Follow Up Email 3"**. The unused setting is gone. |

**Screenshot:** the template card description, and the workflow steps list
showing step 3 with no "(Predictive)".

---

## 1.11 — QA-21 Suggestion 3 · No warning that Meeting Scheduler needs Calendly

**Go to:** `/automations` → **Create Automation** → **Meeting Scheduler** →
select a pipeline → the **Meeting Flow** section.

| Before | Now |
| --- | --- |
| You could configure the whole thing without being told the reminders need an interview date to exist. | An **amber notice at the top of Meeting Flow**: *"The reminders need a meeting date to exist… Until there is a date, the booking email goes out and the player simply waits; no reminder is sent."* |

**Screenshot:** the Meeting Flow section with the notice.

---

## 1.12 — QA-08 · Send Invoice used a re-typed custom amount, not the deposit

**Go to:** `/automations` → **Create Automation** → **Invoice Generation &
Reminders** → **Invoice Settings** → **Amount Source**.

| Before | Now |
| --- | --- |
| Options were Full deal value / Percentage / **Fixed custom amount**. Abubakr's point: the deposit should come from the deposit, not a number re-typed per automation. The Residency deposit moved £1,000 → £2,000 on the website and any hand-typed amount would still be billing £1,000. | A new first option, selected by default: **"Programme deposit (recommended)"**, with the note *"Uses the deposit published for this programme under Website → Pricing — the same amount a player pays on the website."* |

**Screenshot:** the Amount Source dropdown open, showing all four options with
"Programme deposit (recommended)" at the top.

**Cross-check the figure:** `/website-content` → Pricing → Summer Residency
deposit should read **£2,000**. That is the number an invoice will now use.
(Engine side is tested in **3.6**.)

---

## 1.13 — QA-20 Bug 1 · The parent got a copy of the player's email

**Go to:** `/automations` → **Create Automation** → **Application Received** →
pick a pipeline → scroll to **Notifications** → tick **"Also send notification
to parent/guardian"**.

| Before | Now |
| --- | --- |
| The parent received the **player's email byte for byte**, with `[Parent Copy]` glued on the subject. Body still opened "Hello Hamza". `+21parent@` got *"[Parent Copy] Macclesfield FC X University of Lancashire 2027"* starting "Hello Hamza". | Ticking the box reveals a **"Parent's email template"** picker, with the hint: *"Use `{{parent_name}}` to greet the parent and `{{player_name}}` for their child."* |

**Screenshot:** the Notifications section with the box ticked and the parent
template picker visible.

Also note the clarified text underneath: *"Parents whose email is the same as
the player's are skipped, so nobody gets the message twice."* (That dedupe was
already fixed — see 1.14 for the matching form change.)

---

## 1.14 — QA-20 Bug 3 · Edit form rejected the shared parent email the import allows

**Go to:** `/contacts` → open **any of the 2,253 contacts tagged "Parent
Email"** (filter by that tag) → **Edit** → look at **Parent Email**.

| Before | Now |
| --- | --- |
| Red error *"Parent email must be different from the player email"* and **Save was dead**. So you could not edit any of those 2,253 contacts at all — change a phone number and Save stayed disabled over a field you never touched. The CSV import accepts the same value deliberately. | A **grey informational note**: *"Same as the player email. That is fine — they share an inbox, and parent notifications will not be sent twice."* **Save works.** |

**Steps**
1. Filter contacts by the **Parent Email** tag. Open one. Click Edit.
2. **Screenshot:** the Parent Email field with the grey note, and the **Save
   button enabled**.
3. Change the phone number, save, refresh — the change stuck.
4. Confirm a genuinely malformed parent email (`abc`) *still* shows a red error
   and blocks save. **Screenshot** that too — the format check is still there.

---

## 1.15 — QA-20 Suggestion 2 · No way to put the programme in an email

**Go to:** `/templates` → open or create a template → the merge-tag picker.

| Before | Now |
| --- | --- |
| Only name, contact details, graduation year, position, parent details and owner details were available. An Application Received confirmation could not say what the application was *for*. | New tags under **Deal**: `{{programme}}`. Under **Contact**: `{{parent_name}}`, `{{player_name}}`, `{{player_first_name}}`. |

**Screenshot:** the merge-tag list showing `{{programme}}`.

**Confirm it resolves:** put `{{programme}}` in a template, use **Send test** →
the test email should read **UK GAP 2026** (the sample value), not a raw
`{{programme}}`. In a real send it resolves to the deal's pipeline name.

---

## 1.16 — QA-18c · The switch-on/off message

**Go to:** `/automations` → toggle any automation off, then on.

| Before | Now |
| --- | --- |
| No message either way. You had no idea that switching on had just emailed everyone standing in the stage. | **On:** *"'<name>' is live — Players who enter the trigger stage from now on will be enrolled. Nobody already sitting in that stage is emailed."* **Off:** *"No further emails will be sent from it, including to players already part-way through. They resume where they left off if you switch it back on."* |

**Screenshot:** both toasts.

> The *behaviour* behind both messages is Part 3 (**3.1** and **3.2**) and needs
> the EDGE deploy. The toast appearing is not proof the behaviour changed.

---

## 1.17 — QA-40 · Campaign stats stopped at 1,000

**Go to:** `/campaigns` → open a campaign that was sent to **more than 1,000
people** → **Stats** and **Recipients** tabs.

| Before | Now |
| --- | --- |
| A send to the 105k "ALL CONTACTS EVERYONE" list showed **"Total 1,000"**, 1,000 delivered, and 1,000 rows of history — sitting next to a composer that correctly said 105,285. The *send* was always fine; only the reporting was short. | Total matches the real number sent. The recipients table lists them all. |

**Steps**
1. Note the audience count the composer reported for that campaign.
2. **Screenshot** the Stats tab total next to it — they should agree.
3. Scroll the Recipients list past row 1,000. **Screenshot** a row number above
   1,000.

> If no campaign over 1,000 exists yet, this is the one Part 1 item you cannot
> prove today. Note it as "not reproducible yet" rather than passed — same
> judgement QA-61 applied to the pipeline board.

---

# PART 2 — needs a migration applied

## 2.1 — QA-17 · List Assignment never ran at all

**Requires:** migration **191**.

**Go to:** `/automations` → find the List Assignment automation QA built against
the Gap Year form.

| Before | Now |
| --- | --- |
| It was saved with trigger **"deal enters stage"** — but this template has no pipeline and no stage by design, so it had nothing to trigger on and **never ran once**. A contact submitted the form and was added to neither chosen list. | Trigger reads **form submission**. |

**Steps**
1. Apply 191. Screenshot the `applied:` output.
2. Open the automation. **Screenshot:** the trigger now reads form submission.
3. Build a **new** List Assignment automation (`QA — List Assignment`), point it
   at the Gap Year form, pick two lists including a fresh `QA Test List`,
   activate.
4. Submit the Gap Year form as `hamza.shafique12123+30@gmail.com`.
5. Within ~5 minutes: `/contacts` → open that contact → **Lists**.
   **Screenshot:** they are on **both** chosen lists.
6. **Screenshot:** `/pipelines` — **no deal** was created for them. That is the
   whole point of the template.
7. Delete the test contact and the automation afterwards.

---

## 2.2 — QA-18a · Live Initial Contact maps had no wait before Dormant

**Requires:** migration **190**. Also see **3.3** for new automations.

**Go to:** `/automations` → open any of the three live INITIAL CONTACT MAPs →
the workflow steps.

| Before | Now |
| --- | --- |
| Steps ended at **email 3**, then straight to Dormant. The builder showed waits of 3, 5 and 7 days but only the first two were ever compiled — so the enrollment completed on the same cron tick that sent email 3, and the player was filed Dormant **seconds** after being asked if they were still interested. | A **7-day wait appears between email 3 and the Dormant move**. |

**Steps**
1. Screenshot the workflow steps **before** applying 190.
2. Apply 190. Screenshot the `applied:` output.
3. Reload the automation. **Screenshot the steps again** — a wait now sits after
   email 3.
4. **Confirm nothing in flight broke:** `/pipelines` → spot-check two players
   currently mid-sequence in that automation. Their Automations section should
   still show **Active** with a sensible "Next:" time. Screenshot one.

---

## 2.3 — QA-20 other finding · The `test` user was in the round robin

**Requires:** migration **193**.

| Before | Now |
| --- | --- |
| `test@macclesfieldfc.com` was an active staff account, so the round robin assigned it real leads. Hamza QA 3's emails went out from **"test <test@macclesfieldfc.com>"** to a real inbox. It has no Calendly link either. | The account is deactivated, so it is skipped when owners are assigned. |

**Steps**
1. Apply 193. Screenshot the output.
2. `/users` → **Screenshot:** the `test` user shows as **Inactive**.
3. Submit **four** QA form entries (`+31` … `+34`). Check each resulting deal's
   owner. **Screenshot the four owners** — they should rotate between real
   recruiters and **none** should be `test`.
4. Delete the four test contacts.

> Deals `test` already owns are deliberately left alone — reassigning a real
> player is a human decision. Expect to see some; that is not a failure.

---

# PART 3 — needs `process-automations` redeployed, plus a cron tick

Deploy first:

```bash
npx supabase functions deploy process-automations
npx supabase functions deploy resend-inbound
```

Then allow **5–10 minutes** per step for the cron.

Build every test here as a **new automation on an empty stage** with test
templates and the **minimum waits allowed**, using `+test` inboxes.

## 3.1 — QA-18c / QA-19.4 · Switching on emailed the whole stage  ← the riskiest fix

**Requires:** EDGE deploy **and** migration 192.

| Before | Now |
| --- | --- |
| Switching an automation on enrolled **every player already sitting in the trigger stage** and emailed them within ~5 minutes. On a busy Initial Lead that is hundreds of real people getting a cold "are you still interested?" at once, with no warning and nothing to recall. | Only players who **enter the stage after** you switch it on are enrolled. |

**Steps**
1. Pick a pipeline stage that already holds **2–3 QA players** (move them there
   first). Note exactly who.
2. Create `QA — Switch On Test` (Initial Contact) on that stage, test templates,
   minimum waits. **Do not activate yet.** Screenshot the stage with its
   players.
3. Switch it **on**. Note the time.
4. Wait **10 minutes** (two cron ticks).
5. **Screenshot:** `/automations` → open the automation → Enrollments is
   **empty**. Nobody already standing there was enrolled.
6. **Screenshot:** the QA inboxes — **no email arrived**.
7. Now move a **fresh** QA player onto the stage. Wait 5 minutes.
8. **Screenshot:** that player **is** enrolled and **did** get email 1. The
   automation works; it just doesn't back-fill.

---

## 3.2 — QA-21 Bug 7 · Switching off didn't stop players already enrolled

**Requires:** EDGE deploy.

| Before | Now |
| --- | --- |
| Switching off only stopped **new** players joining. Everyone already enrolled kept walking through the steps and kept receiving emails — QA switched "QA Meeting Scheduler" off and a player still had a reminder scheduled. It only stopped when the card was moved. This affected **every** template. | Switching off stops all sending. Enrolled players pause and resume from where they left off if you switch it back on. |

**Steps**
1. Using the automation from 3.1, confirm a QA player is enrolled with a
   "Next:" time in the next few minutes. Screenshot it.
2. Switch the automation **off**.
3. Wait past the time that next email was due. **Screenshot the inbox —
   nothing new arrived.**
4. Switch it back **on**. Within ~5 minutes the player continues from the same
   step. Screenshot the email arriving.

---

## 3.3 — QA-18a · New Initial Contact automations skip the wait

**Requires:** EDGE deploy. (**2.2** covers the existing live ones.)

**Go to:** `/automations` → create a new Initial Contact automation.

| Before | Now |
| --- | --- |
| The builder showed a 7-day wait after email 3 and it was never compiled. | The configured wait is really applied: after email 3 the player stays in the trigger stage for the full wait, and only then moves to the no-reply stage. |

**Steps**
1. Create `QA — Trailing Wait` on an empty stage, three test emails, every wait
   at the **minimum**, no-reply stage = Dormant. Activate.
2. Move one QA player on. Let all three emails arrive without replying.
3. **Screenshot immediately after email 3:** the player is **still in the
   trigger stage**, not Dormant. *That is the fix* — before, they were Dormant
   within seconds.
4. After the final wait elapses, screenshot them arriving in Dormant.

---

## 3.4 — QA-18e / QA-19.6 · Emails went out in the order templates were picked

**Requires:** EDGE deploy (and re-saving the automation, which recompiles it).

| Before | Now |
| --- | --- |
| Emails were sent in the order you **clicked** the template pickers, not by slot. Pick email 2's template before email 1's and the player received them in that order. | Always slot order: email 1, then 2, then 3. |

**Steps**
1. Create `QA — Order Test` on an empty stage. Deliberately pick the **email 2**
   template **first**, then email 1, then email 3 — use three visibly different
   templates. Screenshot the builder showing which template is in which slot.
2. Minimum waits. Activate. Move one QA player on.
3. **Screenshot the inbox** as all three arrive — the order must match the slots
   in your step-1 screenshot.

> Quicker alternative if you'd rather not wait for three sends: re-save any
> existing automation and check its compiled steps in **Automations → the
> automation → workflow preview** read in slot order.

---

## 3.5 — QA-18b / QA-19.5 · A player who paid kept getting chased

**Requires:** EDGE deploy.

| Before | Now |
| --- | --- |
| Paying a deposit moved the deal to Deposit Paid but **did not** take the player out of the Initial Contact sequence. They kept getting sales emails, and after email 3 were moved from Deposit Paid **back to Dormant**, where 21-day reminders started. `hamza.shafique12123+test@gmail.com` paid on 6 Oct and was still in the sequence with the next email due the 9th. | Any paid invoice on the deal ends the Initial Contact / Follow Up sequence on the next tick, whatever route the payment arrived by. |

**Steps**
1. Submit a Gap Year application as a new `+test` address. Confirm the player
   lands in Initial Lead and is enrolled. Screenshot the enrollment.
2. Pay the deposit on the website with Stripe test card
   **4242 4242 4242 4242** — in a **private window**.
3. Wait ~5 minutes.
4. **Screenshot:** the deal is in **Deposit Paid**, and its Automations section
   shows the sequence **Stopped** with reason *"payment received — sales
   sequence ended"* (or *"Payment received"* if the Stripe webhook got there
   first — either is correct).
5. **Screenshot:** nothing further arrives in the inbox over the next day.
6. Confirm the deal is **still in Deposit Paid** and has not drifted to Dormant.

---

## 3.6 — QA-23 · Re-entering Send Invoice raised a second real invoice  ← was Critical

**Requires:** EDGE deploy.

| Before | Now |
| --- | --- |
| Moving a card out of Send Invoice and back in **reset the automation and created a second real invoice** — its own number, its own Stripe session, its own payment email to the customer. Nothing deduplicated. | The second attempt is skipped. |

**Steps**
1. On a pipeline with invoicing (Summer Residency 2027 or UK GAP 2027), move a
   QA player to **Send Invoice**. Wait for the invoice.
2. `/invoices` → **screenshot: one invoice** for that player. Note its number.
3. Move the card **out** of Send Invoice, then **back in**. Wait 5 minutes.
4. **Screenshot `/invoices`: still exactly one invoice**, same number. Before
   the fix there would be two.
5. **Also verify the amount** (this is QA-08's engine half): it should equal the
   programme deposit from Website → Pricing — **£2,000** for Summer Residency —
   not a hand-typed figure.
6. Cancel the invoice, then move the card out and in again. A **new** invoice
   should now be raised — cancelling is the deliberate way to re-raise.
   Screenshot that too.

---

## 3.7 — QA-21 Bug 3 · Booking emails went out with a dead link

**Requires:** EDGE deploy.

| Before | Now |
| --- | --- |
| Hamza QA was assigned to Oli Kendrick, who has no Calendly link, so the booking email went out with an **empty link** — an invitation with a dead button. | The email is **not sent**. The run history logs *"Not sent: this email contains a booking link but <name> has no Calendly link saved…"* and the recruiter gets an in-app notification. |

**Steps**
1. Create a Meeting Scheduler automation on an empty stage, booking email =
   a template containing `{{deal_owner_calendly}}`.
2. Assign a QA deal to a recruiter with **no** Calendly link. Move it onto the
   stage. Wait 5 minutes.
3. **Screenshot:** the QA inbox — **no booking email**.
4. **Screenshot:** `/automations` → **History** tab → the row showing
   **Skipped** with the readable reason.
5. **Screenshot:** that recruiter's notification bell — *"Booking email not
   sent — no Calendly link"*.
6. Now give that recruiter a Calendly link and repeat — the email sends, with a
   working button. Screenshot.

---

## 3.8 — QA-21 Bug 5 · Changing a meeting date didn't move the reminder

**Requires:** EDGE deploy.

| Before | Now |
| --- | --- |
| Hamza QA 4's date moved 7 Oct → 9 Oct and the reminder **stayed scheduled for the old time**. The player would have been reminded two days early and got nothing on the day. | Changing the date reschedules the reminder on the next tick. |

**Steps**
1. Enrol a QA player in a Meeting Scheduler automation with one reminder set a
   few hours before.
2. Set an interview date/time a few days out. Wait 5 minutes.
3. **Screenshot** the deal's Automations section — note the **"Next:"** time.
4. Change the interview date to **two days later**. Wait 5 minutes.
5. **Screenshot** the same row — the "Next:" time has **moved by two days**.
   Before, it stayed put.

---

## 3.9 — QA-21 Bug 6 · The sequence never finished

**Requires:** EDGE deploy.

| Before | Now |
| --- | --- |
| After the reminder, the automation waited for the booked Calendly meeting to end. Because **no Calendly booking has ever reached the CRM**, that never happened and **every** player stayed "active" forever. Hamza QA 3 was stuck like this. | The sequence falls back to the end of the day on the deal's interview date, so it completes. |

**Steps**
1. Take a QA player through a Meeting Scheduler automation with an interview
   date **set by hand** (no Calendly booking) a day or two out.
2. Once that date has passed, wait for a tick.
3. **Screenshot:** the Automations section shows **Completed**, not Active.
4. If Hamza QA 3 still exists, screenshot it coming unstuck too.

---

## 3.10 — QA-21 Bug 4 · A past meeting date fired the reminder immediately

**Requires:** EDGE deploy. *This was already fixed before this round — verifying
it still holds, plus a counter fix.*

**Steps**
1. Enrol a QA player, set the interview date to **yesterday**. Wait 5 minutes.
2. **Screenshot:** no reminder email arrived, and the enrollment reads
   **Stopped — "Meeting date had already passed — reminder not sent"**.

---

## 3.11 — QA-20 Bug 1 · The parent's email (engine half)

**Requires:** EDGE deploy. Pairs with **1.13**.

**Steps**
1. Create an Application Received automation on an empty stage. Tick notify
   parent. **Leave the parent template blank** for this first pass.
2. Move a QA player with a **different** parent email onto the stage.
3. **Screenshot both inboxes.** The parent's subject should now read
   **"<Player Name>: <subject>"** — not `[Parent Copy] …` — and the greeting
   should address the parent, not the player.
4. Now set a dedicated **parent template** using `{{parent_name}}` and
   `{{player_name}}`. Repeat with another QA player.
5. **Screenshot:** the parent receives that template, correctly addressed.
6. **Regression check (already-fixed Bug 2):** a player whose parent email **is**
   their own address receives **exactly one** email. Screenshot the single
   message — `+22@` previously got two at the same second.

---

## 3.12 — QA-30 · A renamed Contact Response stage never received the move

**Requires:** `resend-inbound` deploy. **Do this on a throwaway pipeline, not a
live one** — it involves renaming a stage.

| Before | Now |
| --- | --- |
| The reply handler matched the stage on the literal string `Contact Response`. Rename it — or leave a trailing space — and a reply **silently never moved the deal**. The intent was written, the card stayed put, nothing logged. | Falls back to the stage's *type*, which a rename does not change. |

**Steps**
1. On a test pipeline, rename the Contact Response stage to **"Responded"**.
2. Enrol a QA player, let email 1 arrive, **reply to it**.
3. Wait a few minutes.
4. **Screenshot:** the deal has moved to **"Responded"**. Before, it would have
   stayed in Initial Lead with no explanation.
5. Rename the stage back.

---

# PART 4 — what you cannot screenshot, and what to do instead

Be straight about these in the Notion tickets rather than marking them passed.

## 4.1 — QA-18d / QA-19.7 · The mid-step race

*"If a recruiter moves a card, or the player replies, at the exact moment the
last email is being sent, the card can still end up in Dormant."*

**You cannot reliably trigger this by hand.** It needs a move to land inside the
few hundred milliseconds while an email is being handed to Resend.

What changed: every write that advances or completes an enrollment is now
conditional on it still being active, so a stop that lands mid-step can no
longer be overwritten by `completed` — which was the write that sent the card to
Dormant.

**Best available evidence:** after a week of normal use, run this and confirm it
returns nothing.

```sql
-- Deals sitting in a no-reply stage whose enrollment was stopped by a
-- recruiter move or a reply. Should be empty.
select d.id, a.name, e.stopped_reason, e.status
from automation_enrollments e
join deals d on d.id = e.deal_id
join automations a on a.id = e.automation_id
where e.status = 'completed'
  and e.stopped_reason is not null
order by e.completed_at desc
limit 50;
```

Mark the ticket **"fix applied, not reproducible by hand"**.

## 4.2 — QA-16 · The old year group

This one *is* observable, but needs a form submission rather than a screen:

1. Submit the Gap Year form as a new `+test` address with graduation year
   **2026**. Screenshot the contact's Lists and Tags — `2026 MENS`, tag `2026`.
2. Submit **again, same email**, year **2027**.
3. **Screenshot:** they are now in `2027 MENS` with tag `2027`, and **`2026 MENS`
   and tag `2026` are gone**. Before, they stayed in both — so campaigns for the
   old year still emailed them.

## 4.3 — QA-61 · The 1,000-deal pipeline cap

Already fixed before this round (paged board + count queries). Not reproducible
until a pipeline passes 1,000 deals — 583 today. Treat it as **"fix applied,
fuse not yet live"**, the same framing the ticket itself uses.

## 4.4 — Items that are PM decisions, not bugs

Do not test these; they need Ghulam's answer:

- **QA-18g** — Dormant reminders are now every **14 days**, but the **first**
  one still fires immediately on entering Dormant. Which is wanted?
- **QA-20 Suggestion 1** — re-entering Application re-sends the confirmation.
  The "Move deal backwards?" dialog does warn, so this is working as built.

---

# PART 5 — engine health check (do this first, it takes 2 minutes)

Two **pre-existing** production bugs were found while deploying — neither was
part of the Notion round, and neither was anyone's fault: nothing had ever read
this function's error output. Both are now fixed. This is how you confirm they
stay fixed, and it doubles as the fastest proof the deploy is healthy.

## 5.1 — The automation engine reports no errors

**Where:** Supabase Dashboard → **Edge Functions** → `process-automations` →
**Logs**. Or invoke it directly and read the JSON response.

| Before | Now |
| --- | --- |
| Every run returned an `errors` array containing **`Failed to fetch deals for exit check: ... http2 error: stream error detected`**. `checkExitConditions` collected all 452 active enrollment ids into a `.in('id', …)` filter, building an ~18KB URL that died before reaching Postgres. **Every run, silently.** | `"errors": []` |
| Some runs also carried **`duplicate key value violates unique constraint "automation_enrollments_automation_id_deal_id_key"`** — one conflicting row failed the whole batch insert, silently un-enrolling every other deal in it. | gone |

**Steps**
1. Open the most recent `process-automations` invocation log.
2. **Screenshot:** the response body showing `"errors": []`.
3. Check two or three consecutive runs — all should be clean.

A healthy run looks like:

```json
{ "success": true, "summary": {
    "enrollmentsCreated": 0, "stepsProcessed": 0, "emailsQueued": 0,
    "stagesMoved": 0, "enrollmentsCompleted": 0,
    "enrollmentsStopped": 0, "enrollmentsStoppedByReply": 0,
    "errors": [] } }
```

Non-zero numbers are fine and normal — they mean work happened. **Only a
non-empty `errors` array is a failure.**

## 5.2 — Exit-stage stopping actually works again

`checkExitConditions` stops an enrollment when its deal reaches one of the
automation's stop stages. It had been dead for a while — long enough that the
count of such stops was frozen.

**Evidence:** run this read-only query now, and again in a few days.

```sql
select count(*) as stopped_by_exit_check,
       max(updated_at) as most_recent
from automation_enrollments
where stopped_reason = 'Deal moved to exit stage';
```

- At the moment of the fix this read **53** (it had been stuck at 52; the fix
  stopped one on its very first clean run).
- **Expected:** the number **grows** over the coming days as deals reach stop
  stages. If it is still 53 in a week with normal pipeline activity, reopen.

> This path is a safety net — the board also stops sequences client-side when
> you drag a card — so you will not always see it fire on demand. The count
> over time is the honest measure, not a single hand-run test.

---

# Clean-up checklist

After testing, delete:

- [ ] every `+test` / `+30`–`+34` contact created
- [ ] every `QA — …` automation created here
- [ ] the `QA Test List`
- [ ] any test invoices raised (cancel, don't delete, so numbering stays intact)
- [ ] the throwaway pipeline from 3.12, and any renamed stage put back

Then confirm: `/pipelines` deal counts and `/contacts` total match what they
were before you started.

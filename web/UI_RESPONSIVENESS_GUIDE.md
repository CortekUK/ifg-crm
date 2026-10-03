# IFG Website — UI & Responsiveness Guide

This guide sets out the rules for UI and responsiveness on the public website (`web/`).
Every rule comes from a problem that was found and fixed on the live site. Use it as a checklist
when building a new section, and as an audit guide when reviewing an existing page.

The test for every rule: **a client opening the page on a phone, an iPad or a desktop should
never think "that looks broken".**

---

## 1. Test matrix

Check every page at these widths, in **both dark and light theme**:

| Device | Width | What usually breaks here |
|---|---|---|
| Small phone | 360–390px | Overlapping cards, ragged button stacks, fixed widths overflowing |
| Large phone | 430px | Same as above |
| iPad portrait | 768–820px | Two-column rows too narrow, content stuck to the left with empty space on the right |
| iPad landscape / small laptop | 1024px | Two-column rows with a short photo floating in a tall column of text |
| Desktop | 1280–1440px | Hover behaviour, alignment |

Site breakpoints in use: `≤560`, `≤640` (phone), `≤760`, `≤900`, `≤1024` (tablet), `≤1200` (header burger).
Use `≤640` for phone rules and `≤1024` for tablet rules unless an existing rule already covers the case.

---

## 2. Hover behaviour

### 2.1 Buttons never move on hover
Buttons stay where they are. Hover may change **colour, background, border or shadow only**.

Never use these on a button's `:hover`:
- `transform: translateY(...)`, which makes the button lift
- `transform: scale(...)`, which makes it grow
- `transform: rotate(...)`, which makes it spin
- JavaScript "magnetic" effects that pull the button towards the cursor

This covers anything clickable that looks like a button: CTAs, play buttons, carousel arrows,
close (✕) buttons, social icons, announcement pills and the chat launcher.

Allowed: the small press-in on click (`.btn:active{transform:scale(.97)}`) and a small arrow
icon nudging *inside* a link.

*Fixed:* the magnetic `.btn-lg` effect in `motion.tsx`, and the hover movement on `.play-badge`, `.yt-play`, `.caro-arw`,
`.lbox-close`, `.soc-ic`, `.ubar-ann`, `.aw-launcher` and `.ss-share-btn`.

### 2.2 Every interactive control gets visible hover feedback
Tabs, segmented controls, pills and buttons must show a visible change on hover. A colour
change on its own is often too subtle, so add a background tint as well.
- Use a tint that works in both themes: `background: rgba(190,22,35,.08)` (IFG red at 8%).
- Don't let the hover style override the selected state. The `.on` / `.active` rule must come
  *after* the hover rule.

*Fixed:* the itinerary block tabs (`.sr-seg-b:hover`).

### 2.3 Cards may lift on hover. Pricing cards must.
A small lift (`translateY(-5px … -6px)`) plus a deeper shadow is the intended hover for cards.
It is part of the design. Keep it on pricing cards (`.sr-price`, `.uni-cost`, `.gy-cost`).

---

## 3. Motion on load and scroll

### 3.1 Cards never slide or fade in on load or scroll
Card grids (programme, news, gallery, staff, teams, videos, pricing, success stories) must already
be in place when the page loads or the user scrolls to them.

Why: the reveal starts on the *grid's* top edge. On a phone only the first card is on screen, so
one card slides up on its own. When the user lands on an anchor (`#plans`), the cards jump into
place in front of them. Both look broken.

- Do not put `data-anim="stagger"` or `data-anim="up"` on a card grid or on individual cards.
- Never combine a GSAP transform animation with a CSS `transition: transform` on the same element.
  The two fight each other and the movement stutters.

Headings and paragraphs may still use the gentle `data-anim="up"` fade.

**Exception, approved by the client:** the summer residency feature cards (`.sr-feats`, 01–04) keep a
rise-in using the opt-in `data-anim="cards"`. It is built to avoid both problems above: when the grid
is stacked (phones), each card gets its own trigger, and CSS transitions are paused while it runs.
Only add `data-anim="cards"` to another grid when it is specifically requested.

*Fixed:* the `stagger` reveal was removed from `motion.tsx` and from all 13 card grids, and from `.ss-card`.

### 3.2 No decorative scroll indicators
No "SCROLL" cues and no bouncing down-arrows under heroes. They float at random positions at
different widths and add nothing.

*Fixed:* `.scroll-cue` in the home hero, and `.c-hero-cue` on 7 page heroes.

---

## 4. Theme safety (light and dark)

### 4.1 No hardcoded colours in hover states of theme-aware components
If a component takes its colours from theme tokens (`var(--fg)`, `var(--bg)`, `var(--bg-elevated)`),
its hover state must too. A hardcoded `#fff` hover on a button whose text is `var(--bg)` makes the
label invisible in light mode.

- Check every `:hover` that sets `#fff`, `white` or `rgba(255,255,255,…)`.
- Leave it alone only when the section is **always dark** in both themes (`.hero`, `.pd-hero`, `.cta-band`, toasts).
- Otherwise add a light-theme override: `[data-theme="light"] .x:hover{…}`.

*Fixed:* `.btn-solid:hover` (light theme now uses `var(--ink-700)`).

### 4.2 Pale accent colours are for dark backgrounds only
`--pitch-300` (pale pink) is readable on near-black but not on bone or white. In light theme, use
`--pitch-600` for hover text.

*Fixed:* `.btn-ghost:hover` and `.ei-terms a:hover`.

### 4.3 One border, not two
Never draw a border *and* a `box-shadow: 0 0 0 1px …` ring in the same colour. On rounded corners,
especially in light theme, they read as a double line. Use the border alone; the glow shadow is fine.

*Fixed:* `.sr-price.feat` and `.gy-cost.feat`.

---

## 5. Layout and spacing

### 5.1 Grid rows must never use fixed heights when items can differ in size
`grid-auto-rows: 238px` combined with one card set to `height: 300px` makes that card spill over the
next one. A long headline does the same.
- Use `grid-auto-rows: auto` and give cards `min-height`, not `height`.

*Fixed:* `.news-grid` on phones and tablets.

### 5.2 Text + photo rows stack on tablet, not just on phone
Two-column editorial rows (copy on one side, photo or carousel on the other) are too narrow on an iPad.
The result is a short photo floating in a tall column of text, with large empty gaps.
- Use the shared `split` class (`className="grid-2 split"`). It stacks at `≤1024` into one centred
  column (`max-width: 760px`) and switches the media to a 16:10 shape.
- Don't use inline `style={{ gap: 64, alignItems: "center" }}` for these rows. Inline styles can't respond to breakpoints.

*Fixed:* 11 rows across home, Macclesfield, summer residency, university, gap year and squad.

### 5.3 Centre hero content on tablet
Between 641 and 1024px the home hero's eyebrow, title, subtitle and CTAs are centred. Left-aligned
content on a narrow tablet leaves a large empty area on the right.

### 5.4 Don't stack section padding
A small block (a video, a single image) placed in its own `.section` between two other sections
gets three bands of padding. On phones that is about 110px of empty space on each side.
- Give it a modifier (for example `sec-video`) that reduces its own padding on phones, or put it inside a neighbouring section.

*Fixed:* the summer residency video.

### 5.5 Inline sizes don't respond
Inline `style={{ gap: 64 }}`, `fontSize: 18` and fixed `width`/`height` stay the same at every width. Move any
layout value that needs to change at a breakpoint into a CSS class.

### 5.6 Position floating elements against the right container
Absolutely positioned decorations must be anchored to the section they belong to, not dropped into a
flex row with `margin-left: auto`. In a flex row they drift to wherever the row wraps.

---

## 6. Buttons and CTA rows on small screens

### 6.1 Rows of 2+ buttons become equal, full-width buttons on phones
Several buttons of different widths stacked to the left look ragged. Use the shared `cta-row` class:
- desktop: buttons sit in a wrapping row
- `≤640`: they stack as full-width buttons with centred labels

### 6.2 A single button on its own line is centred on phones
For example, "Book a call" next to a section heading: on phones the heading stacks and the button is centred under it.

*Fixed:* `.sr-fac-head > .btn`.

### 6.3 The primary CTA (Apply) must always be reachable
The mobile header drawer must still show **Apply Now**. Per `CLAUDE.md`, it is the primary CTA,
and the header buttons are hidden below 1200px.

---

## 7. Audit checklist (per page, per width, per theme)

- [ ] Nothing scrolls or is clipped horizontally (`overflow-x: clip` on `<body>` hides overflow, so check element edges, not the scrollbar)
- [ ] No elements overlap each other
- [ ] No button moves on hover; every control shows a hover state
- [ ] Hover states are readable in light **and** dark theme
- [ ] No double borders
- [ ] No cards sliding or fading in on load or scroll
- [ ] No scroll cues
- [ ] Text + photo rows stack cleanly on iPad; no large empty areas
- [ ] Button groups are full width on phones; lone buttons are centred
- [ ] Section spacing is even; no triple padding around small blocks
- [ ] Apply Now is reachable from the mobile menu

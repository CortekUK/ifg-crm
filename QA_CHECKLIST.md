# QA_CHECKLIST.md

## Purpose
Use this checklist before saying the IFG website work is complete.

## Brand and Design QA
Check:
- Does the site feel like a premium football education institution?
- Does it avoid looking like a SaaS landing page or CRM dashboard?
- Does it preserve IFG's football energy and brand credibility?
- Are real imagery and logo areas treated as important?
- Do the white sections feel designed, not plain?
- Are dark sections atmospheric without being empty?
- Are programme cards visual, premium, and easy to scan?
- Is the partner/credibility section strong enough?
- Does the page feel like a clear level-up from the current IFG website?

## Conversion QA
Check:
- Is the primary CTA obvious above the fold?
- Are CTAs repeated at logical decision points?
- Does the homepage route users into the right programme?
- Is there a clear path for undecided visitors?
- Is the enquiry/application form easy to find?
- Is Player Login secondary, not the main CTA?
- Does the site explain what happens after applying?

## Content QA
Check:
- Is the copy specific to football education and IFG?
- Are programme differences clear?
- Is the copy realistic and not overpromising?
- Are parent concerns addressed?
- Are FAQs useful and readable?
- Are placeholder claims marked for confirmation?

## Functional QA
Check:
- `/landing` loads publicly.
- `/landing/programmes` loads publicly.
- `/landing/programmes/[slug]` pages load publicly.
- Public landing pages are not blocked by CRM auth middleware.
- Existing CRM routes still work.
- Navigation links work.
- CTA buttons go to the correct destinations.
- Player Login links to the correct portal/login route.
- The enquiry form validates correctly.
- The enquiry form submits correctly.
- The enquiry API route works.
- Required environment variables are documented.

## CRM / Lead Flow QA
Check:
- Does the form create a CRM lead record?
- Does the form only send an email?
- Does the form trigger a webhook?
- Where does the enquiry data go?
- Is the user told accurately what the current behaviour is?
- Are all useful lead fields captured?

Important: Do not claim the form feeds the CRM unless it actually does.

## Technical QA
Run where available:
- `npm run build`
- `npm run lint`
- `npm run typecheck`
- relevant tests if present

Check:
- no broken imports
- no unused major components
- no duplicate logic
- no TypeScript errors
- no hydration errors
- no console errors in browser
- no hardcoded secrets
- no hardcoded private email addresses without approval

## Responsive QA
Check on:
- desktop
- tablet width
- mobile width

Specific checks:
- nav/mobile menu works
- hero text is readable
- CTAs are visible
- programme cards are easy to scan
- images crop correctly
- form fields are usable
- footer is not cramped

## Accessibility QA
Check:
- buttons have clear labels
- form fields have labels
- colour contrast is acceptable
- headings are structured logically
- links are distinguishable
- keyboard navigation is reasonable

## Final Delivery Summary
When finished, report:
1. Files changed
2. What changed
3. Tests/checks run
4. Current form/CRM behaviour
5. Known assumptions
6. Recommended next step

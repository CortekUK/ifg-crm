-- Global email branding
-- =====================
-- Adds the `email_branding` settings record: the header strip, sender
-- signature, social row, partner logos + disclaimer, and unsubscribe strip
-- shared by every outgoing email.
--
-- Before this, each template kept a private copy of those sections in
-- body_json and the header / unsubscribe strips were hard-coded in the
-- renderer with no UI at all. 22 templates had drifted into three
-- different social-channel sets and two different logo rows, one of them
-- with broken (leading-space) URLs, and 20 were still shipping the
-- retired "University of Central Lancashire" crest.
--
-- The row's `value` holds:
--   config           — the editable branding (see lib/templates/branding-types.ts)
--   rendered         — { header, footer, legal } HTML with merge tags STILL
--                      UNRESOLVED, so the send path can personalise per
--                      deal owner after stitching it in
--   rendered_at      — when the HTML was last produced
--   renderer_version — bumped when render-branding.ts changes shape
--
-- The row is seeded empty on purpose. `resolveBranding(null)` in the app
-- returns the shipped defaults, and `node scripts/publish-branding.mjs`
-- renders them into this row. Keeping the config in TypeScript rather than
-- duplicating it in SQL means there is only one place it can be wrong.

INSERT INTO crm_settings (key, value)
VALUES ('email_branding', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE crm_settings IS
  'App-wide key/value settings. The `email_branding` key holds the global email header/footer config plus its pre-rendered HTML.';

-- ------------------------------------------------------------------
-- Fix: super_admins could not write settings
-- ------------------------------------------------------------------
-- Migration 069 wrote these policies as a literal `role = 'admin'` check,
-- which silently excluded super_admin — the role most likely to be
-- configuring branding. Every other table moved to public.is_admin()
-- (admin OR super_admin) in migration 101; crm_settings was missed.
--
-- Also wraps the call in a scalar subquery, matching migration 160, so
-- the planner evaluates it once per query instead of once per row.

DROP POLICY IF EXISTS "Admins can update settings" ON crm_settings;
DROP POLICY IF EXISTS "Admins can insert settings" ON crm_settings;

CREATE POLICY "crm_settings_update" ON crm_settings
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "crm_settings_insert" ON crm_settings
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

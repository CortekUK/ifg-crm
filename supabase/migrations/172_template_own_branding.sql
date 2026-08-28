-- Let a template supply its own header and footer instead of the global ones.
--
-- Every template has always carried the shared masthead and footer, stitched
-- in at send time through marker comments. That is right for a letter and
-- wrong for a designed campaign: a band that suits plain copy fights a poster,
-- and the client's reference designs each have a bespoke header.
--
-- Default TRUE, so all 27 existing templates keep the global branding they
-- have today and nothing changes for them.
--
-- A template that sets this FALSE takes on its own compliance: the unsubscribe
-- link and the company details live in the global legal strip, so a template
-- without it must carry them in its own blocks. The editor warns about this
-- when the toggle is switched off.
ALTER TABLE email_templates
  ADD COLUMN IF NOT EXISTS use_global_branding BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN email_templates.use_global_branding IS
  'When false the template renders no global header/footer/legal markers and must carry its own unsubscribe link.';

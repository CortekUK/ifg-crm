-- Terms & Conditions per programme, editable from the CRM.
--
-- Payment now requires the customer to tick a box agreeing to the terms, so
-- the terms need somewhere to live that IFG can change without a deploy —
-- and a stable public URL for the Stripe checkout page to link to.
--
-- `version` is the point of this table rather than just a text field on
-- website_pricing_settings. A tick box is only worth anything in a dispute if
-- you can say WHICH text was agreed to; the version is stamped onto the Stripe
-- session at checkout, so a payment stays tied to the wording that was live
-- when it was made, even after the terms are rewritten.
--
-- Policies mirror website_packages exactly: anyone may read a published row
-- (the public website is not signed in), only content admins may write.

CREATE TABLE IF NOT EXISTS website_terms (
  programme   TEXT PRIMARY KEY
              CHECK (programme IN ('residency', 'university', 'gapyear')),
  title       TEXT NOT NULL DEFAULT 'Terms & Conditions',
  body        TEXT NOT NULL DEFAULT '',
  -- Bumped by the CMS whenever the body changes, never by hand.
  version     INTEGER NOT NULL DEFAULT 1,
  published   BOOLEAN NOT NULL DEFAULT false,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID REFERENCES profiles(id) ON DELETE SET NULL
);

ALTER TABLE website_terms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS website_terms_public_read ON website_terms;
CREATE POLICY website_terms_public_read ON website_terms
  FOR SELECT TO anon, authenticated
  USING (published = true);

DROP POLICY IF EXISTS website_terms_admin_all ON website_terms;
CREATE POLICY website_terms_admin_all ON website_terms
  FOR ALL TO authenticated
  USING (is_content_admin())
  WITH CHECK (is_content_admin());

-- Seed a draft row per programme so the CMS always has something to open.
-- Unpublished, and empty: nobody should be shown terms nobody has written.
INSERT INTO website_terms (programme, title)
VALUES
  ('residency',  'Summer Residency — Terms & Conditions'),
  ('university', 'University Programme — Terms & Conditions'),
  ('gapyear',    'Gap Year Programme — Terms & Conditions')
ON CONFLICT (programme) DO NOTHING;

COMMENT ON TABLE website_terms IS
  'Programme Terms & Conditions shown on the website and linked from Stripe checkout. version is stamped onto each payment.';

-- Brochures (self-hosted flipbooks) — replaces the external Publu dependency.
-- One brochure per programme page (summer / university / gap-year). The PDF is
-- uploaded to Supabase Storage via the CRM CMS; the website renders it as a
-- gated flipbook and captures the viewer as a lead in the CRM.

CREATE TABLE IF NOT EXISTS public.website_brochures (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program      text NOT NULL UNIQUE,           -- 'summer' | 'university' | 'gap-year'
  title        text NOT NULL,
  description  text,
  pdf_url      text,                            -- Supabase Storage public URL
  cover_image  text,
  page_count   integer,
  published    boolean NOT NULL DEFAULT false,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.website_brochures ENABLE ROW LEVEL SECURITY;

-- Public (anon + authenticated) may read only published brochures.
DROP POLICY IF EXISTS website_brochures_public_read ON public.website_brochures;
CREATE POLICY website_brochures_public_read ON public.website_brochures
  FOR SELECT TO anon, authenticated
  USING (published = true);

-- Content admins manage everything.
DROP POLICY IF EXISTS website_brochures_admin_all ON public.website_brochures;
CREATE POLICY website_brochures_admin_all ON public.website_brochures
  FOR ALL TO authenticated
  USING (is_content_admin())
  WITH CHECK (is_content_admin());

DROP TRIGGER IF EXISTS update_website_brochures_updated_at ON public.website_brochures;
CREATE TRIGGER update_website_brochures_updated_at
  BEFORE UPDATE ON public.website_brochures
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Allow the new contact source used by brochure lead capture.
ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_source_check;
ALTER TABLE public.contacts ADD CONSTRAINT contacts_source_check CHECK (
  source = ANY (ARRAY[
    'website_form','sms_reply','email_reply','manual','csv_import','referral',
    'google_ads','instagram','facebook','email_campaign','event',
    'website_deposit','website_chatbot','website_exit_intent','website_university',
    'website_brochure'
  ])
);

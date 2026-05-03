-- Add a `is_draft` flag to email_templates so the templates list can
-- distinguish work-in-progress drafts from finished templates. The
-- "Draft" badge in the UI is driven by this column.
--
-- Save flow:
--   * Save Draft button       → is_draft = true   (mark as draft)
--   * Save & Exit / Update    → is_draft = false  (publish)
--   * Auto-save               → unchanged         (silent saves don't
--                                                   transition state)
--
-- Defaults to FALSE so that:
--   * Pre-existing rows backfilled below are treated as already-final
--     (they pre-date this system; users had no way to mark them draft).
--   * Brand-new rows created via auto-save / non-explicit save paths
--     don't surprise-flag as drafts. The Save Draft button is the ONLY
--     thing that intentionally creates a draft.

ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS is_draft BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: any existing templates are considered final.
UPDATE public.email_templates SET is_draft = FALSE WHERE is_draft IS NOT FALSE;

-- Make sure the default is FALSE even if the column was added by an
-- earlier version of this migration with DEFAULT TRUE.
ALTER TABLE public.email_templates ALTER COLUMN is_draft SET DEFAULT FALSE;

COMMENT ON COLUMN public.email_templates.is_draft IS
  'TRUE only when the user explicitly hit Save Draft. Drives the Draft badge on the templates list.';

-- Migration: Contact Response stage + deal intent tagging.
--
-- When a contact replies to an outreach email, the reply gets classified
-- by the AI intent classifier (positive / negative / question /
-- unsubscribe / etc.), and the deal it belongs to should be moved to a
-- "Contact Response" stage so the recruiter can triage at a glance. The
-- card on the kanban also colours its left edge based on the intent.
--
-- Two changes here:
--   1. deals.intent text column — stores the latest reply intent for
--      that deal. Set by the resend-inbound edge function after
--      classification. Drives the card colour in DealCard.tsx.
--   2. For every existing pipeline, append a "Contact Response" stage
--      (stage_type 'contact', highest display_order). New pipelines
--      created via the UI will pick up the same stage from the modal's
--      default list.

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS intent TEXT;

-- Free-form so the classifier output (positive/negative/question/etc.)
-- can flow through without schema migrations every time we change the
-- intent enum.

CREATE INDEX IF NOT EXISTS idx_deals_intent ON deals(intent)
  WHERE intent IS NOT NULL;

-- For each existing pipeline, append Contact Response if it doesn't
-- already exist. We append (max + 1) rather than inserting in the
-- middle to avoid renumbering — the unique (pipeline_id, display_order)
-- constraint makes mid-insert unsafe without a multi-pass shuffle, and
-- the user can drag the stage to its preferred position once it's there.
INSERT INTO pipeline_stages (pipeline_id, name, stage_type, color, display_order)
SELECT
  p.id,
  'Contact Response',
  'contact',
  '#22d3ee',
  COALESCE(MAX(s.display_order) + 1, 0)
FROM pipelines p
LEFT JOIN pipeline_stages s ON s.pipeline_id = p.id
WHERE NOT EXISTS (
  SELECT 1 FROM pipeline_stages s2
  WHERE s2.pipeline_id = p.id AND s2.name = 'Contact Response'
)
GROUP BY p.id;

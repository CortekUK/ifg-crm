-- Migration 134: Dormant recurring reminder
--
-- Appends a recurring "re-engagement" tail onto each of the three INITIAL
-- CONTACT MAP automations (UK Gap 2027, Summer Residency 2027, University of
-- Lancashire). After the existing 3-email initial sequence finishes WITHOUT a
-- reply, the appended steps:
--
--   step 6: move_to_stage  -> Dormant            (explicit; the looping
--                                                  enrollment never "completes",
--                                                  so the old no_reply_stage_id-
--                                                  on-completion move can't fire)
--   step 7: send_email     -> Dormant reminder   (first reminder, immediate)
--   step 8: wait 21 days
--
-- and flags the automation `recurring` with a loop back to step 7. Combined
-- with the recurring loop-back added to the process-automations edge function,
-- this nudges a non-responsive deal every ~3 weeks while it sits in Dormant —
-- indefinitely — until one of:
--   * the contact replies      -> exit_on_reply moves the deal to Contact
--                                  Response and stops the loop (already wired),
--   * the deal leaves Dormant  -> the engine's anchor-stage check stops the
--                                  loop and leaves the deal where it was moved,
--   * someone manually unenrols.
--
-- Anchor + Dormant target are read from each automation's existing
-- no_reply_stage_id (already = that pipeline's Dormant stage), so no per-
-- pipeline stage IDs are hard-coded here.
--
-- Idempotent: re-running neither duplicates the template nor the appended steps.

-- 1. Shared reminder template (deal-owner sender). Fixed UUID -> re-run no-op.
INSERT INTO email_templates (id, name, subject, body_html, body_json, category, from_name_type, is_draft)
VALUES (
  'a1b2c3d4-0000-4000-8000-000000000134',
  'Dormant Re-Engagement Reminder',
  'Still interested, {{first_name}}?',
  '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>'
  || '<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f9fafb;">'
  || '<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f9fafb;"><tr><td align="center">'
  || '<table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;margin:0 auto;background-color:#ffffff;">'
  || '<tr><td style="background-color:#0f172a;padding:20px;text-align:center;"><span style="color:#ffffff;font-size:22px;font-weight:bold;">International Football Group</span></td></tr>'
  || '<tr><td style="padding:24px;font-size:16px;line-height:1.6;color:#111111;">'
  || '<p>Hi {{first_name}},</p>'
  || '<p>We haven''t heard back from you, so we wanted to check in. We''d still love to help you take the next step.</p>'
  || '<p>If you''re still interested, just reply to this email &mdash; or book a quick call below and we''ll talk it through.</p>'
  || '<div style="text-align:center;padding:20px 0;"><a href="{{deal_owner_calendly}}" target="_blank" style="display:inline-block;background-color:#0f172a;color:#ffffff;padding:14px 32px;text-decoration:none;border-radius:6px;font-weight:bold;">Book a Call</a></div>'
  || '<p>Best regards,<br>{{deal_owner_name}}<br>{{deal_owner_title}}</p>'
  || '</td></tr>'
  || '<tr><td style="background-color:#f3f4f6;padding:16px;text-align:center;font-size:12px;color:#6b7280;"><p style="margin:0;">International Football Group</p><p style="margin:8px 0 0;"><a href="{{unsubscribe_url}}" style="color:#3b82f6;">Unsubscribe</a></p></td></tr>'
  || '</table></td></tr></table></body></html>',
  '[
    {"id":"blk_rem_1","type":"text","content":{"html":"<p>Hi {{first_name}},</p>","fontSize":"normal","alignment":"left","paddingTop":0,"paddingBottom":12}},
    {"id":"blk_rem_2","type":"text","content":{"html":"<p>We haven''t heard back from you, so we wanted to check in. We''d still love to help you take the next step.</p>","fontSize":"normal","alignment":"left","paddingTop":0,"paddingBottom":12}},
    {"id":"blk_rem_3","type":"text","content":{"html":"<p>If you''re still interested, just reply to this email — or book a quick call below and we''ll talk it through.</p>","fontSize":"normal","alignment":"left","paddingTop":0,"paddingBottom":12}},
    {"id":"blk_rem_4","type":"button","content":{"url":"{{deal_owner_calendly}}","text":"Book a Call","width":"auto","paddingX":32,"paddingY":14,"alignment":"center","textColor":"#ffffff","paddingTop":16,"borderRadius":6,"paddingBottom":16,"backgroundColor":"#0f172a"}},
    {"id":"blk_rem_5","type":"text","content":{"html":"<p>Best regards,<br>{{deal_owner_name}}<br>{{deal_owner_title}}</p>","fontSize":"normal","alignment":"left","paddingTop":24,"paddingBottom":12}}
  ]'::jsonb,
  'automation',
  'deal_owner',
  false
)
ON CONFLICT (id) DO NOTHING;

-- 2. Append the recurring tail + set recurring config on the three automations.
DO $$
DECLARE
  rec       RECORD;
  v_dormant UUID;
  v_template UUID := 'a1b2c3d4-0000-4000-8000-000000000134';
BEGIN
  FOR rec IN
    SELECT id, no_reply_stage_id
    FROM automations
    WHERE id IN (
      '77778723-5dc8-40c1-825a-b76f3808004c',  -- UK Gap - INITIAL CONTACT MAP
      '590194b9-c16e-4e51-813b-e0e3f6d366ed',  -- Summer Residency INITIAL CONTACT MAP
      'af84819a-4cfe-448b-902d-9c65798728b9'   -- University of Lancashire - INITIAL CONTACT MAP
    )
  LOOP
    -- All three already have no_reply_stage_id = their pipeline's Dormant stage.
    v_dormant := rec.no_reply_stage_id;

    IF v_dormant IS NULL THEN
      RAISE NOTICE 'Skipping automation % — no_reply_stage_id (Dormant) is not set', rec.id;
      CONTINUE;
    END IF;

    -- Append steps only once (idempotent on step_order 6).
    IF NOT EXISTS (
      SELECT 1 FROM automation_steps WHERE automation_id = rec.id AND step_order = 6
    ) THEN
      INSERT INTO automation_steps (automation_id, step_order, step_type, delay_days, delay_hours, target_stage_id)
      VALUES (rec.id, 6, 'move_to_stage', 0, 0, v_dormant);

      INSERT INTO automation_steps (automation_id, step_order, step_type, delay_days, delay_hours, email_template_id)
      VALUES (rec.id, 7, 'send_email', 0, 0, v_template);

      INSERT INTO automation_steps (automation_id, step_order, step_type, delay_days, delay_hours)
      VALUES (rec.id, 8, 'wait', 21, 0);
    END IF;

    -- Merge recurring config: loop back to step 7 (the reminder send), anchored
    -- to Dormant so the loop self-terminates once the deal leaves the stage.
    UPDATE automations
    SET config = COALESCE(config, '{}'::jsonb) || jsonb_build_object(
          'recurring', true,
          'recurring_loop_to_order', 7,
          'recurring_anchor_stage_id', v_dormant::text
        )
    WHERE id = rec.id;
  END LOOP;
END $$;

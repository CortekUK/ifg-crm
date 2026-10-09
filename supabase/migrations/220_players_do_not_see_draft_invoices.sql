-- QA-58: a draft invoice was visible to the player and counted in their
-- "Outstanding" total.
--
-- Staff raise an invoice and leave it as a draft while the amount or the
-- description is still being settled. The player's portal showed it anyway,
-- on the dashboard and the Invoices page, and added it to the money they
-- appear to owe — so a player could be chased in their own portal for a
-- figure the office had not sent them and might still change. The Pay Now
-- button was hidden for drafts, which made it look deliberate rather than an
-- oversight.
--
-- The portal queries now filter drafts out themselves; this is the backstop,
-- scoped to the PLAYER branch of the policy only. Admins and recruiters must
-- keep seeing drafts — that is the whole point of a draft — so the is_admin()
-- and recruiter branches are left exactly as they were.
--
-- 'draft' is the only status withheld. A sent, overdue, paid or cancelled
-- invoice is a real event the player is entitled to see.
--
-- Rewritten in full rather than patched, because a policy cannot be altered
-- in place. The other two branches are copied verbatim from migration 214.
-- Idempotent.

DROP POLICY IF EXISTS invoices_select ON invoices;

CREATE POLICY invoices_select ON invoices
  FOR SELECT
  USING (
    (SELECT is_admin())
    OR (
      (SELECT get_user_role()) = 'player'
      AND contact_id = (SELECT get_player_contact_id())
      AND status <> 'draft'
    )
    OR (
      (SELECT get_user_role()) = 'recruiter'
      AND (owns_contact(contact_id) OR owns_deal(deal_id))
    )
  );

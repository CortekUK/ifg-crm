-- Put back the deals the exit-stage bug moved (see migration 180).
--
-- The bug left a precise fingerprint: two stage changes for one deal written
-- in the same transaction, where the second starts from where the first
-- landed. The first row is where the recruiter actually put the card, so it
-- is recoverable exactly rather than guessed.
--
-- Restricted to deals still sitting in the wrong stage — Nathan and Dan have
-- already re-dragged most of them by hand, and those must not be disturbed.
with pairs as (
  select distinct h2.deal_id, h1.to_stage_id as intended_stage
  from deal_stage_history h1
  join deal_stage_history h2
    on h2.deal_id = h1.deal_id
   and h2.changed_at = h1.changed_at
   and h2.from_stage_id = h1.to_stage_id
   and h2.id <> h1.id
)
update deals d
   set current_stage_id = p.intended_stage
  from pairs p
 where d.id = p.deal_id
   and d.current_stage_id is distinct from p.intended_stage;

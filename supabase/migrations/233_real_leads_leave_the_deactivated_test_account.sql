-- QA-16 "Template — Deal Creation (1)" Issue 1: real leads were assigned to the
-- "test" staff account and are still owned by it.
--
-- test@macclesfieldfc.com was in the round-robin while it was active and took
-- form leads from it. The account is now deactivated (migration 193), so it
-- receives no NEW deals — assign_round_robin_owner filters on is_active, both
-- when resolving "all staff" and when pruning a hand-picked rotation.
--
-- But the deals it already holds were never moved, and there is no screen
-- anywhere that lists deals with an inactive owner, so they were invisible.
-- Four of them are real people. The owner is who an automated email is sent
-- AS, so those players were receiving mail from "test
-- <test@macclesfieldfc.com>" with no real recruiter following them up.
--
-- Who gets them: the least-loaded ACTIVE recruiter at the time of assignment,
-- taken in turn — the same spread the round-robin would have produced had the
-- test account never been in it. Super admins (Nathan, Matthew) are left out
-- on purpose: whether they should receive new leads at all is still an open
-- question for IFG on this ticket, so this does not pre-empt it.
--
-- This is a book-of-business change, so it is deliberately easy to undo and
-- easy to see: every row moved is listed in the commit message, and an owner
-- can be changed from the deal card in one click.
--
-- Idempotent: once nothing is owned by the test account, this matches no rows.

WITH test_account AS (
  SELECT id FROM profiles WHERE lower(email) = 'test@macclesfieldfc.com'
),
-- Active recruiters only, lightest book first.
recruiters AS (
  SELECT p.id,
         row_number() OVER (
           ORDER BY (SELECT count(*) FROM deals d
                      WHERE d.deal_owner_id = p.id OR d.owner_id = p.id), p.email
         ) - 1 AS slot,
         count(*) OVER () AS slots
  FROM profiles p
  WHERE p.is_active
    AND p.role = 'recruiter'
    AND lower(p.email) <> 'superadmin@theinternationalfootballgroup.com'
),
orphaned AS (
  SELECT d.id,
         row_number() OVER (ORDER BY d.created_at) - 1 AS n
  FROM deals d, test_account t
  WHERE d.deal_owner_id = t.id OR d.owner_id = t.id
),
assigned AS (
  SELECT o.id AS deal_id, r.id AS new_owner
  FROM orphaned o
  JOIN recruiters r ON r.slot = o.n % r.slots
)
UPDATE deals d
SET deal_owner_id = a.new_owner,
    owner_id      = a.new_owner,
    updated_at    = NOW()
FROM assigned a
WHERE d.id = a.deal_id;

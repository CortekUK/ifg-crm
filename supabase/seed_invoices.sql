-- Test invoices for the IFG CRM
-- Run this in the Supabase SQL Editor AFTER running seed_contacts.sql and seed_deals.sql
-- This creates sample invoices with various statuses

DO $$
DECLARE
  profile_id uuid;
  john_id uuid;
  emma_id uuid;
  james_id uuid;
  olivia_id uuid;
  william_id uuid;
  john_deal_id uuid;
  emma_deal_id uuid;
  olivia_deal_id uuid;
BEGIN
  -- Get the first profile (your logged-in user)
  SELECT id INTO profile_id FROM profiles LIMIT 1;
  
  IF profile_id IS NULL THEN
    RAISE EXCEPTION 'No profile found. Please log in to create a user profile first.';
  END IF;
  
  -- Get contact IDs
  SELECT id INTO john_id FROM contacts WHERE email = 'john.smith@example.com';
  SELECT id INTO emma_id FROM contacts WHERE email = 'emma.wilson@example.com';
  SELECT id INTO james_id FROM contacts WHERE email = 'james.brown@example.com';
  SELECT id INTO olivia_id FROM contacts WHERE email = 'olivia.jones@example.com';
  SELECT id INTO william_id FROM contacts WHERE email = 'william.davis@example.com';
  
  IF john_id IS NULL THEN
    RAISE EXCEPTION 'Test contacts not found. Please run seed_contacts.sql first.';
  END IF;
  
  -- Get some deal IDs (may be null if seed_deals.sql wasn't run)
  SELECT id INTO john_deal_id FROM deals WHERE contact_id = john_id LIMIT 1;
  SELECT id INTO emma_deal_id FROM deals WHERE contact_id = emma_id LIMIT 1;
  SELECT id INTO olivia_deal_id FROM deals WHERE contact_id = olivia_id LIMIT 1;
  
  -- Clear existing test invoices for these contacts
  DELETE FROM invoices WHERE contact_id IN (john_id, emma_id, james_id, olivia_id, william_id);
  
  -- Insert test invoices
  INSERT INTO invoices (
    contact_id, 
    deal_id, 
    type, 
    description, 
    amount, 
    currency, 
    status, 
    due_date, 
    sent_at, 
    paid_at, 
    created_by_id
  ) VALUES
    -- PAID invoice - John Smith (Deposit)
    (
      john_id, 
      john_deal_id, 
      'deposit', 
      'UCLan 2026 Programme Deposit', 
      1000.00, 
      'GBP', 
      'paid', 
      '2026-01-15', 
      '2026-01-10 10:00:00+00', 
      '2026-01-12 14:30:00+00', 
      profile_id
    ),
    
    -- SENT invoice - Emma Wilson (Deposit, awaiting payment)
    (
      emma_id, 
      emma_deal_id, 
      'deposit', 
      'UCLan 2026 Programme Deposit', 
      1000.00, 
      'GBP', 
      'sent', 
      '2026-02-01', 
      '2026-01-20 09:00:00+00', 
      NULL, 
      profile_id
    ),
    
    -- OVERDUE invoice - James Brown (Full Payment)
    (
      james_id, 
      NULL, 
      'full_payment', 
      'Summer Camp 2026', 
      3000.00, 
      'GBP', 
      'overdue', 
      '2026-01-20', 
      '2026-01-10 11:00:00+00', 
      NULL, 
      profile_id
    ),
    
    -- SENT invoice - Olivia Jones (Instalment)
    (
      olivia_id, 
      olivia_deal_id, 
      'installment', 
      'UCLan 2026 - Instalment 1 of 5', 
      2800.00, 
      'GBP', 
      'sent', 
      '2026-02-15', 
      '2026-01-25 10:00:00+00', 
      NULL, 
      profile_id
    ),
    
    -- DRAFT invoice - William Davis (Meal Plan)
    (
      william_id, 
      NULL, 
      'meal_plan', 
      'Semester 1 Meal Plan', 
      1500.00, 
      'GBP', 
      'draft', 
      '2026-03-01', 
      NULL, 
      NULL, 
      profile_id
    ),
    
    -- PAID invoice - John Smith (Instalment 1)
    (
      john_id, 
      john_deal_id, 
      'installment', 
      'UCLan 2026 - Instalment 1 of 5', 
      2800.00, 
      'GBP', 
      'paid', 
      '2026-02-01', 
      '2026-01-15 09:00:00+00', 
      '2026-01-28 16:45:00+00', 
      profile_id
    ),
    
    -- SENT invoice - John Smith (Instalment 2, coming up)
    (
      john_id, 
      john_deal_id, 
      'installment', 
      'UCLan 2026 - Instalment 2 of 5', 
      2800.00, 
      'GBP', 
      'sent', 
      '2026-03-01', 
      '2026-02-01 09:00:00+00', 
      NULL, 
      profile_id
    ),
    
    -- CANCELLED invoice - Emma Wilson (Trip - cancelled)
    (
      emma_id, 
      NULL, 
      'trip', 
      'Manchester City Stadium Tour', 
      150.00, 
      'GBP', 
      'cancelled', 
      '2026-02-20', 
      '2026-01-18 14:00:00+00', 
      NULL, 
      profile_id
    );
  
  RAISE NOTICE 'Successfully created 8 test invoices';
END $$;

-- Verify the invoices were created
SELECT 
  invoice_number,
  c.first_name || ' ' || c.last_name AS contact_name,
  i.type,
  i.amount,
  i.status,
  i.due_date,
  i.sent_at,
  i.paid_at
FROM invoices i
JOIN contacts c ON i.contact_id = c.id
ORDER BY i.created_at DESC;

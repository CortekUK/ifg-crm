-- Test email replies for the IFG CRM
-- Run this in the Supabase SQL Editor AFTER running seed_contacts.sql and seed_campaigns.sql
-- This creates sample email replies with various statuses and AI intents

DO $$
DECLARE
  john_id uuid;
  emma_id uuid;
  campaign_id uuid;
  profile_id uuid;
BEGIN
  -- Get the first profile (your logged-in user)
  SELECT id INTO profile_id FROM profiles LIMIT 1;
  
  -- Get contact IDs
  SELECT id INTO john_id FROM contacts WHERE email = 'john.smith@example.com';
  SELECT id INTO emma_id FROM contacts WHERE email = 'emma.wilson@example.com';
  
  -- Get a campaign ID (from seed_campaigns.sql)
  SELECT id INTO campaign_id FROM campaigns WHERE name = 'January 2026 Newsletter' LIMIT 1;
  
  -- Clear existing test email replies
  DELETE FROM email_replies WHERE from_email IN (
    'parent.smith@gmail.com',
    'sarah.jones@yahoo.com',
    'remove.me@test.com',
    'john.smith@example.com',
    'emma.wilson@example.com',
    'spam@spammer.com',
    'interested.player@outlook.com',
    'coach.williams@school.edu'
  );
  
  -- Insert test email replies
  INSERT INTO email_replies (
    from_email, 
    from_name, 
    subject, 
    body_preview, 
    body_full, 
    contact_id, 
    campaign_id, 
    ai_intent, 
    match_status,
    matched_by_id,
    matched_at,
    created_at
  ) VALUES
    -- UNMATCHED EMAILS (4)
    (
      'parent.smith@gmail.com',
      'Michael Smith',
      'Re: UCLan Football Programme',
      'Hi, my son is very interested in the programme. Can we arrange a call to discuss further?',
      'Hi,

My son is very interested in the UCLan Football Programme. Can we arrange a call to discuss further?

We have some questions about:
- Accommodation options
- Total costs involved
- Scholarship availability
- Academic requirements

Best regards,
Michael Smith',
      NULL,
      NULL,
      'positive',
      'unmatched',
      NULL,
      NULL,
      NOW() - INTERVAL '3 hours'
    ),
    (
      'sarah.jones@yahoo.com',
      'Sarah Jones',
      'Re: Gap Year Programme Information',
      'Thanks for reaching out. What are the payment options available?',
      'Thanks for reaching out.

What are the payment options available? My daughter is keen but we need to understand the financial commitment.

Can you also tell me about the visa requirements for international students?

Thanks,
Sarah',
      NULL,
      NULL,
      'positive',
      'unmatched',
      NULL,
      NULL,
      NOW() - INTERVAL '6 hours'
    ),
    (
      'remove.me@test.com',
      NULL,
      'UNSUBSCRIBE',
      'Please remove me from your mailing list immediately',
      'Please remove me from your mailing list immediately.

I did not sign up for this and do not wish to receive any further emails.

Unsubscribe me now.',
      NULL,
      NULL,
      'negative',
      'unmatched',
      NULL,
      NULL,
      NOW() - INTERVAL '1 day'
    ),
    (
      'interested.player@outlook.com',
      'Alex Johnson',
      'Question about the summer camp',
      'Hi, I saw your advert about the summer football camp. What dates is it running?',
      'Hi,

I saw your advert about the summer football camp and I''m very interested.

What dates is it running and is there still space available?

I''m 17 years old and play as a midfielder.

Thanks,
Alex Johnson',
      NULL,
      NULL,
      'positive',
      'unmatched',
      NULL,
      NULL,
      NOW() - INTERVAL '1 hour'
    ),
    
    -- AUTO-MATCHED EMAILS (2) - linked to existing contacts
    (
      'john.smith@example.com',
      'John Smith',
      'Re: January 2026 Newsletter',
      'This looks great! I am definitely interested in the summer camp.',
      'This looks great! I am definitely interested in the summer camp.

Can you send me more details about registration and what to bring?

Thanks,
John',
      john_id,
      campaign_id,
      'positive',
      'auto_matched',
      NULL,
      NULL,
      NOW() - INTERVAL '2 hours'
    ),
    (
      'emma.wilson@example.com',
      'Emma Wilson',
      'Re: January 2026 Newsletter',
      'Thanks for the update. Still considering my options.',
      'Thanks for the update.

Still considering my options. Will get back to you soon once I''ve discussed with my parents.

Emma',
      emma_id,
      campaign_id,
      'neutral',
      'auto_matched',
      NULL,
      NULL,
      NOW() - INTERVAL '5 hours'
    ),
    
    -- MANUALLY MATCHED EMAIL (1)
    (
      'coach.williams@school.edu',
      'Coach Williams',
      'Re: Partnership Opportunity',
      'Thanks for reaching out about the partnership. I have a few players who might be interested.',
      'Hi,

Thanks for reaching out about the partnership opportunity.

I have a few players at my school who might be interested in your programmes. Can we arrange a call to discuss how this could work?

Best,
Coach Williams
Head Football Coach
Springfield High School',
      NULL,
      NULL,
      'positive',
      'manually_matched',
      profile_id,
      NOW() - INTERVAL '3 hours',
      NOW() - INTERVAL '8 hours'
    ),
    
    -- SPAM EMAILS (2)
    (
      'spam@spammer.com',
      'FREE IPHONE',
      'You have won!!!',
      'Click here to claim your prize now!!!',
      'CONGRATULATIONS!!!

You have been selected to win a FREE IPHONE 15 PRO!!!

Click here now to claim your prize before it''s too late!!!

[SUSPICIOUS LINK REMOVED]',
      NULL,
      NULL,
      'negative',
      'spam',
      profile_id,
      NOW() - INTERVAL '7 hours',
      NOW() - INTERVAL '10 hours'
    ),
    (
      'crypto@scam.net',
      'Bitcoin Millionaire',
      'Make $10000 per day!!!',
      'I made millions with this one simple trick...',
      'Dear Friend,

I made millions with this one simple trick and now I want to share it with you!

Just invest $100 today and you could be making $10,000 per day by next week!

Don''t miss this opportunity!!!

[SUSPICIOUS LINK REMOVED]',
      NULL,
      NULL,
      'unknown',
      'spam',
      profile_id,
      NOW() - INTERVAL '6 hours',
      NOW() - INTERVAL '12 hours'
    );
  
  RAISE NOTICE 'Successfully created 9 test email replies';
END $$;

-- Verify the email replies were created
SELECT 
  from_name,
  from_email,
  subject,
  LEFT(body_preview, 40) || '...' AS preview,
  ai_intent,
  match_status,
  c.first_name || ' ' || c.last_name AS matched_contact,
  camp.name AS campaign,
  er.created_at
FROM email_replies er
LEFT JOIN contacts c ON er.contact_id = c.id
LEFT JOIN campaigns camp ON er.campaign_id = camp.id
ORDER BY er.created_at DESC;

-- Test email templates
-- Run this in the Supabase SQL Editor after you have created a user account

DO $$
DECLARE
  profile_id uuid;
BEGIN
  -- Get the first profile (your logged-in user)
  SELECT id INTO profile_id FROM profiles LIMIT 1;
  
  IF profile_id IS NULL THEN
    RAISE EXCEPTION 'No profile found. Please log in to create a user profile first.';
  END IF;
  
  -- Clear existing test templates
  DELETE FROM email_templates WHERE name IN (
    'Initial Contact Email 1',
    'Initial Contact Email 2',
    'Initial Contact Email 3',
    'Follow Up Email 1',
    'Follow Up Email 2',
    'Monthly Newsletter',
    'Invoice Reminder',
    'Welcome to IFG',
    'Payment Confirmation'
  );
  
  -- Insert test templates
  INSERT INTO email_templates (name, subject, body_html, category, from_name_type, fixed_from_name, fixed_from_email, created_by_id) VALUES
    (
      'Initial Contact Email 1',
      'Hi {{first_name}}, let''s chat about your football future',
      '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <p>Hi {{first_name}},</p>
        <p>I hope this email finds you well. My name is {{recruiter_name}} and I''m reaching out from International Football Group.</p>
        <p>We''ve been following your progress and believe you have what it takes to play football at a UK university while earning a degree.</p>
        <p>Would you be interested in a quick call to discuss your options?</p>
        <p>Best regards,<br>{{recruiter_name}}</p>
      </div>',
      'automation',
      'deal_owner',
      NULL,
      NULL,
      profile_id
    ),
    (
      'Initial Contact Email 2',
      'Following up on your UK football opportunity',
      '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <p>Hi {{first_name}},</p>
        <p>I wanted to follow up on my previous email about playing football in the UK.</p>
        <p>This is a fantastic opportunity to combine your passion for football with a quality education.</p>
        <p>Let me know if you''d like to schedule a call!</p>
        <p>Best,<br>{{recruiter_name}}</p>
      </div>',
      'automation',
      'deal_owner',
      NULL,
      NULL,
      profile_id
    ),
    (
      'Initial Contact Email 3',
      'Last chance to schedule your call',
      '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <p>Hi {{first_name}},</p>
        <p>This is my final attempt to connect with you about the UK football programme.</p>
        <p>If you''re interested, please reply to this email or book a call directly.</p>
        <p>If not, no worries at all - I wish you the best in your football journey!</p>
        <p>Cheers,<br>{{recruiter_name}}</p>
      </div>',
      'automation',
      'deal_owner',
      NULL,
      NULL,
      profile_id
    ),
    (
      'Follow Up Email 1',
      'Ready to take the next step, {{first_name}}?',
      '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <p>Hi {{first_name}},</p>
        <p>Great speaking with you about the {{programme}} programme!</p>
        <p>As discussed, here are the next steps...</p>
        <p>Looking forward to working with you.</p>
        <p>Best,<br>{{recruiter_name}}</p>
      </div>',
      'automation',
      'deal_owner',
      NULL,
      NULL,
      profile_id
    ),
    (
      'Follow Up Email 2',
      'Checking in - {{programme}} application',
      '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <p>Hi {{first_name}},</p>
        <p>I wanted to check in on your application progress.</p>
        <p>Do you have any questions or need any assistance?</p>
        <p>Best,<br>{{recruiter_name}}</p>
      </div>',
      'automation',
      'deal_owner',
      NULL,
      NULL,
      profile_id
    ),
    (
      'Monthly Newsletter',
      'IFG Monthly Update - Player Success Stories & Opportunities',
      '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1e40af;">IFG Monthly Update</h1>
        <p>Dear {{first_name}},</p>
        <p>Here''s what''s happening at International Football Group this month...</p>
        <h2>Player Success Stories</h2>
        <p>Congratulations to our latest players who have secured places at UK universities!</p>
        <h2>Upcoming Events</h2>
        <p>Don''t miss our upcoming open days and trial sessions.</p>
        <p>Best regards,<br>The IFG Team</p>
      </div>',
      'campaign',
      'fixed',
      'IFG Team',
      'newsletter@ifg-crm.com',
      profile_id
    ),
    (
      'Invoice Reminder',
      'Payment Reminder - Invoice {{invoice_number}}',
      '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <p>Hi {{first_name}},</p>
        <p>This is a friendly reminder that invoice {{invoice_number}} for £{{amount}} is due on {{due_date}}.</p>
        <p>You can make payment via bank transfer or through our online portal.</p>
        <p>If you have any questions, please don''t hesitate to get in touch.</p>
        <p>Best regards,<br>IFG Finance Team</p>
      </div>',
      'transactional',
      'fixed',
      'IFG Finance',
      'finance@ifg-crm.com',
      profile_id
    ),
    (
      'Welcome to IFG',
      'Welcome to International Football Group, {{first_name}}!',
      '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1e40af;">Welcome to IFG!</h1>
        <p>Hi {{first_name}},</p>
        <p>Welcome aboard! We''re thrilled to have you join the International Football Group family.</p>
        <p>Your journey to playing football at a UK university starts here.</p>
        <p>Here''s what happens next...</p>
        <p>Best regards,<br>The IFG Team</p>
      </div>',
      'transactional',
      'fixed',
      'IFG Team',
      'welcome@ifg-crm.com',
      profile_id
    ),
    (
      'Payment Confirmation',
      'Payment Received - Thank you, {{first_name}}!',
      '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <p>Hi {{first_name}},</p>
        <p>Thank you for your payment of £{{amount}}.</p>
        <p>This email confirms that we have received your payment for {{description}}.</p>
        <p>If you have any questions, please contact us.</p>
        <p>Best regards,<br>IFG Finance Team</p>
      </div>',
      'transactional',
      'fixed',
      'IFG Finance',
      'finance@ifg-crm.com',
      profile_id
    );
  
  RAISE NOTICE 'Successfully created 9 test email templates';
END $$;

-- Verify the templates were created
SELECT 
  name,
  category,
  from_name_type,
  created_at
FROM email_templates
ORDER BY category, created_at;

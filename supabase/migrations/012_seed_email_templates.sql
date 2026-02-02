-- Migration: Seed Email Templates
-- Creates default email templates for the CRM

-- First, add unique constraint on name if it doesn't exist
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_templates_name_unique ON email_templates(name);

DO $$
DECLARE
  profile_id uuid;
  template_count integer;
BEGIN
  -- Get the first profile (any logged-in user)
  SELECT id INTO profile_id FROM profiles LIMIT 1;
  
  -- If no profile exists, skip seeding (will be run when first user signs up)
  IF profile_id IS NULL THEN
    RAISE NOTICE 'No profile found. Templates will be created when a user signs up.';
    RETURN;
  END IF;

  -- Check if templates already exist
  SELECT COUNT(*) INTO template_count FROM email_templates WHERE name LIKE 'Initial Contact Email%';
  IF template_count > 0 THEN
    RAISE NOTICE 'Templates already exist. Skipping seed.';
    RETURN;
  END IF;
  
  -- Insert templates
  INSERT INTO email_templates (name, subject, body_html, category, from_name_type, fixed_from_name, fixed_from_email, created_by_id) VALUES
    (
      'Initial Contact Email 1',
      'Hi {{first_name}}, let''s chat about your football future',
      '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <p>Hi {{first_name}},</p>
        <p>I hope this email finds you well. My name is {{deal_owner_name}} and I''m reaching out from International Football Group.</p>
        <p>We''ve been following your progress and believe you have what it takes to play football at a UK university while earning a degree.</p>
        <p>Would you be interested in a quick call to discuss your options?</p>
        <p>Best regards,<br>{{deal_owner_name}}</p>
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
        <p>Best,<br>{{deal_owner_name}}</p>
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
        <p>Cheers,<br>{{deal_owner_name}}</p>
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
        <p>Great speaking with you about the programme!</p>
        <p>As discussed, here are the next steps...</p>
        <p>Looking forward to working with you.</p>
        <p>Best,<br>{{deal_owner_name}}</p>
      </div>',
      'automation',
      'deal_owner',
      NULL,
      NULL,
      profile_id
    ),
    (
      'Follow Up Email 2',
      'Checking in - application progress',
      '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <p>Hi {{first_name}},</p>
        <p>I wanted to check in on your application progress.</p>
        <p>Do you have any questions or need any assistance?</p>
        <p>Best,<br>{{deal_owner_name}}</p>
      </div>',
      'automation',
      'deal_owner',
      NULL,
      NULL,
      profile_id
    ),
    (
      'Follow Up Email 3',
      'Final reminder - deadline approaching',
      '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <p>Hi {{first_name}},</p>
        <p>I wanted to send a final reminder about the programme.</p>
        <p>The application deadline is approaching, and I''d hate for you to miss out on this opportunity.</p>
        <p>If you have any last-minute questions or need help completing your application, please don''t hesitate to reach out.</p>
        <p>You can book a quick call with me here: {{deal_owner_calendly}}</p>
        <p>Best regards,<br>{{deal_owner_name}}</p>
      </div>',
      'automation',
      'deal_owner',
      NULL,
      NULL,
      profile_id
    ),
    (
      'Meeting Confirmation',
      'Your meeting is confirmed, {{first_name}}!',
      '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <p>Hi {{first_name}},</p>
        <p>Great news! Your meeting has been confirmed.</p>
        <p><strong>Meeting Details:</strong></p>
        <ul>
          <li><strong>With:</strong> {{deal_owner_name}}</li>
          <li><strong>Topic:</strong> UK Football Programme Discussion</li>
        </ul>
        <p>Please ensure you have:</p>
        <ul>
          <li>A stable internet connection</li>
          <li>Any questions you''d like to discuss</li>
          <li>Your football CV/profile ready (if available)</li>
        </ul>
        <p>If you need to reschedule, please let me know at least 24 hours in advance.</p>
        <p>Looking forward to speaking with you!</p>
        <p>Best regards,<br>{{deal_owner_name}}<br>{{deal_owner_email}}</p>
      </div>',
      'automation',
      'deal_owner',
      NULL,
      NULL,
      profile_id
    ),
    (
      'Document Request',
      'Documents needed for your application',
      '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <p>Hi {{first_name}},</p>
        <p>Thank you for your interest in the programme!</p>
        <p>To proceed with your application, we''ll need the following documents:</p>
        <ol>
          <li><strong>Football CV</strong> - Including your playing history, positions, and achievements</li>
          <li><strong>Academic Transcripts</strong> - Your most recent grades/results</li>
          <li><strong>Highlight Video</strong> - A link to your playing highlights (YouTube, Vimeo, etc.)</li>
          <li><strong>Passport Copy</strong> - First page with your photo and details</li>
          <li><strong>Reference Letter</strong> - From a coach or manager (optional but helpful)</li>
        </ol>
        <p>Please reply to this email with the documents attached, or upload them to our secure portal.</p>
        <p>If you have any questions about what''s required, please don''t hesitate to ask.</p>
        <p>Best regards,<br>{{deal_owner_name}}<br>International Football Group</p>
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
      'Payment Reminder - Invoice Due',
      '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <p>Hi {{first_name}},</p>
        <p>This is a friendly reminder that your invoice is due soon.</p>
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
        <p>Thank you for your payment.</p>
        <p>This email confirms that we have received your payment.</p>
        <p>If you have any questions, please contact us.</p>
        <p>Best regards,<br>IFG Finance Team</p>
      </div>',
      'transactional',
      'fixed',
      'IFG Finance',
      'finance@ifg-crm.com',
      profile_id
    )
  ON CONFLICT (name) DO NOTHING;
  
  RAISE NOTICE 'Successfully seeded email templates';
END $$;

-- Migration: seed one curated email template per AutomationType so admins
-- have a working starter set covering every flow. Idempotent — checks each
-- template name against the unique index and skips if already present.
--
-- These cover automation types that the original seed (012) didn't address:
--   - Application Received
--   - Post-Interview Thank You
--   - Payment Overdue (distinct from invoice reminder)
--   - Welcome Sequence (Day 0 / Day 3 / Day 7)
--   - Pre-Departure (1 month / 1 week / 1 day before)
--
-- Existing seed templates already cover initial_contact, follow_up, deposit_invoice,
-- interview_reminder (via Meeting Confirmation), and welcome_sequence (Welcome to IFG).

DO $$
DECLARE
  profile_id uuid;
BEGIN
  SELECT id INTO profile_id FROM profiles
   WHERE role IN ('admin', 'super_admin')
   LIMIT 1;

  IF profile_id IS NULL THEN
    SELECT id INTO profile_id FROM profiles LIMIT 1;
  END IF;

  IF profile_id IS NULL THEN
    RAISE NOTICE 'No profile found. Skipping automation template seed.';
    RETURN;
  END IF;

  -- ===========================================================
  -- Application Received
  -- ===========================================================
  IF NOT EXISTS (SELECT 1 FROM email_templates WHERE name = 'Application Received') THEN
    INSERT INTO email_templates (name, subject, body_html, category, from_name_type, created_by_id) VALUES
    (
      'Application Received',
      'We''ve received your application, {{first_name}}',
      '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a202c;">
  <h2 style="color: #1e40af;">Application Received</h2>
  <p>Hi {{first_name}},</p>
  <p>Thanks for applying to <strong>{{deal_pipeline}}</strong> with The International Football Group.
  We''ve received your application and our team is reviewing it now.</p>
  <p>You should hear back from us within <strong>3–5 business days</strong>. In the meantime, if you have any questions please reply to this email or contact me directly.</p>
  <p>Best,<br>{{deal_owner_name}}<br>{{deal_owner_title|Recruitment Specialist}}</p>
  {{#if deal_owner_calendly}}
  <p style="margin-top: 24px;">
    <a href="{{deal_owner_calendly}}" style="background: #1e40af; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">Book a quick chat</a>
  </p>
  {{/if}}
</div>',
      'automation', 'deal_owner', profile_id
    );
  END IF;

  -- ===========================================================
  -- Interview Reminder — 1 day before
  -- ===========================================================
  IF NOT EXISTS (SELECT 1 FROM email_templates WHERE name = 'Interview Reminder — 1 Day') THEN
    INSERT INTO email_templates (name, subject, body_html, category, from_name_type, created_by_id) VALUES
    (
      'Interview Reminder — 1 Day',
      'Reminder: your interview tomorrow',
      '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a202c;">
  <h2 style="color: #1e40af;">Interview Tomorrow</h2>
  <p>Hi {{first_name}},</p>
  <p>Just a quick reminder — we''re looking forward to speaking with you about <strong>{{deal_pipeline}}</strong> tomorrow.</p>
  <p style="background: #f0f9ff; border-left: 4px solid #1e40af; padding: 12px 16px; margin: 16px 0;">
    Your interviewer: <strong>{{deal_owner_name}}</strong><br>
    {{#if deal_owner_zoom}}Zoom link: <a href="{{deal_owner_zoom}}">{{deal_owner_zoom}}</a>{{/if}}
  </p>
  <p>A few things that help calls go smoothly:</p>
  <ul>
    <li>Find a quiet spot with good lighting</li>
    <li>Have your CV / academic results handy</li>
    <li>Be ready with 1–2 questions about the programme</li>
  </ul>
  <p>If anything has come up and you need to reschedule, just reply to this email.</p>
  <p>Talk soon,<br>{{deal_owner_name}}</p>
</div>',
      'automation', 'deal_owner', profile_id
    );
  END IF;

  -- ===========================================================
  -- Interview Reminder — 1 hour before
  -- ===========================================================
  IF NOT EXISTS (SELECT 1 FROM email_templates WHERE name = 'Interview Reminder — 1 Hour') THEN
    INSERT INTO email_templates (name, subject, body_html, category, from_name_type, created_by_id) VALUES
    (
      'Interview Reminder — 1 Hour',
      '{{first_name}}, we''re on in 1 hour',
      '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a202c;">
  <p>Hi {{first_name}},</p>
  <p>One hour to go! Looking forward to it.</p>
  {{#if deal_owner_zoom}}
  <p style="text-align: center; margin: 24px 0;">
    <a href="{{deal_owner_zoom}}" style="background: #1e40af; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Join the call</a>
  </p>
  {{/if}}
  <p>If you can''t see this email — link is in the calendar invite.</p>
  <p>{{deal_owner_name}}</p>
</div>',
      'automation', 'deal_owner', profile_id
    );
  END IF;

  -- ===========================================================
  -- Post-Interview Thank You
  -- ===========================================================
  IF NOT EXISTS (SELECT 1 FROM email_templates WHERE name = 'Post-Interview Thank You') THEN
    INSERT INTO email_templates (name, subject, body_html, category, from_name_type, created_by_id) VALUES
    (
      'Post-Interview Thank You',
      'Thanks for the chat, {{first_name}}',
      '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a202c;">
  <h2 style="color: #1e40af;">Great speaking with you</h2>
  <p>Hi {{first_name}},</p>
  <p>Thanks for taking the time to chat about <strong>{{deal_pipeline}}</strong>. It was great learning more about your background and what you''re looking for.</p>
  <p>Here''s what happens next:</p>
  <ol>
    <li>Our team will review your interview notes (1–2 days)</li>
    <li>I''ll send you a formal decision and any next-step paperwork</li>
    <li>If we move forward, you''ll receive an offer with a deposit invoice</li>
  </ol>
  <p>If you thought of any follow-up questions after our call, just reply here.</p>
  <p>Speak soon,<br>{{deal_owner_name}}</p>
</div>',
      'automation', 'deal_owner', profile_id
    );
  END IF;

  -- ===========================================================
  -- Payment Overdue
  -- ===========================================================
  IF NOT EXISTS (SELECT 1 FROM email_templates WHERE name = 'Payment Overdue') THEN
    INSERT INTO email_templates (name, subject, body_html, category, from_name_type, fixed_from_name, fixed_from_email, created_by_id) VALUES
    (
      'Payment Overdue',
      'Action needed: payment overdue',
      '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a202c;">
  <h2 style="color: #b91c1c;">Payment Overdue</h2>
  <p>Hi {{first_name}},</p>
  <p>Our records show that an invoice on your account is past its due date. We wanted to flag this in case it slipped through.</p>
  <p style="background: #fef2f2; border-left: 4px solid #b91c1c; padding: 12px 16px; margin: 16px 0;">
    <strong>Programme:</strong> {{deal_pipeline}}<br>
    <strong>Outstanding amount:</strong> {{deal_value}}
  </p>
  <p>Please log in to your portal to settle the balance:</p>
  <p style="text-align: center; margin: 24px 0;">
    <a href="https://ifg-crm.vercel.app/portal/invoices" style="background: #1e40af; color: white; padding: 10px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Pay now</a>
  </p>
  <p>If you''ve already paid or there''s an issue with the invoice, just reply to this email and we''ll sort it out.</p>
  <p>Many thanks,<br>The International Football Group</p>
</div>',
      'transactional', 'fixed', 'IFG Finance', 'admin@theinternationalfootballgroup.com', profile_id
    );
  END IF;

  -- ===========================================================
  -- Welcome — Day 0 (immediately after deposit)
  -- ===========================================================
  IF NOT EXISTS (SELECT 1 FROM email_templates WHERE name = 'Welcome — Day 0') THEN
    INSERT INTO email_templates (name, subject, body_html, category, from_name_type, created_by_id) VALUES
    (
      'Welcome — Day 0',
      'Welcome to IFG, {{first_name}}!',
      '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a202c;">
  <h2 style="color: #1e40af;">Welcome aboard 🎉</h2>
  <p>Hi {{first_name}},</p>
  <p>Welcome to the IFG family! We''re thrilled you''re joining <strong>{{deal_pipeline}}</strong>.</p>
  <p>Over the next few days you''ll receive a series of emails covering:</p>
  <ul>
    <li>What to expect before you arrive</li>
    <li>Documents we''ll need from you</li>
    <li>Your portal login (where you can track invoices, deals, and updates)</li>
  </ul>
  <p>If you have any questions in the meantime, your point of contact is:</p>
  <p style="background: #f0f9ff; border-left: 4px solid #1e40af; padding: 12px 16px;">
    <strong>{{deal_owner_name}}</strong><br>
    {{deal_owner_email}}<br>
    {{#if deal_owner_phone}}{{deal_owner_phone}}{{/if}}
  </p>
  <p>Talk soon,<br>{{deal_owner_name}}</p>
</div>',
      'automation', 'deal_owner', profile_id
    );
  END IF;

  -- ===========================================================
  -- Welcome — Day 3 (portal walkthrough)
  -- ===========================================================
  IF NOT EXISTS (SELECT 1 FROM email_templates WHERE name = 'Welcome — Day 3') THEN
    INSERT INTO email_templates (name, subject, body_html, category, from_name_type, created_by_id) VALUES
    (
      'Welcome — Day 3',
      'Your IFG portal — a quick tour',
      '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a202c;">
  <h2 style="color: #1e40af;">Your IFG Portal</h2>
  <p>Hi {{first_name}},</p>
  <p>Quick check-in — by now you should have received an invitation to set up your IFG portal account. If you haven''t activated it yet, please do — it''s where everything lives:</p>
  <ul>
    <li><strong>Invoices &amp; payments</strong> — see what''s due, pay online via Stripe</li>
    <li><strong>Programme info</strong> — your start date, accommodation, schedule</li>
    <li><strong>Documents</strong> — upload passport copies, consent forms</li>
  </ul>
  <p style="text-align: center; margin: 24px 0;">
    <a href="https://ifg-crm.vercel.app/portal/login" style="background: #1e40af; color: white; padding: 10px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Open portal</a>
  </p>
  <p>Can''t find the activation email? Click "Forgot password / First time logging in?" on the login page.</p>
  <p>Best,<br>{{deal_owner_name}}</p>
</div>',
      'automation', 'deal_owner', profile_id
    );
  END IF;

  -- ===========================================================
  -- Welcome — Day 7 (introduce coaches/staff)
  -- ===========================================================
  IF NOT EXISTS (SELECT 1 FROM email_templates WHERE name = 'Welcome — Day 7') THEN
    INSERT INTO email_templates (name, subject, body_html, category, from_name_type, created_by_id) VALUES
    (
      'Welcome — Day 7',
      'Meet the team you''ll be working with',
      '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a202c;">
  <h2 style="color: #1e40af;">Meet your IFG team</h2>
  <p>Hi {{first_name}},</p>
  <p>Hope your first week at IFG has been going well. Wanted to introduce the people who''ll be supporting you on <strong>{{deal_pipeline}}</strong>:</p>
  <ul>
    <li><strong>{{deal_owner_name}}</strong> — Recruitment, your main contact for paperwork &amp; logistics</li>
    <li><strong>Programme Director</strong> — Coaches, fixtures, training sessions</li>
    <li><strong>Welfare Lead</strong> — Pastoral support, accommodation, anything personal</li>
  </ul>
  <p>You''ll meet most of them in person on arrival. In the meantime, your one-stop contact is still me — {{deal_owner_email}}.</p>
  <p>Have a great week,<br>{{deal_owner_name}}</p>
</div>',
      'automation', 'deal_owner', profile_id
    );
  END IF;

  -- ===========================================================
  -- Pre-Departure — 1 Month Before
  -- ===========================================================
  IF NOT EXISTS (SELECT 1 FROM email_templates WHERE name = 'Pre-Departure — 1 Month') THEN
    INSERT INTO email_templates (name, subject, body_html, category, from_name_type, created_by_id) VALUES
    (
      'Pre-Departure — 1 Month',
      '4 weeks to go — pre-departure checklist',
      '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a202c;">
  <h2 style="color: #1e40af;">4 Weeks to Departure</h2>
  <p>Hi {{first_name}},</p>
  <p>It''s getting close — your <strong>{{deal_pipeline}}</strong> programme starts in just under a month. Here''s what to take care of in the next 4 weeks:</p>
  <h3 style="color: #1e40af; font-size: 16px;">Travel</h3>
  <ul>
    <li>Book flights and confirm arrival airport with us</li>
    <li>Check passport validity (must be 6+ months from arrival)</li>
    <li>Apply for visa if required</li>
  </ul>
  <h3 style="color: #1e40af; font-size: 16px;">Health</h3>
  <ul>
    <li>Travel/medical insurance</li>
    <li>Required vaccinations</li>
  </ul>
  <h3 style="color: #1e40af; font-size: 16px;">Documents</h3>
  <ul>
    <li>Upload passport copy + photo to your portal</li>
    <li>Sign &amp; return code-of-conduct form</li>
  </ul>
  <p>Reply with any questions — happy to help.</p>
  <p>Best,<br>{{deal_owner_name}}</p>
</div>',
      'automation', 'deal_owner', profile_id
    );
  END IF;

  -- ===========================================================
  -- Pre-Departure — 1 Week Before
  -- ===========================================================
  IF NOT EXISTS (SELECT 1 FROM email_templates WHERE name = 'Pre-Departure — 1 Week') THEN
    INSERT INTO email_templates (name, subject, body_html, category, from_name_type, created_by_id) VALUES
    (
      'Pre-Departure — 1 Week',
      '7 days to go — final checklist',
      '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a202c;">
  <h2 style="color: #1e40af;">One Week to Go</h2>
  <p>Hi {{first_name}},</p>
  <p>One week until you arrive for <strong>{{deal_pipeline}}</strong>. A few last-minute reminders:</p>
  <ul>
    <li>Pack training kit (boots, shin pads, gloves if you''re a keeper)</li>
    <li>Bring your passport &amp; visa documents</li>
    <li>UK plug adapter (Type G)</li>
    <li>Some local currency for the first day</li>
  </ul>
  <p>On arrival, head to the meeting point we sent you. Someone from the IFG team will be there with a name board.</p>
  <p>Safe travels,<br>{{deal_owner_name}}</p>
</div>',
      'automation', 'deal_owner', profile_id
    );
  END IF;

  -- ===========================================================
  -- Pre-Departure — 1 Day Before (arrival)
  -- ===========================================================
  IF NOT EXISTS (SELECT 1 FROM email_templates WHERE name = 'Pre-Departure — 1 Day') THEN
    INSERT INTO email_templates (name, subject, body_html, category, from_name_type, created_by_id) VALUES
    (
      'Pre-Departure — 1 Day',
      'See you tomorrow, {{first_name}}!',
      '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a202c;">
  <h2 style="color: #1e40af;">See you tomorrow!</h2>
  <p>Hi {{first_name}},</p>
  <p>This is the last email before you arrive — just want to say we''re really excited to have you joining us.</p>
  <p style="background: #f0f9ff; border-left: 4px solid #1e40af; padding: 12px 16px; margin: 16px 0;">
    <strong>Emergency contact (24/7):</strong><br>
    {{deal_owner_name}}<br>
    {{deal_owner_email}}<br>
    {{#if deal_owner_phone}}{{deal_owner_phone}}{{/if}}
  </p>
  <p>If anything changes with your flight or you can''t find us at the meeting point, message me directly.</p>
  <p>Safe flight!<br>{{deal_owner_name}}</p>
</div>',
      'automation', 'deal_owner', profile_id
    );
  END IF;

  RAISE NOTICE 'Automation templates seeded successfully.';
END $$;

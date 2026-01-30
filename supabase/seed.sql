-- Seed Programmes
INSERT INTO programmes (id, name, type, sport, description, default_deposit_amount, default_total_cost, university_partner) VALUES
  ('11111111-1111-1111-1111-111111111111', 'UCLan 2026', 'university', 'football', 'University of Central Lancashire Football Programme', 1000.00, 15000.00, 'UCLan'),
  ('22222222-2222-2222-2222-222222222222', 'Salford 2026', 'university', 'football', 'University of Salford Football Programme', 1000.00, 14000.00, 'Salford'),
  ('33333333-3333-3333-3333-333333333333', 'UK Gap Year 2026', 'gap_year', 'football', 'Gap Year Football Programme in the UK', 1500.00, 18000.00, NULL),
  ('44444444-4444-4444-4444-444444444444', 'UK Residency 2026', 'residency', 'football', 'UK Football Residency Programme', 1000.00, 12000.00, NULL),
  ('55555555-5555-5555-5555-555555555555', 'Summer Residency 2026', 'camp', 'football', 'Summer Training Camp', 500.00, 3000.00, NULL);

-- Seed Pipelines
INSERT INTO pipelines (id, name, programme_id, sport, display_order) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'UCLan 2026', '11111111-1111-1111-1111-111111111111', 'football', 1),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Salford 2026', '22222222-2222-2222-2222-222222222222', 'football', 2),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'UK Gap Year 2026', '33333333-3333-3333-3333-333333333333', 'football', 3),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'UK Residency 2026', '44444444-4444-4444-4444-444444444444', 'football', 4);

-- Seed Pipeline Stages for UCLan 2026
INSERT INTO pipeline_stages (pipeline_id, name, stage_type, triggers_automation, display_order, color) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Initial Lead', 'lead', true, 1, '#14b8a6'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'In Contact', 'contact', false, 2, '#14b8a6'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Zoom Scheduled', 'meeting', false, 3, '#eab308'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Rescheduled Zoom', 'meeting', false, 4, '#f97316'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Follow Up', 'follow_up', true, 5, '#f472b6'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Collecting Documents', 'documents', false, 6, '#a855f7'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Applied', 'applied', false, 7, '#3b82f6'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Conditional Offer', 'offer', false, 8, '#22c55e'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Deposit Paid', 'payment', false, 9, '#22c55e'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Dormant Lead', 'dormant', false, 10, '#6b7280');

-- Seed Pipeline Stages for Salford 2026 (same structure)
INSERT INTO pipeline_stages (pipeline_id, name, stage_type, triggers_automation, display_order, color) VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Initial Lead', 'lead', true, 1, '#14b8a6'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'In Contact', 'contact', false, 2, '#14b8a6'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Zoom Scheduled', 'meeting', false, 3, '#eab308'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Rescheduled Zoom', 'meeting', false, 4, '#f97316'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Follow Up', 'follow_up', true, 5, '#f472b6'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Collecting Documents', 'documents', false, 6, '#a855f7'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Applied', 'applied', false, 7, '#3b82f6'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Conditional Offer', 'offer', false, 8, '#22c55e'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Deposit Paid', 'payment', false, 9, '#22c55e'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Dormant Lead', 'dormant', false, 10, '#6b7280');

-- Seed Pipeline Stages for UK Gap Year 2026
INSERT INTO pipeline_stages (pipeline_id, name, stage_type, triggers_automation, display_order, color) VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Initial Lead', 'lead', true, 1, '#14b8a6'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'In Contact', 'contact', false, 2, '#14b8a6'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Zoom Scheduled', 'meeting', false, 3, '#eab308'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Rescheduled Zoom', 'meeting', false, 4, '#f97316'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Follow Up', 'follow_up', true, 5, '#f472b6'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Collecting Documents', 'documents', false, 6, '#a855f7'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Applied', 'applied', false, 7, '#3b82f6'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Conditional Offer', 'offer', false, 8, '#22c55e'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Deposit Paid', 'payment', false, 9, '#22c55e'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Dormant Lead', 'dormant', false, 10, '#6b7280');

-- Seed Pipeline Stages for UK Residency 2026
INSERT INTO pipeline_stages (pipeline_id, name, stage_type, triggers_automation, display_order, color) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Initial Lead', 'lead', true, 1, '#14b8a6'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'In Contact', 'contact', false, 2, '#14b8a6'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Zoom Scheduled', 'meeting', false, 3, '#eab308'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Rescheduled Zoom', 'meeting', false, 4, '#f97316'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Follow Up', 'follow_up', true, 5, '#f472b6'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Collecting Documents', 'documents', false, 6, '#a855f7'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Applied', 'applied', false, 7, '#3b82f6'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Conditional Offer', 'offer', false, 8, '#22c55e'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Deposit Paid', 'payment', false, 9, '#22c55e'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Dormant Lead', 'dormant', false, 10, '#6b7280');

-- Seed Lists
INSERT INTO lists (name, description, sport) VALUES
  ('All Contacts Everyone', 'Master list of all contacts', 'football'),
  ('Male 2025', 'Male players graduating 2025', 'football'),
  ('Male 2026', 'Male players graduating 2026', 'football'),
  ('Male 2027', 'Male players graduating 2027', 'football'),
  ('Female 2025', 'Female players graduating 2025', 'football'),
  ('Female 2026', 'Female players graduating 2026', 'football'),
  ('Female 2027', 'Female players graduating 2027', 'football'),
  ('All Boys', 'All male players', 'football'),
  ('All Girls', 'All female players', 'football');

-- Seed Tags
INSERT INTO tags (name, color, category) VALUES
  ('Surf Cup 2025', '#3b82f6', 'tournament'),
  ('NorCal', '#22c55e', 'tournament'),
  ('San Diego', '#f97316', 'tournament'),
  ('GF Cup 2025', '#a855f7', 'tournament'),
  ('High Priority', '#ef4444', 'priority'),
  ('Scholarship', '#eab308', 'priority'),
  ('Left Footed', '#14b8a6', 'skill'),
  ('Goalkeeper', '#6366f1', 'skill');

-- Seed Payment Plans
INSERT INTO payment_plans (name, programme_id, total_amount, deposit_amount, installment_count, installment_frequency) VALUES
  ('Plan A - Monthly x5', NULL, 15000.00, 1000.00, 5, 'monthly'),
  ('Plan B - Quarterly x3', NULL, 15000.00, 1500.00, 3, 'quarterly'),
  ('Plan C - Pay in Full', NULL, 14000.00, 14000.00, 1, 'monthly');

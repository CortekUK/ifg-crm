-- The Summer Residency deposit invoice includes the card fee, as the website does.
--
-- The website grosses the £2,000 up to £2,072.75 so the bank nets the full
-- deposit (3.5% + 20p, website_pricing_settings). The invoice charged £2,000
-- flat and the bank received less. Other invoice automations are unchanged;
-- each can opt in from the automation editor.

UPDATE automations
SET config = config || '{"invoice_add_card_fee": true}'::jsonb
WHERE id = '814842db-19cf-4e43-8ec6-000199934278';

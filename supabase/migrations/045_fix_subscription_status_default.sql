-- Fix mismatch: default was 'active' but check constraint only allows 'subscribed'/'unsubscribed'
ALTER TABLE contacts ALTER COLUMN subscription_status SET DEFAULT 'subscribed';

-- Sample contacts for testing
-- Run this in the Supabase SQL Editor to add test contacts

INSERT INTO contacts (email, first_name, last_name, phone, graduation_year, gender, country, state, city, club_name, position, source, sport, subscription_status) VALUES
('john.smith@example.com', 'John', 'Smith', '+1234567890', 2026, 'male', 'United States', 'California', 'Los Angeles', 'LA Galaxy Academy', 'Midfielder', 'website_form', 'football', 'active'),
('emma.wilson@example.com', 'Emma', 'Wilson', '+1234567891', 2026, 'female', 'United States', 'Texas', 'Houston', 'Houston Dynamo Youth', 'Forward', 'website_form', 'football', 'active'),
('james.brown@example.com', 'James', 'Brown', '+447123456789', 2025, 'male', 'United Kingdom', NULL, 'London', 'Chelsea Academy', 'Defender', 'manual', 'football', 'active'),
('olivia.jones@example.com', 'Olivia', 'Jones', '+1234567893', 2027, 'female', 'Canada', 'Ontario', 'Toronto', 'Toronto FC Academy', 'Goalkeeper', 'sms_reply', 'football', 'active'),
('william.davis@example.com', 'William', 'Davis', '+1234567894', 2026, 'male', 'United States', 'Florida', 'Miami', 'Inter Miami CF', 'Midfielder', 'csv_import', 'football', 'active'),
('sophia.martinez@example.com', 'Sophia', 'Martinez', '+1234567895', 2026, 'female', 'Spain', NULL, 'Madrid', 'Real Madrid Femenino', 'Forward', 'email_reply', 'football', 'active'),
('benjamin.taylor@example.com', 'Benjamin', 'Taylor', '+61234567896', 2025, 'male', 'Australia', 'Victoria', 'Melbourne', 'Melbourne Victory', 'Defender', 'website_form', 'football', 'active'),
('isabella.anderson@example.com', 'Isabella', 'Anderson', '+1234567897', 2027, 'female', 'United States', 'New York', 'New York', 'NY Red Bulls Academy', 'Midfielder', 'manual', 'football', 'unsubscribed'),
('lucas.thomas@example.com', 'Lucas', 'Thomas', '+33123456789', 2026, 'male', 'France', NULL, 'Paris', 'PSG Academy', 'Forward', 'csv_import', 'football', 'active'),
('mia.jackson@example.com', 'Mia', 'Jackson', '+1234567899', 2026, 'female', 'United States', 'California', 'San Diego', 'San Diego FC Youth', 'Defender', 'website_form', 'football', 'active');

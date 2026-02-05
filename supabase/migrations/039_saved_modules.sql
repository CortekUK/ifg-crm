-- Saved email template modules (reusable blocks)
CREATE TABLE IF NOT EXISTS email_template_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    -- The block configuration (type and content)
    block_type VARCHAR(50) NOT NULL,
    block_content JSONB NOT NULL,
    -- Thumbnail/preview (optional)
    thumbnail_url TEXT,
    -- Metadata
    created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_template_modules_created_by ON email_template_modules(created_by_id);
CREATE INDEX IF NOT EXISTS idx_email_template_modules_block_type ON email_template_modules(block_type);

-- RLS policies
ALTER TABLE email_template_modules ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read modules
CREATE POLICY "Users can view all modules" ON email_template_modules
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Allow users to create modules
CREATE POLICY "Users can create modules" ON email_template_modules
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Allow users to update their own modules
CREATE POLICY "Users can update own modules" ON email_template_modules
    FOR UPDATE
    USING (created_by_id = auth.uid());

-- Allow users to delete their own modules
CREATE POLICY "Users can delete own modules" ON email_template_modules
    FOR DELETE
    USING (created_by_id = auth.uid());

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_email_template_modules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_email_template_modules_timestamp
    BEFORE UPDATE ON email_template_modules
    FOR EACH ROW
    EXECUTE FUNCTION update_email_template_modules_updated_at();

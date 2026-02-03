-- Migration: Populate body_json for existing templates
-- Converts existing body_html templates to have editable body_json blocks

DO $$
DECLARE
  template_record RECORD;
  html_content TEXT;
  json_blocks JSONB;
BEGIN
  -- Loop through all templates that have body_html but missing body_json
  FOR template_record IN 
    SELECT id, name, body_html
    FROM email_templates
    WHERE body_json IS NULL AND body_html IS NOT NULL
  LOOP
    -- Extract text content from HTML (simple approach - strip tags)
    html_content := template_record.body_html;
    
    -- Remove HTML tags and convert to plain text
    html_content := regexp_replace(html_content, '<[^>]+>', '', 'g');
    -- Clean up extra whitespace
    html_content := regexp_replace(html_content, '\s+', ' ', 'g');
    html_content := trim(html_content);
    
    -- Create a simple text block with the HTML content
    -- This allows templates to be edited while preserving the original HTML
    json_blocks := jsonb_build_array(
      jsonb_build_object(
        'id', 'block_' || replace(gen_random_uuid()::text, '-', ''),
        'type', 'text',
        'content', jsonb_build_object(
          'text', html_content,
          'fontSize', 14,
          'lineHeight', 1.6,
          'textAlign', 'left',
          'color', '#000000',
          'padding', jsonb_build_object(
            'top', 16,
            'right', 16,
            'bottom', 16,
            'left', 16
          )
        )
      )
    );
    
    -- Update the template with the generated body_json
    UPDATE email_templates
    SET body_json = json_blocks
    WHERE id = template_record.id;
    
    RAISE NOTICE 'Populated body_json for template: %', template_record.name;
  END LOOP;
  
  RAISE NOTICE 'Successfully populated body_json for all templates';
END $$;

-- Add a comment explaining this migration
COMMENT ON COLUMN email_templates.body_json IS 
'JSON array of editor blocks. Required for template editing. If null, template can only be previewed/sent, not edited.';

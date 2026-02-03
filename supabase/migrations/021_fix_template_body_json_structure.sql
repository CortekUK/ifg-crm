-- Migration: Fix body_json structure to match editor block types
-- Corrects the block structure created in migration 020

DO $$
DECLARE
  template_record RECORD;
  html_content TEXT;
  json_blocks JSONB;
BEGIN
  -- Loop through all templates and recreate body_json with correct structure
  FOR template_record IN 
    SELECT id, name, body_html
    FROM email_templates
    WHERE body_html IS NOT NULL
  LOOP
    -- Use the body_html directly as the content for a text block
    html_content := template_record.body_html;
    
    -- Create a text block with the correct structure matching EditorBlock interface
    json_blocks := jsonb_build_array(
      jsonb_build_object(
        'id', 'block_' || replace(gen_random_uuid()::text, '-', ''),
        'type', 'text',
        'content', jsonb_build_object(
          'html', html_content,
          'alignment', 'left',
          'fontSize', 'normal',
          'paddingTop', 10,
          'paddingBottom', 10
        )
      )
    );
    
    -- Update the template with the corrected body_json
    UPDATE email_templates
    SET body_json = json_blocks
    WHERE id = template_record.id;
    
    RAISE NOTICE 'Fixed body_json structure for template: %', template_record.name;
  END LOOP;
  
  RAISE NOTICE 'Successfully fixed body_json structure for all templates';
END $$;

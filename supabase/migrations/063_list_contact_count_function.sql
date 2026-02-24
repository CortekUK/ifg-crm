-- Function to return contact counts per list efficiently
-- Avoids the 1000-row default limit issue when counting client-side
CREATE OR REPLACE FUNCTION get_list_contact_counts()
RETURNS TABLE(list_id UUID, contact_count BIGINT)
LANGUAGE sql STABLE
AS $$
  SELECT cl.list_id, COUNT(*) AS contact_count
  FROM contact_lists cl
  GROUP BY cl.list_id;
$$;

GRANT EXECUTE ON FUNCTION get_list_contact_counts() TO authenticated;

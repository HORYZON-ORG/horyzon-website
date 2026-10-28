-- Canonical Architetti source; separate managed migration, NOT the Platform mail runner.
-- Read-only directory lookup. No account, membership, table grant, or business data is changed.
CREATE FUNCTION hub.architetti_search_accounts(p_query text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT hub.is_superadmin() THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_query IS NULL OR char_length(btrim(p_query)) < 2 OR char_length(btrim(p_query)) > 120 THEN
    RAISE EXCEPTION 'INVALID_QUERY' USING ERRCODE = '22023';
  END IF;
  WITH candidates AS (
    SELECT a.id, a.email,
      coalesce(nullif(btrim(u.display_name), ''), nullif(btrim(a.raw_user_meta_data->>'full_name'), ''),
        nullif(btrim(a.raw_user_meta_data->>'name'), ''), a.email) AS display_name,
      translate(lower(concat_ws(' ', u.display_name, a.raw_user_meta_data->>'full_name',
        a.raw_user_meta_data->>'name', a.email)), 'àáâäãåèéêëìíîïòóôöõùúûüçñ', 'aaaaaaeeeeiiiiooooouuuucn') AS searchable
    FROM auth.users a
    LEFT JOIN public.users u ON u.id = a.id
    WHERE a.email IS NOT NULL AND a.deleted_at IS NULL
      AND coalesce(a.is_anonymous, false) = false
      AND (a.banned_until IS NULL OR a.banned_until <= now())
      AND u.disabled_at IS NULL
  ), matches AS (
    SELECT c.id, c.email, c.display_name
    FROM candidates c
    WHERE NOT EXISTS (
      SELECT 1 FROM unnest(regexp_split_to_array(translate(lower(btrim(p_query)),
        'àáâäãåèéêëìíîïòóôöõùúûüçñ', 'aaaaaaeeeeiiiiooooouuuucn'), '\s+')) AS term(value)
      WHERE strpos(c.searchable, term.value) = 0
    )
    ORDER BY (lower(c.email) = lower(btrim(p_query))) DESC, lower(c.display_name), c.id
    LIMIT 11
  ), numbered AS (
    SELECT *, row_number() OVER () AS position FROM matches
  )
  SELECT jsonb_build_object(
    'accounts', coalesce(jsonb_agg(jsonb_build_object('id', id, 'displayName', display_name, 'email', email)
      ORDER BY position) FILTER (WHERE position <= 10), '[]'::jsonb),
    'more', count(*) > 10
  ) INTO result FROM numbered;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION hub.architetti_search_accounts(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION hub.architetti_search_accounts(text) TO authenticated;
COMMENT ON FUNCTION hub.architetti_search_accounts(text) IS
  'Hub superadmins only: minimal account search for explicit architect enablement. No writes.';

-- Rollback, if ever needed: DROP FUNCTION hub.architetti_search_accounts(text);

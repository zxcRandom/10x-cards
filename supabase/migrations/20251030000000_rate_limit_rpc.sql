-- Create rate_limits table
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  reset_at BIGINT NOT NULL
);

-- Enable RLS but no policies for direct access (access only via RPC)
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Function to increment rate limit
CREATE OR REPLACE FUNCTION increment_rate_limit(p_key TEXT, p_window_ms INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  now_ms BIGINT := (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT;
BEGIN
  INSERT INTO rate_limits (key, count, reset_at)
  VALUES (p_key, 1, now_ms + p_window_ms)
  ON CONFLICT (key) DO UPDATE
  SET
    count = CASE
      WHEN rate_limits.reset_at < (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT THEN 1 -- expired
      ELSE rate_limits.count + 1
    END,
    reset_at = CASE
      WHEN rate_limits.reset_at < (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT THEN (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT + p_window_ms -- new window
      ELSE rate_limits.reset_at
    END;
END;
$$;

-- Function to check rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(p_key TEXT)
RETURNS TABLE (count INTEGER, reset_at BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT rate_limits.count, rate_limits.reset_at FROM rate_limits WHERE key = p_key;
END;
$$;

-- Grant execute permissions only to service_role (admin)
REVOKE EXECUTE ON FUNCTION increment_rate_limit(TEXT, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION check_rate_limit(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_rate_limit(TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION check_rate_limit(TEXT) TO service_role;

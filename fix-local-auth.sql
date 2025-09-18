-- Fix local development authentication for RLS
-- Replace get_current_user_id with session-based function

CREATE OR REPLACE FUNCTION get_session_user_id() RETURNS TEXT AS $func$
DECLARE
  jwt_user_id TEXT;
  session_user_id TEXT;
BEGIN
  -- Try to get user from JWT
  jwt_user_id := COALESCE(current_setting('request.jwt.claims', true)::json->>'sub', '');
  
  IF jwt_user_id IS NOT NULL AND jwt_user_id != '' THEN
    RETURN jwt_user_id;
  END IF;
  
  -- Fallback: get from custom session setting for local development
  session_user_id := COALESCE(current_setting('session.user_id', true), '');
  
  RETURN session_user_id;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update chat_participants policies to use new function
DROP POLICY IF EXISTS "Users can view own participations" ON chat_participants;
CREATE POLICY "Users can view own participations" ON chat_participants
  FOR SELECT USING (
    get_session_user_id() IS NOT NULL AND 
    get_session_user_id() != '' AND 
    user_id = get_session_user_id()
  );

-- Also allow service role to bypass RLS for testing
DROP POLICY IF EXISTS "Service role can access all" ON chat_participants;
CREATE POLICY "Service role can access all" ON chat_participants
  FOR ALL USING (current_user = 'service_role');

SELECT 'Local auth function created successfully' as result;
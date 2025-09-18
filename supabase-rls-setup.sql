-- RLS (Row Level Security) Setup for Production

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user ID from auth
CREATE OR REPLACE FUNCTION get_current_user_id() RETURNS TEXT AS $$
  SELECT COALESCE(auth.uid()::TEXT, '');
$$ LANGUAGE sql SECURITY DEFINER;

-- Users table policies
CREATE POLICY "Users can view all profiles" ON public.users
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (id::TEXT = get_current_user_id());

CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (true);

-- Chat participants policies
CREATE POLICY "Users can view own participations" ON public.chat_participants
  FOR SELECT USING (user_id::TEXT = get_current_user_id());

CREATE POLICY "Users can join chats" ON public.chat_participants
  FOR INSERT WITH CHECK (user_id::TEXT = get_current_user_id());

-- Chats policies
CREATE POLICY "Users can view chats they participate in" ON public.chats
  FOR SELECT USING (
    id IN (
      SELECT chat_id FROM chat_participants 
      WHERE user_id::TEXT = get_current_user_id()
    )
  );

CREATE POLICY "Users can create chats" ON public.chats
  FOR INSERT WITH CHECK (created_by::TEXT = get_current_user_id());

-- Messages policies
CREATE POLICY "Users can view messages in their chats" ON public.messages
  FOR SELECT USING (
    chat_id IN (
      SELECT chat_id FROM chat_participants 
      WHERE user_id::TEXT = get_current_user_id()
    )
  );

CREATE POLICY "Users can send messages to their chats" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id::TEXT = get_current_user_id() AND
    chat_id IN (
      SELECT chat_id FROM chat_participants 
      WHERE user_id::TEXT = get_current_user_id()
    )
  );

-- User wallets policies
CREATE POLICY "Users can view own wallet" ON public.user_wallets
  FOR SELECT USING (user_id = get_current_user_id());

CREATE POLICY "Users can create own wallet" ON public.user_wallets
  FOR INSERT WITH CHECK (user_id = get_current_user_id());

CREATE POLICY "Users can update own wallet" ON public.user_wallets
  FOR UPDATE USING (user_id = get_current_user_id());

-- Storage policies
CREATE POLICY "Avatar uploads are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload own avatars" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::TEXT IS NOT NULL);

SELECT 'RLS policies created successfully!' as result;
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create users table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  full_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  unique_id TEXT UNIQUE NOT NULL,
  password_hash TEXT, -- Argon2id hash
  public_key TEXT, -- Kyber1024 public key
  status TEXT DEFAULT 'offline',
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Quantum Keys table для постквантового шифрования
CREATE TABLE IF NOT EXISTS public.quantum_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL, -- Kyber1024 public key (base64)
  secret_key TEXT NOT NULL, -- Kyber1024 secret key (base64)
  key_type TEXT DEFAULT 'kyber1024',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Реальная таблица wallets с квантовым шифрованием
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  public_key TEXT NOT NULL, -- Stellar public key
  encrypted_secret_key TEXT NOT NULL, -- Quantum-encrypted Stellar secret key
  encryption_type TEXT DEFAULT 'quantum_kyber1024_chacha20',
  asset_code TEXT DEFAULT 'XLM',
  balance DECIMAL(20, 7) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Add transactions table for Stellar operations
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  transaction_hash TEXT UNIQUE NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  amount DECIMAL(20, 7) NOT NULL,
  asset TEXT DEFAULT 'XLM',
  memo TEXT,
  status TEXT DEFAULT 'pending', -- pending, completed, failed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create chats table
CREATE TABLE IF NOT EXISTS public.chats (
  id SERIAL PRIMARY KEY,
  name TEXT,
  type TEXT DEFAULT 'direct', -- direct, group
  avatar_url TEXT,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create chat_participants table
CREATE TABLE IF NOT EXISTS public.chat_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id INTEGER REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT DEFAULT 'member', -- admin, member
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(chat_id, user_id)
);

-- Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id INTEGER REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id TEXT,
  content TEXT,
  encrypted_content TEXT,
  type TEXT DEFAULT 'text', -- text, image, video, audio, file, crypto_transfer
  metadata JSONB DEFAULT '{}',
  is_encrypted BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create calls table
CREATE TABLE IF NOT EXISTS public.calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  caller_id TEXT,
  receiver_id TEXT,
  type TEXT DEFAULT 'voice', -- voice, video
  status TEXT DEFAULT 'pending', -- pending, accepted, declined, missed, ended
  duration INTEGER DEFAULT 0, -- in seconds
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create crypto_transactions table
CREATE TABLE IF NOT EXISTS public.crypto_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_user_id TEXT,
  to_user_id TEXT,
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
  amount DECIMAL(20, 7) NOT NULL,
  asset_code TEXT DEFAULT 'XLM',
  transaction_hash TEXT,
  status TEXT DEFAULT 'pending', -- pending, completed, failed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat-media', 'chat-media', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat-files', 'chat-files', true)
ON CONFLICT (id) DO NOTHING;

-- ⚠️ ПОЛНОСТЬЮ ОТКЛЮЧАЕМ RLS ДЛЯ РАЗРАБОТКИ ⚠️
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.quantum_keys DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.crypto_transactions DISABLE ROW LEVEL SECURITY;

-- Удаляем все существующие политики
DROP POLICY IF EXISTS "Allow all users operations" ON public.users;
DROP POLICY IF EXISTS "Allow all quantum_keys operations" ON public.quantum_keys;
DROP POLICY IF EXISTS "Allow all wallets operations" ON public.wallets;
DROP POLICY IF EXISTS "Allow all transactions operations" ON public.transactions;
DROP POLICY IF EXISTS "Allow all messages operations" ON public.messages;
DROP POLICY IF EXISTS "Allow all calls operations" ON public.calls;
DROP POLICY IF EXISTS "Allow all chats operations" ON public.chats;
DROP POLICY IF EXISTS "Allow all chat_participants operations" ON public.chat_participants;
DROP POLICY IF EXISTS "Allow all crypto_transactions operations" ON public.crypto_transactions;

-- Удаляем старые политики если есть
DROP POLICY IF EXISTS "Users can view all users" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert themselves" ON public.users;
DROP POLICY IF EXISTS "Users can view own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Users can create own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Users can update own wallet" ON public.wallets;

-- Storage policies (оставляем простые)
DROP POLICY IF EXISTS "Anyone can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;

CREATE POLICY "Public storage access" ON storage.objects
  FOR ALL USING (true) WITH CHECK (true);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_quantum_keys_user_id ON public.quantum_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON public.wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_hash ON public.transactions(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON public.messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_participants_chat_id ON public.chat_participants(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_user_id ON public.chat_participants(user_id);

-- Add updated_at trigger for wallets and quantum_keys
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON public.wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quantum_keys_updated_at BEFORE UPDATE ON public.quantum_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 
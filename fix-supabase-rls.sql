-- 🚨 ОТКЛЮЧЕНИЕ RLS ДЛЯ РАЗРАБОТКИ 🚨
-- Выполните этот скрипт в Supabase Dashboard > SQL Editor

-- Отключаем RLS на всех таблицах
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.crypto_transactions DISABLE ROW LEVEL SECURITY;

-- Удаляем все существующие политики
DROP POLICY IF EXISTS "Allow all users operations" ON public.users;
DROP POLICY IF EXISTS "Allow all wallets operations" ON public.wallets;
DROP POLICY IF EXISTS "Allow all transactions operations" ON public.transactions;
DROP POLICY IF EXISTS "Allow all messages operations" ON public.messages;
DROP POLICY IF EXISTS "Allow all calls operations" ON public.calls;
DROP POLICY IF EXISTS "Allow all chats operations" ON public.chats;
DROP POLICY IF EXISTS "Allow all chat_participants operations" ON public.chat_participants;
DROP POLICY IF EXISTS "Allow all crypto_transactions operations" ON public.crypto_transactions;

-- Удаляем старые политики
DROP POLICY IF EXISTS "Users can view all users" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert themselves" ON public.users;
DROP POLICY IF EXISTS "Users can view own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Users can create own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Users can update own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can create transactions" ON public.transactions;

-- Обновляем структуру таблицы wallets если нужно
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  public_key TEXT NOT NULL,
  secret_key TEXT NOT NULL,
  asset_code TEXT DEFAULT 'XLM',
  balance DECIMAL(20, 7) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Создаем таблицу transactions если не существует
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  transaction_hash TEXT UNIQUE NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  amount DECIMAL(20, 7) NOT NULL,
  asset TEXT DEFAULT 'XLM',
  memo TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Проверяем результат
SELECT 'RLS отключен для всех таблиц!' as result; 
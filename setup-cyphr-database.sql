-- CYPHR MESSENGER DATABASE SETUP
-- Run this in Supabase SQL Editor

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop existing tables if they exist (careful in production!)
DROP TABLE IF EXISTS message_status CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS chat_participants CASCADE;
DROP TABLE IF EXISTS chats CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS user_wallets CASCADE;
DROP TABLE IF EXISTS calls CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(20) UNIQUE NOT NULL,
    phone_hash VARCHAR(255),
    full_name VARCHAR(255),
    nickname VARCHAR(100),
    avatar_url TEXT,
    unique_id VARCHAR(100) UNIQUE,
    public_key TEXT,
    encrypted_private_key TEXT,
    status VARCHAR(20) DEFAULT 'offline',
    is_online BOOLEAN DEFAULT false,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    socket_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create chats table
CREATE TABLE chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(20) DEFAULT 'direct', -- 'direct' or 'group'
    name VARCHAR(255),
    avatar_url TEXT,
    last_message_id UUID,
    last_message_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create chat_participants table
CREATE TABLE chat_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    role VARCHAR(20) DEFAULT 'member', -- 'admin', 'member'
    UNIQUE(chat_id, user_id)
);

-- Create messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
    content TEXT NOT NULL, -- Encrypted content
    type VARCHAR(20) DEFAULT 'text', -- 'text', 'image', 'video', 'file', 'crypto'
    metadata JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'sent',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create message_status table
CREATE TABLE message_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'delivered', -- 'delivered', 'read'
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(message_id, user_id)
);

-- Create user_wallets table
CREATE TABLE user_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    stellar_address VARCHAR(56) UNIQUE,
    encrypted_seed TEXT, -- Encrypted with user's PIN
    encrypted_mnemonic TEXT, -- Encrypted backup phrase
    balance_cache JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create transactions table
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20), -- 'send', 'receive'
    asset_code VARCHAR(12),
    amount DECIMAL(20, 7),
    from_address VARCHAR(56),
    to_address VARCHAR(56),
    memo TEXT,
    transaction_hash VARCHAR(64) UNIQUE,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create calls table
CREATE TABLE calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    caller_id UUID REFERENCES users(id) ON DELETE SET NULL,
    callee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    type VARCHAR(20), -- 'voice', 'video'
    status VARCHAR(20) DEFAULT 'ringing', -- 'ringing', 'connected', 'ended', 'missed'
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_unique_id ON users(unique_id);
CREATE INDEX idx_messages_chat_id ON messages(chat_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_chat_participants_user_id ON chat_participants(user_id);
CREATE INDEX idx_chat_participants_chat_id ON chat_participants(chat_id);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_calls_caller_id ON calls(caller_id);
CREATE INDEX idx_calls_callee_id ON calls(callee_id);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (temporarily allow all for development)
-- In production, these should be more restrictive

-- Users policies
CREATE POLICY "Users can view all users" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (true);
CREATE POLICY "Users can insert" ON users FOR INSERT WITH CHECK (true);

-- Chats policies
CREATE POLICY "View chats" ON chats FOR SELECT USING (true);
CREATE POLICY "Create chats" ON chats FOR INSERT WITH CHECK (true);
CREATE POLICY "Update chats" ON chats FOR UPDATE USING (true);

-- Chat participants policies
CREATE POLICY "View participants" ON chat_participants FOR SELECT USING (true);
CREATE POLICY "Add participants" ON chat_participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Remove participants" ON chat_participants FOR DELETE USING (true);

-- Messages policies
CREATE POLICY "View messages" ON messages FOR SELECT USING (true);
CREATE POLICY "Send messages" ON messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Update messages" ON messages FOR UPDATE USING (true);

-- Message status policies
CREATE POLICY "View status" ON message_status FOR SELECT USING (true);
CREATE POLICY "Update status" ON message_status FOR INSERT WITH CHECK (true);
CREATE POLICY "Modify status" ON message_status FOR UPDATE USING (true);

-- Wallets policies
CREATE POLICY "View wallets" ON user_wallets FOR SELECT USING (true);
CREATE POLICY "Create wallets" ON user_wallets FOR INSERT WITH CHECK (true);
CREATE POLICY "Update wallets" ON user_wallets FOR UPDATE USING (true);

-- Transactions policies
CREATE POLICY "View transactions" ON transactions FOR SELECT USING (true);
CREATE POLICY "Create transactions" ON transactions FOR INSERT WITH CHECK (true);

-- Calls policies
CREATE POLICY "View calls" ON calls FOR SELECT USING (true);
CREATE POLICY "Create calls" ON calls FOR INSERT WITH CHECK (true);
CREATE POLICY "Update calls" ON calls FOR UPDATE USING (true);

-- Create storage buckets for media (if not exists)
INSERT INTO storage.buckets (id, name, public) 
VALUES 
    ('avatars', 'avatars', true),
    ('chat-media', 'chat-media', false),
    ('voice-messages', 'voice-messages', false)
ON CONFLICT (id) DO NOTHING;

-- Success message
SELECT 'Database setup complete! All tables and policies created.' as status;
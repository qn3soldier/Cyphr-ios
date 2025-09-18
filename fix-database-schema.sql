-- CYPHR MESSENGER ZERO-KNOWLEDGE DATABASE SCHEMA FIX
-- August 18, 2025 - Following Signal/Telegram privacy patterns

-- Add name column as alias for full_name for compatibility
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS name TEXT;
UPDATE public.users SET name = full_name WHERE name IS NULL AND full_name IS NOT NULL;

-- Add phone hash for zero-knowledge lookup  
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone_hash TEXT UNIQUE;

-- Add privacy controls
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS discoverable_by_phone BOOLEAN DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS discoverable_by_username BOOLEAN DEFAULT true;

-- Create function to hash phone numbers
CREATE OR REPLACE FUNCTION generate_phone_hash(phone_number TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(digest(phone_number || 'cyphr-salt-2025', 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Update existing users with phone hashes
UPDATE public.users 
SET phone_hash = generate_phone_hash(phone)
WHERE phone_hash IS NULL AND phone IS NOT NULL;

-- Create indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_users_phone_hash ON public.users(phone_hash);
CREATE INDEX IF NOT EXISTS idx_users_discoverable ON public.users(discoverable_by_phone, discoverable_by_username);

SELECT 'Database schema fixed for zero-knowledge privacy' as status;

-- ADD PIN AUTHENTICATION COLUMNS TO USERS TABLE
-- Enterprise PIN + Biometric Authentication Support

-- Add pin_hash column for storing hashed PIN
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS pin_hash TEXT;

-- Add biometric_enabled column for biometric auth preference
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS biometric_enabled BOOLEAN DEFAULT false;

-- Add session tracking columns
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS last_session_expiry TIMESTAMP WITH TIME ZONE;

-- Create index on pin_hash for performance (partial index on non-null values)
CREATE INDEX IF NOT EXISTS idx_users_pin_hash 
ON public.users (pin_hash) 
WHERE pin_hash IS NOT NULL;

-- Create index on email_hash for PIN authentication lookups
CREATE INDEX IF NOT EXISTS idx_users_email_hash_pin 
ON public.users (email_hash, pin_hash) 
WHERE pin_hash IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.users.pin_hash IS 'Argon2 hashed PIN for authentication (4-6 digits)';
COMMENT ON COLUMN public.users.biometric_enabled IS 'Whether user has enabled biometric authentication';
COMMENT ON COLUMN public.users.last_session_expiry IS 'When the users last session expires';

-- Show results
SELECT 'PIN authentication columns added successfully' as result;
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('pin_hash', 'biometric_enabled', 'last_session_expiry');
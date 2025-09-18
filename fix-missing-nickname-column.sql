-- Fix missing nickname column in users table
-- Error: column users.nickname does not exist

-- Add nickname column to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS nickname TEXT;

-- Create index for nickname search performance
CREATE INDEX IF NOT EXISTS idx_users_nickname ON public.users(nickname);

-- Update RLS policies to include nickname in searches
-- (The search query already includes nickname, so no policy changes needed)

-- Test that the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('nickname', 'name', 'phone')
ORDER BY column_name;

SELECT 'Nickname column added successfully' as result;
-- 🚀 SIMPLE DISCOVERY MIGRATION
-- Essential columns for discovery system

-- Add discovery columns to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS cyphr_id TEXT,
ADD COLUMN IF NOT EXISTS phone_discovery_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS nearby_discovery_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS share_link_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS cyphr_id_changed_at TIMESTAMP WITH TIME ZONE;

-- Create unique constraint for cyphr_id
ALTER TABLE public.users 
ADD CONSTRAINT unique_cyphr_id UNIQUE (cyphr_id);

-- Create discovery_tokens table
CREATE TABLE IF NOT EXISTS public.discovery_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_type TEXT NOT NULL,
  token_value TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_discovery_tokens_user_id ON public.discovery_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_discovery_tokens_value ON public.discovery_tokens (token_value);
CREATE INDEX IF NOT EXISTS idx_discovery_tokens_expires ON public.discovery_tokens (expires_at);

-- Create phone_hashes table
CREATE TABLE IF NOT EXISTS public.phone_hashes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  phone_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create nearby_discovery table
CREATE TABLE IF NOT EXISTS public.nearby_discovery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  region_hash TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.discovery_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_hashes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nearby_discovery ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies
CREATE POLICY "Users can manage their discovery tokens" ON public.discovery_tokens
FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their phone hashes" ON public.phone_hashes
FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their nearby discovery" ON public.nearby_discovery
FOR ALL USING (auth.uid() = user_id);

-- Success message
SELECT 'Discovery migration completed successfully!' as result;
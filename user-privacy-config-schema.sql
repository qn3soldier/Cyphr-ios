-- User Privacy Configuration Table
-- Stores granular privacy and P2P settings for each user

CREATE TABLE IF NOT EXISTS user_privacy_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one config per user
    UNIQUE(user_id)
);

-- Add RLS (Row Level Security) policies
ALTER TABLE user_privacy_config ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own privacy config
CREATE POLICY "Users can manage their own privacy config" ON user_privacy_config
    FOR ALL USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_user_privacy_config_user_id ON user_privacy_config(user_id);
CREATE INDEX IF NOT EXISTS idx_user_privacy_config_updated_at ON user_privacy_config(updated_at);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_privacy_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER user_privacy_config_updated_at
    BEFORE UPDATE ON user_privacy_config
    FOR EACH ROW
    EXECUTE FUNCTION update_user_privacy_config_updated_at();

-- Insert default configurations for existing users
INSERT INTO user_privacy_config (user_id, config)
SELECT 
    id as user_id,
    '{
        "obfuscation": {
            "frequency": "medium",
            "customMinInterval": 15000,
            "customMaxInterval": 45000,
            "adaptiveMode": true,
            "burstMode": false,
            "throttleOnHighActivity": true,
            "packetSizeMode": "variable",
            "customMinPacketSize": 64,
            "customMaxPacketSize": 192
        },
        "p2p": {
            "maxPeers": 20,
            "minPeers": 3,
            "preferredRegions": ["auto"],
            "connectionTimeout": 10000,
            "discoveryMode": "balanced",
            "enableBootstrap": true,
            "enablePubsub": true
        },
        "geographic": {
            "autoSelectRegion": true,
            "excludeRegions": [],
            "preferLowLatency": true,
            "preferHighThroughput": false
        },
        "performance": {
            "batteryOptimization": "balanced",
            "bandwidthOptimization": true,
            "enableMetrics": true,
            "adaptiveQuality": true
        },
        "security": {
            "enableTrafficAnalysisResistance": true,
            "enableMetadataObfuscation": true,
            "enableTimingRandomization": true,
            "enablePacketPadding": true,
            "securityLevel": "high"
        }
    }'::jsonb as config
FROM users 
WHERE id NOT IN (SELECT user_id FROM user_privacy_config)
ON CONFLICT (user_id) DO NOTHING;
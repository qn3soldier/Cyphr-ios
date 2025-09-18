-- User Wallets IPFS Sync Migration
-- Adds IPFS backup tracking and sync status fields

-- Add new columns for IPFS sync
ALTER TABLE user_wallets ADD COLUMN IF NOT EXISTS ipfs_backup_cid TEXT;
ALTER TABLE user_wallets ADD COLUMN IF NOT EXISTS last_backup_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE user_wallets ADD COLUMN IF NOT EXISTS sync_enabled BOOLEAN DEFAULT true;
ALTER TABLE user_wallets ADD COLUMN IF NOT EXISTS sync_conflicts INTEGER DEFAULT 0;
ALTER TABLE user_wallets ADD COLUMN IF NOT EXISTS last_conflict_at TIMESTAMP WITH TIME ZONE;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_wallets_ipfs_cid ON user_wallets(ipfs_backup_cid);
CREATE INDEX IF NOT EXISTS idx_user_wallets_last_backup ON user_wallets(last_backup_at);
CREATE INDEX IF NOT EXISTS idx_user_wallets_sync_enabled ON user_wallets(sync_enabled);

-- Add comments for documentation
COMMENT ON COLUMN user_wallets.ipfs_backup_cid IS 'IPFS Content ID for encrypted wallet backup';
COMMENT ON COLUMN user_wallets.last_backup_at IS 'Timestamp of last IPFS backup';
COMMENT ON COLUMN user_wallets.sync_enabled IS 'Whether cross-device sync is enabled';
COMMENT ON COLUMN user_wallets.sync_conflicts IS 'Number of unresolved sync conflicts';
COMMENT ON COLUMN user_wallets.last_conflict_at IS 'Timestamp of last sync conflict';

-- Create function to update sync statistics
CREATE OR REPLACE FUNCTION update_wallet_sync_stats(
  p_wallet_id UUID,
  p_conflict_count INTEGER DEFAULT NULL,
  p_last_conflict TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE user_wallets 
  SET 
    sync_conflicts = COALESCE(p_conflict_count, sync_conflicts),
    last_conflict_at = COALESCE(p_last_conflict, last_conflict_at),
    updated_at = NOW()
  WHERE id = p_wallet_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Create wallet sync status view
CREATE OR REPLACE VIEW wallet_sync_status AS
SELECT 
  uw.id,
  uw.user_id,
  uw.wallet_name,
  uw.stellar_address,
  uw.ipfs_backup_cid,
  uw.last_backup_at,
  uw.sync_enabled,
  uw.sync_conflicts,
  uw.last_conflict_at,
  CASE 
    WHEN uw.ipfs_backup_cid IS NULL THEN 'no_backup'
    WHEN uw.sync_conflicts > 0 THEN 'conflicts'
    WHEN uw.last_backup_at > NOW() - INTERVAL '1 hour' THEN 'synced'
    WHEN uw.last_backup_at > NOW() - INTERVAL '24 hours' THEN 'stale'
    ELSE 'outdated'
  END as sync_status,
  EXTRACT(EPOCH FROM (NOW() - uw.last_backup_at)) as seconds_since_backup
FROM user_wallets uw
WHERE uw.sync_enabled = true;

-- Grant permissions
GRANT SELECT ON wallet_sync_status TO authenticated;

-- Example: Update existing wallets to enable sync by default
UPDATE user_wallets 
SET sync_enabled = true 
WHERE sync_enabled IS NULL;
-- Multi-Signature Wallet Database Schema
-- Enterprise-grade multi-sig functionality with comprehensive audit trail

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Multi-signature wallets table
CREATE TABLE IF NOT EXISTS multisig_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    stellar_address VARCHAR(56) NOT NULL UNIQUE,
    required_signatures INTEGER NOT NULL CHECK (required_signatures >= 1),
    total_signers INTEGER NOT NULL CHECK (total_signers >= 2),
    signers JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'archived')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_signature_threshold CHECK (required_signatures <= total_signers),
    CONSTRAINT valid_stellar_address CHECK (length(stellar_address) = 56 AND stellar_address ~ '^G[A-Z0-9]{55}$')
);

-- Pending multi-sig transactions table
CREATE TABLE IF NOT EXISTS multisig_pending_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    multisig_wallet_id UUID NOT NULL REFERENCES multisig_wallets(id) ON DELETE CASCADE,
    transaction_xdr TEXT NOT NULL,
    initiator_id UUID NOT NULL,
    destination_address VARCHAR(56) NOT NULL,
    amount DECIMAL(20, 7) NOT NULL CHECK (amount > 0),
    asset_code VARCHAR(12) NOT NULL DEFAULT 'XLM',
    asset_issuer VARCHAR(56),
    memo TEXT,
    required_signatures INTEGER NOT NULL,
    signatures JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'executed', 'expired')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE,
    transaction_hash VARCHAR(64),
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Constraints
    CONSTRAINT valid_destination_address CHECK (length(destination_address) = 56 AND destination_address ~ '^G[A-Z0-9]{55}$'),
    CONSTRAINT valid_asset_issuer CHECK (asset_issuer IS NULL OR (length(asset_issuer) = 56 AND asset_issuer ~ '^G[A-Z0-9]{55}$')),
    CONSTRAINT valid_expiration CHECK (expires_at > created_at),
    CONSTRAINT executed_has_hash CHECK ((status = 'executed' AND transaction_hash IS NOT NULL) OR (status != 'executed'))
);

-- Multi-sig transaction history table (completed transactions)
CREATE TABLE IF NOT EXISTS multisig_transaction_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    multisig_wallet_id UUID NOT NULL REFERENCES multisig_wallets(id),
    original_transaction_id UUID REFERENCES multisig_pending_transactions(id),
    transaction_hash VARCHAR(64) NOT NULL,
    stellar_ledger BIGINT,
    initiator_id UUID NOT NULL,
    destination_address VARCHAR(56) NOT NULL,
    amount DECIMAL(20, 7) NOT NULL,
    asset_code VARCHAR(12) NOT NULL DEFAULT 'XLM',
    asset_issuer VARCHAR(56),
    memo TEXT,
    signatures_required INTEGER NOT NULL,
    signatures_collected INTEGER NOT NULL,
    signers JSONB NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    executed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    fees_paid DECIMAL(10, 7) DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Signer approval notifications table
CREATE TABLE IF NOT EXISTS multisig_approval_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES multisig_pending_transactions(id) ON DELETE CASCADE,
    signer_user_id UUID NOT NULL,
    signer_email VARCHAR(255),
    notification_type VARCHAR(20) NOT NULL DEFAULT 'email' CHECK (notification_type IN ('email', 'push', 'sms', 'in_app')),
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    viewed_at TIMESTAMP WITH TIME ZONE,
    responded_at TIMESTAMP WITH TIME ZONE,
    response VARCHAR(20) CHECK (response IN ('approved', 'rejected', 'timeout')),
    urgency VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
    reminder_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Multi-sig wallet audit log
CREATE TABLE IF NOT EXISTS multisig_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID REFERENCES multisig_wallets(id),
    transaction_id UUID REFERENCES multisig_pending_transactions(id),
    user_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Index for efficient querying
    INDEX idx_multisig_audit_wallet_id ON multisig_audit_log(wallet_id),
    INDEX idx_multisig_audit_user_id ON multisig_audit_log(user_id),
    INDEX idx_multisig_audit_created_at ON multisig_audit_log(created_at)
);

-- Multi-sig signer permissions table (for granular control)
CREATE TABLE IF NOT EXISTS multisig_signer_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID NOT NULL REFERENCES multisig_wallets(id) ON DELETE CASCADE,
    signer_user_id UUID NOT NULL,
    signer_stellar_key VARCHAR(56) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'signer' CHECK (role IN ('owner', 'signer', 'observer')),
    can_sign BOOLEAN DEFAULT true,
    can_add_signers BOOLEAN DEFAULT false,
    can_remove_signers BOOLEAN DEFAULT false,
    can_change_threshold BOOLEAN DEFAULT false,
    max_transaction_amount DECIMAL(20, 7),
    allowed_assets JSONB DEFAULT '[]'::jsonb,
    daily_limit DECIMAL(20, 7),
    monthly_limit DECIMAL(20, 7),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint per wallet-signer combination
    UNIQUE(wallet_id, signer_user_id)
);

-- Create indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_multisig_wallets_user_id ON multisig_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_multisig_wallets_status ON multisig_wallets(status);
CREATE INDEX IF NOT EXISTS idx_multisig_wallets_created_at ON multisig_wallets(created_at);

CREATE INDEX IF NOT EXISTS idx_multisig_pending_tx_wallet_id ON multisig_pending_transactions(multisig_wallet_id);
CREATE INDEX IF NOT EXISTS idx_multisig_pending_tx_initiator ON multisig_pending_transactions(initiator_id);
CREATE INDEX IF NOT EXISTS idx_multisig_pending_tx_status ON multisig_pending_transactions(status);
CREATE INDEX IF NOT EXISTS idx_multisig_pending_tx_expires ON multisig_pending_transactions(expires_at);

CREATE INDEX IF NOT EXISTS idx_multisig_history_wallet_id ON multisig_transaction_history(multisig_wallet_id);
CREATE INDEX IF NOT EXISTS idx_multisig_history_hash ON multisig_transaction_history(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_multisig_history_executed_at ON multisig_transaction_history(executed_at);

CREATE INDEX IF NOT EXISTS idx_multisig_approvals_transaction_id ON multisig_approval_requests(transaction_id);
CREATE INDEX IF NOT EXISTS idx_multisig_approvals_signer ON multisig_approval_requests(signer_user_id);
CREATE INDEX IF NOT EXISTS idx_multisig_approvals_sent_at ON multisig_approval_requests(sent_at);

CREATE INDEX IF NOT EXISTS idx_multisig_permissions_wallet ON multisig_signer_permissions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_multisig_permissions_signer ON multisig_signer_permissions(signer_user_id);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updating updated_at columns
DROP TRIGGER IF EXISTS update_multisig_wallets_updated_at ON multisig_wallets;
CREATE TRIGGER update_multisig_wallets_updated_at 
    BEFORE UPDATE ON multisig_wallets 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_multisig_pending_tx_updated_at ON multisig_pending_transactions;
CREATE TRIGGER update_multisig_pending_tx_updated_at 
    BEFORE UPDATE ON multisig_pending_transactions 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_multisig_permissions_updated_at ON multisig_signer_permissions;
CREATE TRIGGER update_multisig_permissions_updated_at 
    BEFORE UPDATE ON multisig_signer_permissions 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE multisig_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE multisig_pending_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE multisig_transaction_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE multisig_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE multisig_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE multisig_signer_permissions ENABLE ROW LEVEL SECURITY;

-- RLS policies for multisig_wallets
CREATE POLICY "Users can view their own multisig wallets" ON multisig_wallets
    FOR SELECT USING (
        user_id = auth.uid() OR 
        EXISTS (
            SELECT 1 FROM multisig_signer_permissions 
            WHERE wallet_id = multisig_wallets.id 
            AND signer_user_id = auth.uid()
            AND status = 'active'
        )
    );

CREATE POLICY "Users can create multisig wallets" ON multisig_wallets
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Wallet owners can update their wallets" ON multisig_wallets
    FOR UPDATE USING (user_id = auth.uid());

-- RLS policies for pending transactions
CREATE POLICY "Signers can view pending transactions" ON multisig_pending_transactions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM multisig_signer_permissions msp
            JOIN multisig_wallets mw ON msp.wallet_id = mw.id
            WHERE mw.id = multisig_pending_transactions.multisig_wallet_id
            AND msp.signer_user_id = auth.uid()
            AND msp.status = 'active'
        )
    );

CREATE POLICY "Authorized signers can create transactions" ON multisig_pending_transactions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM multisig_signer_permissions msp
            WHERE msp.wallet_id = multisig_pending_transactions.multisig_wallet_id
            AND msp.signer_user_id = auth.uid()
            AND msp.can_sign = true
            AND msp.status = 'active'
        )
    );

-- Add helpful comments
COMMENT ON TABLE multisig_wallets IS 'Multi-signature wallet configurations with signer management';
COMMENT ON TABLE multisig_pending_transactions IS 'Transactions awaiting multi-signature approval';
COMMENT ON TABLE multisig_transaction_history IS 'Completed multi-signature transaction history';
COMMENT ON TABLE multisig_approval_requests IS 'Notification tracking for transaction approvals';
COMMENT ON TABLE multisig_audit_log IS 'Comprehensive audit trail for all multi-sig operations';
COMMENT ON TABLE multisig_signer_permissions IS 'Granular permission control for each signer';

-- Insert sample data for testing (only in development)
-- Uncomment the following for development/testing:
/*
INSERT INTO multisig_wallets (user_id, stellar_address, required_signatures, total_signers, signers, status) VALUES
(
    uuid_generate_v4(),
    'GCFXHS4GXL6BVUCXBWXGTITROWLVYXQKQLF4YH5O5JT3YZXCYPAFBJZB',
    2,
    3,
    '[
        {
            "id": "signer_1",
            "userId": "user_1",
            "userName": "Alice Johnson",
            "userEmail": "alice@company.com",
            "stellarPublicKey": "GCFXHS4GXL6BVUCXBWXGTITROWLVYXQKQLF4YH5O5JT3YZXCYPAFBJZB",
            "role": "owner",
            "status": "verified",
            "permissions": {
                "canSign": true,
                "canAddSigners": true,
                "canRemoveSigners": true,
                "canChangeThreshold": true
            }
        },
        {
            "id": "signer_2", 
            "userId": "user_2",
            "userName": "Bob Smith",
            "userEmail": "bob@company.com",
            "stellarPublicKey": "GDQOE23CFSUMSVQK4Y5JHPPYK73VYCNHZHA7ENKCV37P6SUEO6XQBKPP",
            "role": "signer",
            "status": "verified",
            "permissions": {
                "canSign": true,
                "canAddSigners": false,
                "canRemoveSigners": false,
                "canChangeThreshold": false,
                "maxTransactionAmount": 10000
            }
        }
    ]'::jsonb,
    'active'
);
*/

-- Create a function to clean up expired transactions
CREATE OR REPLACE FUNCTION cleanup_expired_multisig_transactions()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE multisig_pending_transactions 
    SET status = 'expired'
    WHERE status = 'pending' 
    AND expires_at < NOW();
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    -- Log the cleanup operation
    INSERT INTO multisig_audit_log (user_id, action, details)
    VALUES (
        '00000000-0000-0000-0000-000000000000'::uuid,
        'cleanup_expired_transactions',
        json_build_object('expired_count', expired_count, 'timestamp', NOW())
    );
    
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get wallet statistics
CREATE OR REPLACE FUNCTION get_multisig_wallet_stats(wallet_uuid UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_signers', (SELECT jsonb_array_length(signers) FROM multisig_wallets WHERE id = wallet_uuid),
        'verified_signers', (SELECT COUNT(*) FROM jsonb_array_elements(signers) elem WHERE elem->>'status' = 'verified'),
        'pending_transactions', (SELECT COUNT(*) FROM multisig_pending_transactions WHERE multisig_wallet_id = wallet_uuid AND status = 'pending'),
        'completed_transactions', (SELECT COUNT(*) FROM multisig_transaction_history WHERE multisig_wallet_id = wallet_uuid),
        'total_transaction_value', (SELECT COALESCE(SUM(amount), 0) FROM multisig_transaction_history WHERE multisig_wallet_id = wallet_uuid),
        'last_activity', (SELECT MAX(created_at) FROM multisig_pending_transactions WHERE multisig_wallet_id = wallet_uuid)
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;
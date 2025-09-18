-- Создание недостающих таблиц для Cyphr Messenger
-- Таблица для забаненных участников групп

CREATE TABLE IF NOT EXISTS group_banned_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id INTEGER REFERENCES chats(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    banned_by TEXT NOT NULL,
    reason TEXT DEFAULT 'No reason provided',
    banned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(chat_id, user_id)
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_group_banned_members_chat ON group_banned_members(chat_id);
CREATE INDEX IF NOT EXISTS idx_group_banned_members_user ON group_banned_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_banned_members_active ON group_banned_members(is_active);

-- RLS Policy
ALTER TABLE group_banned_members ENABLE ROW LEVEL SECURITY;

-- Policy для администраторов группы
CREATE POLICY "Admin can manage banned members" ON group_banned_members 
FOR ALL USING (
    chat_id IN (
        SELECT chat_id FROM chat_participants 
        WHERE user_id = auth.uid()::text AND role = 'admin'
    )
);

-- Policy для просмотра (участники группы могут видеть кто забанен)
CREATE POLICY "Members can view banned list" ON group_banned_members 
FOR SELECT USING (
    chat_id IN (
        SELECT chat_id FROM chat_participants 
        WHERE user_id = auth.uid()::text
    )
);

-- Функция для автоматической очистки истекших банов
CREATE OR REPLACE FUNCTION cleanup_expired_bans()
RETURNS VOID AS $$
BEGIN
    UPDATE group_banned_members 
    SET is_active = false 
    WHERE expires_at IS NOT NULL 
    AND expires_at < NOW() 
    AND is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Таблица для логирования административных действий
CREATE TABLE IF NOT EXISTS group_admin_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id INTEGER REFERENCES chats(id) ON DELETE CASCADE,
    admin_user_id TEXT NOT NULL,
    target_user_id TEXT,
    action_type TEXT NOT NULL, -- 'ban', 'unban', 'promote', 'demote', 'remove'
    reason TEXT,
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB
);

-- Индексы для admin actions
CREATE INDEX IF NOT EXISTS idx_group_admin_actions_chat ON group_admin_actions(chat_id);
CREATE INDEX IF NOT EXISTS idx_group_admin_actions_admin ON group_admin_actions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_group_admin_actions_type ON group_admin_actions(action_type);

-- RLS для admin actions
ALTER TABLE group_admin_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view admin actions" ON group_admin_actions 
FOR SELECT USING (
    chat_id IN (
        SELECT chat_id FROM chat_participants 
        WHERE user_id = auth.uid()::text AND role = 'admin'
    )
);

CREATE POLICY "Admins can log actions" ON group_admin_actions 
FOR INSERT WITH CHECK (
    admin_user_id = auth.uid()::text AND
    chat_id IN (
        SELECT chat_id FROM chat_participants 
        WHERE user_id = auth.uid()::text AND role = 'admin'
    )
);
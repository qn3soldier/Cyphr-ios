-- Таблица для забаненных участников групп
-- Добавить в дополнение к add-group-features.sql

CREATE TABLE IF NOT EXISTS group_banned_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id INTEGER REFERENCES chats(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL, -- Using TEXT to match existing user_id format
    banned_by TEXT NOT NULL, -- Admin who banned the user
    reason TEXT DEFAULT 'No reason provided',
    banned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE, -- NULL for permanent ban
    is_active BOOLEAN DEFAULT true,
    UNIQUE(chat_id, user_id)
);

-- Индекс для производительности
CREATE INDEX IF NOT EXISTS idx_group_banned_members_chat ON group_banned_members(chat_id);
CREATE INDEX IF NOT EXISTS idx_group_banned_members_user ON group_banned_members(user_id);

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

-- Комментарии
COMMENT ON TABLE group_banned_members IS 'Список забаненных участников групп с поддержкой временных банов';
COMMENT ON COLUMN group_banned_members.expires_at IS 'NULL для постоянного бана, дата для временного';
COMMENT ON FUNCTION cleanup_expired_bans() IS 'Функция для автоматической очистки истекших банов';
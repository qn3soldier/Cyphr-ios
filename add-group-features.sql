-- ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ГРУПП
-- Выполнить после основного setup-cyphr-database.sql

-- 1. Добавить поля для групп в таблицу chats
ALTER TABLE chats ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE chats ADD COLUMN IF NOT EXISTS member_count INTEGER DEFAULT 0;
ALTER TABLE chats ADD COLUMN IF NOT EXISTS max_members INTEGER DEFAULT 256;
ALTER TABLE chats ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;
ALTER TABLE chats ADD COLUMN IF NOT EXISTS invite_link VARCHAR(255) UNIQUE;
ALTER TABLE chats ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);
ALTER TABLE chats ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{
    "mute_notifications": false,
    "allow_member_invites": true,
    "require_admin_approval": false,
    "media_visibility": true,
    "message_retention_days": null
}';

-- 2. Таблица для истории участников группы
CREATE TABLE IF NOT EXISTS group_member_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(20), -- 'joined', 'left', 'kicked', 'banned'
    performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reason TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Таблица для админских действий
CREATE TABLE IF NOT EXISTS group_admin_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action_type VARCHAR(50), -- 'delete_message', 'ban_user', 'change_settings', etc
    target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    target_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Таблица для pinned сообщений
CREATE TABLE IF NOT EXISTS pinned_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    pinned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    pinned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(chat_id, message_id)
);

-- 5. Таблица для упоминаний (@mentions)
CREATE TABLE IF NOT EXISTS message_mentions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    mentioned_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(message_id, mentioned_user_id)
);

-- 6. Таблица для реакций на сообщения
CREATE TABLE IF NOT EXISTS message_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    reaction VARCHAR(10), -- emoji reaction
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(message_id, user_id, reaction)
);

-- 7. Таблица для опросов в группах
CREATE TABLE IF NOT EXISTS polls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
    creator_id UUID REFERENCES users(id) ON DELETE SET NULL,
    question TEXT NOT NULL,
    options JSONB NOT NULL, -- Array of options
    is_anonymous BOOLEAN DEFAULT false,
    allows_multiple_answers BOOLEAN DEFAULT false,
    ends_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Таблица для голосов в опросах
CREATE TABLE IF NOT EXISTS poll_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    poll_id UUID REFERENCES polls(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    option_index INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(poll_id, user_id, option_index)
);

-- 9. Таблица для scheduled сообщений
CREATE TABLE IF NOT EXISTS scheduled_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    type VARCHAR(20) DEFAULT 'text',
    metadata JSONB DEFAULT '{}',
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
    is_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Таблица для группового видеозвонка
CREATE TABLE IF NOT EXISTS group_call_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    is_muted BOOLEAN DEFAULT false,
    is_video_on BOOLEAN DEFAULT true,
    is_screen_sharing BOOLEAN DEFAULT false,
    UNIQUE(call_id, user_id)
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_group_member_history_chat ON group_member_history(chat_id);
CREATE INDEX IF NOT EXISTS idx_group_admin_actions_chat ON group_admin_actions(chat_id);
CREATE INDEX IF NOT EXISTS idx_pinned_messages_chat ON pinned_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_message_mentions_user ON message_mentions(mentioned_user_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_polls_chat ON polls(chat_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_chat ON scheduled_messages(chat_id);

-- RLS Policies для новых таблиц
ALTER TABLE group_member_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_admin_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pinned_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_call_participants ENABLE ROW LEVEL SECURITY;

-- Простые policies для разработки (в продакшене нужны более строгие)
CREATE POLICY "View group history" ON group_member_history FOR SELECT USING (true);
CREATE POLICY "Insert group history" ON group_member_history FOR INSERT WITH CHECK (true);

CREATE POLICY "View admin actions" ON group_admin_actions FOR SELECT USING (true);
CREATE POLICY "Insert admin actions" ON group_admin_actions FOR INSERT WITH CHECK (true);

CREATE POLICY "View pinned" ON pinned_messages FOR SELECT USING (true);
CREATE POLICY "Manage pinned" ON pinned_messages FOR ALL USING (true);

CREATE POLICY "View mentions" ON message_mentions FOR SELECT USING (true);
CREATE POLICY "Create mentions" ON message_mentions FOR INSERT WITH CHECK (true);
CREATE POLICY "Update mentions" ON message_mentions FOR UPDATE USING (true);

CREATE POLICY "View reactions" ON message_reactions FOR SELECT USING (true);
CREATE POLICY "Manage reactions" ON message_reactions FOR ALL USING (true);

CREATE POLICY "View polls" ON polls FOR SELECT USING (true);
CREATE POLICY "Create polls" ON polls FOR INSERT WITH CHECK (true);

CREATE POLICY "View votes" ON poll_votes FOR SELECT USING (true);
CREATE POLICY "Cast votes" ON poll_votes FOR ALL USING (true);

CREATE POLICY "View scheduled" ON scheduled_messages FOR SELECT USING (true);
CREATE POLICY "Manage scheduled" ON scheduled_messages FOR ALL USING (true);

CREATE POLICY "View call participants" ON group_call_participants FOR SELECT USING (true);
CREATE POLICY "Manage call participants" ON group_call_participants FOR ALL USING (true);

-- Функция для подсчета участников группы
CREATE OR REPLACE FUNCTION update_member_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE chats 
        SET member_count = (
            SELECT COUNT(*) FROM chat_participants WHERE chat_id = NEW.chat_id
        )
        WHERE id = NEW.chat_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE chats 
        SET member_count = (
            SELECT COUNT(*) FROM chat_participants WHERE chat_id = OLD.chat_id
        )
        WHERE id = OLD.chat_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления количества участников
CREATE TRIGGER update_chat_member_count
AFTER INSERT OR DELETE ON chat_participants
FOR EACH ROW EXECUTE FUNCTION update_member_count();

SELECT 'Group features added successfully!' as status;
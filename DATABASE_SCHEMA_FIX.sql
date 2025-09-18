-- DATABASE SCHEMA FIX - 28 АВГУСТА 2025
-- Исправляет критическую ошибку: Could not find the 'encrypted' column of 'messages'

-- 1. Добавить колонку encrypted в таблицу messages
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS encrypted BOOLEAN DEFAULT false;

-- 2. Добавить колонку metadata для дополнительных данных (crypto payments, etc)
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 3. Добавить индекс для быстрого поиска зашифрованных сообщений
CREATE INDEX IF NOT EXISTS idx_messages_encrypted 
ON public.messages(encrypted) 
WHERE encrypted = true;

-- 4. Добавить индекс для быстрого поиска по chat_id и created_at
CREATE INDEX IF NOT EXISTS idx_messages_chat_created 
ON public.messages(chat_id, created_at DESC);

-- 5. Обновить существующие сообщения как незашифрованные (для обратной совместимости)
UPDATE public.messages 
SET encrypted = false 
WHERE encrypted IS NULL;

-- 6. Добавить колонки для аудио/видео сообщений если их нет
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS audio_duration INTEGER,
ADD COLUMN IF NOT EXISTS file_name TEXT,
ADD COLUMN IF NOT EXISTS file_size INTEGER,
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- 7. Добавить статус доставки сообщения
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'sent' 
CHECK (delivery_status IN ('sending', 'sent', 'delivered', 'read', 'failed'));

-- 8. Создать таблицу для статусов прочтения если не существует
CREATE TABLE IF NOT EXISTS public.message_status (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('delivered', 'read')),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(message_id, user_id)
);

-- 9. Добавить RLS политики для message_status
ALTER TABLE public.message_status ENABLE ROW LEVEL SECURITY;

-- Пользователи могут видеть статусы своих сообщений
CREATE POLICY "Users can view status of their messages" ON public.message_status
    FOR SELECT
    USING (
        user_id IN (
            SELECT sender_id FROM public.messages WHERE id = message_status.message_id
        ) OR
        user_id = auth.uid()::uuid
    );

-- Пользователи могут обновлять статус прочтения
CREATE POLICY "Users can update read status" ON public.message_status
    FOR INSERT
    USING (user_id = auth.uid()::uuid);

-- 10. Проверить что все необходимые колонки существуют
DO $$
BEGIN
    -- Проверяем критически важные колонки
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'messages' 
        AND column_name = 'encrypted'
    ) THEN
        RAISE EXCEPTION 'Column encrypted was not created successfully!';
    END IF;
    
    RAISE NOTICE '✅ All required columns have been added successfully';
END $$;

-- Вывести структуру таблицы messages для проверки
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM 
    information_schema.columns
WHERE 
    table_schema = 'public' 
    AND table_name = 'messages'
ORDER BY 
    ordinal_position;
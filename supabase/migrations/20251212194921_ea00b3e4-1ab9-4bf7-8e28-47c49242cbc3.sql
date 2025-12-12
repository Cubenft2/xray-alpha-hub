-- Phase 2: Persistent Memory Tables
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_hash TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_seen TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_summaries (
  session_id TEXT PRIMARY KEY,
  rolling_summary TEXT,
  last_assets JSONB DEFAULT '[]'::jsonb,
  last_addresses JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_sessions_session_id ON chat_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);

-- Add foreign key constraint (deferred to avoid circular reference issues)
ALTER TABLE chat_messages 
  ADD CONSTRAINT fk_chat_messages_session 
  FOREIGN KEY (session_id) 
  REFERENCES chat_sessions(session_id) 
  ON DELETE CASCADE;

ALTER TABLE chat_summaries
  ADD CONSTRAINT fk_chat_summaries_session
  FOREIGN KEY (session_id)
  REFERENCES chat_sessions(session_id)
  ON DELETE CASCADE;

-- Enable RLS
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_summaries ENABLE ROW LEVEL SECURITY;

-- Service role full access for edge functions
CREATE POLICY "Service role full access to chat_sessions" ON chat_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to chat_messages" ON chat_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to chat_summaries" ON chat_summaries FOR ALL USING (true) WITH CHECK (true);

-- Phase 3: Extend ai_usage_logs with new columns
ALTER TABLE ai_usage_logs 
  ADD COLUMN IF NOT EXISTS intent TEXT,
  ADD COLUMN IF NOT EXISTS tools_used JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tool_latency_ms JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS total_latency_ms INTEGER,
  ADD COLUMN IF NOT EXISTS success BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS error_code TEXT;

-- Add index for intent analysis
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_intent ON ai_usage_logs(intent);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_success ON ai_usage_logs(success);
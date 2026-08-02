-- ── PROTOCOLO DE MEMÓRIA J.A.R.V.I.S. (SUPABASE) ──────────────────────────

-- 1. Habilitar a extensão pgvector para memória semântica
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Tabela de Memórias Semânticas (Fatos que o J.A.R.V.I.S. lembra)
CREATE TABLE IF NOT EXISTS memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1536), -- Compatível com OpenAI text-embedding-3-small/ada-002
  metadata JSONB DEFAULT '{}'::jsonb,
  access_score INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Índice para busca vetorial rápida
CREATE INDEX IF NOT EXISTS memories_embedding_idx ON memories 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 4. Tabela de Conversas (Log de Comunicação)
CREATE TABLE IF NOT EXISTS conversations (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  title TEXT DEFAULT 'Nova Conversa',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Tabela de Mensagens
CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  file_url TEXT,
  file_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Função para busca por similaridade (RPC do J.A.R.V.I.S.)
CREATE OR REPLACE FUNCTION match_memories (
  query_embedding VECTOR(1536),
  match_threshold FLOAT,
  match_count INT,
  p_user_id BIGINT
) RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    memories.id,
    memories.content,
    memories.metadata,
    1 - (memories.embedding <=> query_embedding) AS similarity
  FROM memories
  WHERE memories.user_id = p_user_id
    AND 1 - (memories.embedding <=> query_embedding) > match_threshold
  ORDER BY memories.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

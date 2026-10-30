# Configuração Mestra do Jarvis (.env)

Com todas as chaves que você possui, o Jarvis operará em um ecossistema de **Especialização de Modelos**. Abaixo, detalho a função de cada API e forneço o arquivo pronto para uso.

## 1. Distribuição de Funções (Estratégia Stark)

| API / Serviço | Função Principal no Jarvis | Por que usar aqui? |
| :--- | :--- | :--- |
| **LM Studio (Local)** | Conversa rápida e Voz | Latência zero. O **Qwen** na sua RX 7600 responde antes mesmo da internet processar. |
| **Groq** | Raciocínio rápido em nuvem | Caso o PC esteja pesado, o Groq (Llama 3.1 70B) é a nuvem mais rápida do mundo. |
| **Anthropic (Claude)** | Escrita Criativa e Código | O Claude 3.5 Sonnet é o melhor para programar e escrever textos naturais. |
| **OpenAI (GPT-4o)** | Visão e Análise de Imagem | O GPT-4o é o mais estável para descrever o que você vê pela câmera ou print. |
| **Gemini (Google)** | Contexto Gigante e PDFs | Ótimo para ler livros inteiros ou analisar vídeos longos. |
| **Tavily** | Pesquisa em Tempo Real | A IA não "alucina" fatos novos; ela pesquisa no Google via Tavily primeiro. |
| **ElevenLabs** | Identidade Vocal | A voz mais humana disponível, essencial para a imersão. |
| **Supabase** | Memória de Longo Prazo | Onde o Jarvis guarda o que aprendeu sobre você para não esquecer na próxima sessão. |
| **Home Assistant** | Controle da Casa | Permite dizer "Jarvis, apague a luz" e ele executar via comando local. |

---

## 2. Arquivo .env Completo

Copie o conteúdo abaixo e cole no seu arquivo `.env` na raiz da pasta `jarvis`. Substitua os textos `SEU_VALOR_AQUI` pelas suas chaves reais.

```env
# =========================================================
# CONFIGURAÇÃO DO NÚCLEO JARVIS (STARK PROTOCOLS)
# =========================================================

# --- MODO HÍBRIDO (SEU PC + NUVEM) ---
HYBRID_MODE_ENABLED=true
LOCAL_OPENAI_BASE_URL=http://127.0.0.1:1234/v1
LOCAL_OPENAI_MODEL=qwen2.5-7b-instruct

# --- PROVEDORES DE IA (NUVEM) ---
OPENAI_API_KEY=SEU_VALOR_AQUI
ANTHROPIC_API_KEY=SEU_VALOR_AQUI
GROQ_API_KEY=SEU_VALOR_AQUI
GEMINI_API_KEY=SEU_VALOR_AQUI

# --- PESQUISA E DADOS ---
TAVILY_API_KEY=SEU_VALOR_AQUI

# --- VOZ (ELEVENLABS) ---
ELEVENLABS_API_KEY=SEU_VALOR_AQUI
ELEVENLABS_VOICE_ID=SEU_VALOR_AQUI

# --- BANCO DE DADOS E MEMÓRIA (SUPABASE) ---
# Use as mesmas chaves para VITE_ e as normais para garantir sincronia Front/Back
SUPABASE_URL=https://SEU_PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=SUA_CHAVE_SERVICE_ROLE
VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANON

# --- SEGURANÇA E API ---
JWT_SECRET=crie_uma_senha_longa_e_aleatoria_aqui
VITE_API_URL=http://localhost:3000

# --- AUTOMAÇÃO RESIDENCIAL ---
HOME_ASSISTANT_URL=http://192.168.x.x:8123
HOME_ASSISTANT_TOKEN=SEU_TOKEN_LONG_LIVED
HOME_AUTOMATION_WEBHOOK=SEU_WEBHOOK_OPCIONAL

# --- INTEGRAÇÃO DE DESENVOLVEDOR (GITHUB) ---
GITHUB_TOKEN=SEU_TOKEN_GITHUB
GITHUB_REPO=seu-usuario/seu-repositorio

# --- DEPLOY E INFRAESTRUTURA (VERCEL) ---
VERCEL_PROJECT_ID=SEU_ID_PROJETO
VERCEL_TOKEN=SEU_TOKEN_VERCEL

# =========================================================
# NOTA: Reinicie o servidor (npm run dev) após salvar este arquivo.
# =========================================================
```

## 3. Próximos Passos Recomendados

1.  **Segurança**: O `JWT_SECRET` pode ser qualquer frase longa. Ele protege suas conversas.
2.  **Home Assistant**: Se você não usa automação ainda, pode deixar esses campos como estão ou vazios; o Jarvis apenas ignorará as funções de casa.
3.  **Supabase**: Certifique-se de rodar o arquivo `supabase_setup.sql` (que está na sua pasta jarvis) no painel SQL do Supabase para criar as tabelas de memória.

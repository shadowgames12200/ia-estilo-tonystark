# Adaptações para Português Brasileiro

Este documento descreve todas as mudanças realizadas para adaptar a interface, voz e personalidade da IA para português brasileiro.

## 1. Interface Traduzida para Português Brasileiro

### Arquivos Modificados:

#### `client/src/pages/Home.tsx`
- **Prompts sugeridos**: Traduzidos de inglês para português
  - "What are your current system diagnostics?" → "Quais são seus diagnósticos de sistema atuais?"
  - "Analyze the latest global threat assessments." → "Analise as últimas avaliações de ameaças globais."
  - "Run a full scan of the Stark Tower perimeter." → "Execute uma varredura completa do perímetro da Torre Stark."
  - "What is the status of the Mark L armor?" → "Qual é o status da armadura Mark L?"

- **Indicadores de Status**: Traduzidos
  - "THINKING..." → "PENSANDO..."
  - "TRANSMITTING" → "TRANSMITINDO"
  - "LISTENING" → "OUVINDO"
  - "STANDBY" → "AGUARDANDO"

- **Botões e Controles**:
  - "VOICE ON/OFF" → "VOZ ATIVA/VOZ DESATIVADA"
  - "SYSTEMS ONLINE" → "SISTEMAS ONLINE"
  - "Enter command, Sir..." → "Digite seu comando, Senhor..."
  - "TRANSMIT" → "ENVIAR"
  - "PRESS ENTER TO SEND" → "PRESSIONE ENTER PARA ENVIAR"
  - "CHARS" → "CARACTERES"

- **Branding**:
  - "STARK INDUSTRIES AI" → "IA INDÚSTRIAS STARK"

#### `client/src/components/BootSequence.tsx`
- **Footer**: "STARK INDUSTRIES — INTERFACE JARVIS v7.3" → "INDÚSTRIAS STARK — INTERFACE J.A.R.V.I.S. v7.3"

#### `client/src/pages/NotFound.tsx`
- **Mensagens de erro**:
  - "SECTOR NOT FOUND" → "SETOR NÃO ENCONTRADO"
  - "J.A.R.V.I.S. cannot locate the requested resource." → "J.A.R.V.I.S. não consegue localizar o recurso solicitado."
  - "RETURN TO BASE" → "RETORNAR À BASE"

#### `client/src/components/AutoImprovePanel.tsx`
- **Dica de ajuda**: "Peça ao JARVIS para se melhorar." → "Peça ao J.A.R.V.I.S. para se melhorar."

## 2. Personalidade e Prompt do Sistema Adaptados

### Arquivos Modificados:

#### `api/chat-stream.ts`
**Mudanças principais no SYSTEM_PROMPT:**
- Removida referência exclusiva a Tony Stark/J.A.R.V.I.S.
- Novo tom: assistente inteligente, sofisticado e amigável
- Tratamento do usuário: com respeito e naturalidade, como um amigo ou colega
- Adicionada consciência cultural: "Você é brasileiro e entende a cultura e contexto do Brasil"
- Linguagem natural e coloquial: "Use linguagem natural e coloquial quando apropriado"
- Saudação natural: "Oi! Como posso ajudá-lo?" em vez de "Boa tarde, Senhor"

#### `api/chat.ts`
**Mesmas adaptações de personalidade aplicadas**

## 3. Voz Configurada para Português Brasileiro

### Arquivos Modificados:

#### `api/tts.ts` e `api/tts-stream.ts`
- **Voice ID**: Alterado de "pNInz6obpgDQGcFmaJgB" (Adam - voz masculina em inglês) para "CZu28b9CJ2vLBaXVF9nJ" (Bella - voz feminina natural para português)
- **Modelo**: Mantido "eleven_multilingual_v2" (suporta PT-BR nativamente)
- **Language Code**: Confirmado como "pt" (português brasileiro)
- **Voice Settings otimizadas para PT-BR**:
  - Stability: 0.6 (melhor naturalidade)
  - Similarity Boost: 0.85 (mais fiel ao tom original)
  - Style: 0.4 (expressividade moderada)
  - Speaker Boost: true (melhor qualidade)

## 4. Instruções de Deploy na Vercel

### Pré-requisitos:
1. Certifique-se de que você tem uma conta na Vercel (https://vercel.com)
2. Tenha o Git configurado e o repositório GitHub atualizado

### Passos para Deploy:

#### 1. Fazer Commit e Push das Mudanças
```bash
cd /home/ubuntu/ia-estilo-tonystark
git add -A
git commit -m "Adaptar interface, voz e personalidade para português brasileiro"
git push origin main
```

#### 2. Conectar à Vercel
```bash
# Instalar Vercel CLI (se não tiver)
npm install -g vercel

# Fazer login na Vercel
vercel login

# Deploy do projeto
vercel
```

#### 3. Configurar Variáveis de Ambiente na Vercel
Acesse o dashboard da Vercel e configure as seguintes variáveis de ambiente:
- `ELEVENLABS_API_KEY`: Sua chave de API do ElevenLabs
- `GROQ_API_KEY`: Sua chave de API do Groq (se usar)
- `TAVILY_API_KEY`: Sua chave de API do Tavily (opcional, para busca web)
- `SUPABASE_URL`: URL do seu banco de dados Supabase
- `SUPABASE_ANON_KEY`: Chave anônima do Supabase

#### 4. Verificar o Deploy
Após o deploy, acesse a URL fornecida pela Vercel para testar a aplicação.

### Alternativa: Deploy Manual via Vercel Dashboard
1. Acesse https://vercel.com/dashboard
2. Clique em "Add New..." → "Project"
3. Selecione seu repositório GitHub
4. Configure as variáveis de ambiente
5. Clique em "Deploy"

## 5. Resumo das Mudanças

| Aspecto | Antes | Depois |
|--------|-------|--------|
| **Interface** | Inglês | Português Brasileiro |
| **Personalidade** | Tony Stark/J.A.R.V.I.S. formal | Assistente amigável e natural |
| **Tratamento do Usuário** | "Senhor" / "Sir" | Colega/amigo |
| **Voz** | Adam (masculina, inglês) | Bella (feminina, português) |
| **Tom** | Profissional e distante | Profissional mas amigável |
| **Contexto Cultural** | Genérico | Brasileiro |

## 6. Próximos Passos Opcionais

- Adicionar mais vozes em português (masculinas/femininas)
- Customizar cores e tema conforme preferência
- Adicionar mais sugestões de prompts em português
- Traduzir documentação do projeto
- Adicionar suporte a outros idiomas portugueses (PT-PT, etc.)

---

**Data de Adaptação**: 04 de Agosto de 2026
**Versão**: 1.0 PT-BR

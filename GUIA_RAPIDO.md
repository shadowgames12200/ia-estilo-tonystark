# ⚡ J.A.R.V.I.S. — Guia Rápido de Uso

## 🚀 Iniciar o Sistema

### 1. Instalar Dependências
```bash
npm install
```

### 2. Configurar Variáveis de Ambiente
Edite o arquivo `.env` e adicione suas chaves:

```env
# Obrigatório: Pelo menos uma chave de API
GROQ_API_KEY=sua_chave_groq_aqui
# OU
OPENAI_API_KEY=sua_chave_openai_aqui
# OU
ANTHROPIC_API_KEY=sua_chave_anthropic_aqui

# Opcional: Para usar Ollama local
HYBRID_MODE_ENABLED=true
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3
```

### 3. Iniciar o Servidor
```bash
npm run dev
```

### 4. Abrir no Navegador
```
http://localhost:3000
```

---

## 🎮 Controlar Latência

### Método 1: Botões Rápidos (Novo!)
1. Procure os botões `−` e `+` no header superior
2. Clique `−` para **diminuir latência** (respostas mais longas e detalhadas)
3. Clique `+` para **aumentar latência** (respostas mais rápidas)

### Método 2: Painel de Configurações
1. Clique no ícone ⚙️ (Settings) no header
2. Ajuste o slider "Otimização de Latência"
3. Clique "Aplicar Protocolos"

---

## 📊 Entender os Níveis

| Nível | Velocidade | Qualidade | Melhor Para |
|-------|-----------|----------|-----------|
| **0** | 🐢 Lenta | ⭐⭐⭐⭐⭐ | Análises profundas, código complexo |
| **1** | 🚶 Média-Lenta | ⭐⭐⭐⭐ | Explicações detalhadas |
| **2** | 🚶‍♂️ Normal | ⭐⭐⭐ | Conversa balanceada (recomendado) |
| **3** | 🏃 Rápida | ⭐⭐ | Chat casual, respostas curtas |
| **4** | 🏃‍♂️ Ultra Rápida | ⭐ | Máxima velocidade, respostas mínimas |

---

## 🎤 Usar Voz

1. **Ativar Microfone**
   - Clique no botão "VOZ" no header
   - Permita acesso ao microfone no navegador

2. **Falar com a IA**
   - Fale naturalmente
   - A IA responde por voz automaticamente

3. **Interromper (Barge-in)**
   - Fale enquanto a IA está respondendo
   - O sistema interrompe e começa a escutar você

---

## ⚙️ Configurações Avançadas

### Modo Híbrido
- **Ativado**: Usa PC local (Ollama) quando disponível, depois nuvem
- **Desativado**: Usa apenas APIs de nuvem

### Sensibilidade de Voz (VAD)
- **Baixa**: Detecta qualquer som (pode ter falsos positivos)
- **Alta**: Detecta apenas fala clara (pode perder palavras)

### Endereço do Servidor Local
- Padrão: `http://localhost:11434`
- Se usar túnel: Cole a URL do túnel aqui

---

## 🔧 Troubleshooting

### Nenhuma resposta
1. Verifique se tem uma chave de API válida no `.env`
2. Abra DevTools (F12) e procure por erros
3. Verifique a conexão com a internet

### Voz não funciona
1. Verifique se o microfone está habilitado
2. Teste o microfone em outro site
3. Verifique se o navegador tem permissão

### Respostas muito lentas
1. Aumente o nível de latência (clique `+`)
2. Verifique sua conexão com a internet
3. Verifique se o servidor está respondendo

### Ollama local não conecta
1. Verifique se o Ollama está rodando: `ollama serve`
2. Verifique a URL em Settings
3. Teste: `curl http://localhost:11434/api/tags`

---

## 📁 Estrutura do Projeto

```
.
├── client/              # Frontend React
│   └── src/
│       ├── pages/       # Páginas principais
│       ├── components/  # Componentes UI
│       └── hooks/       # Hooks customizados
├── api/                 # Endpoints serverless
│   ├── chat-stream.ts   # Chat com streaming
│   └── tts-stream.ts    # Síntese de voz
├── server/              # Backend Node.js
│   └── _core/
│       ├── model-router.ts  # Seleção de modelos
│       ├── ollama.ts        # Integração Ollama
│       └── env.ts           # Variáveis de ambiente
└── .env                 # Configuração local
```

---

## 🚀 Deploy

### Vercel
```bash
npm run build
vercel deploy
```

### Docker
```bash
docker build -t jarvis .
docker run -p 3000:3000 -e GROQ_API_KEY=... jarvis
```

---

## 📚 Documentação Completa

- **Melhorias de Latência**: `MELHORIAS_LATENCIA.md`
- **Diagnóstico e Correções**: `RELATORIO.md`
- **Capacidades Avançadas**: `CAPACIDADES_AVANCADAS.md`
- **Guia de Design**: `guia_design_hud.md`

---

## 💡 Dicas

1. **Economizar Tokens**: Use nível 3-4 para chat casual
2. **Melhor Qualidade**: Use nível 0-1 para análises
3. **Modo Offline**: Ative Modo Híbrido com Ollama local
4. **Voz Natural**: Configure ElevenLabs em `.env`

---

**Precisa de ajuda?** Consulte os arquivos de documentação ou abra uma issue no GitHub.

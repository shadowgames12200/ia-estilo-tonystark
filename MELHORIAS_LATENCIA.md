# 🚀 J.A.R.V.I.S. — Sistema de Controle de Latência Implementado

## 📋 Resumo das Melhorias

Este documento descreve as melhorias implementadas para adicionar controle dinâmico de latência e tempo de resposta ao sistema J.A.R.V.I.S.

---

## ✅ Funcionalidades Implementadas

### 1. **Controle de Latência em Tempo Real**

#### Botões de Controle no Header
- **Botão `−` (Diminuir)**: Reduz a latência (aumenta fidelidade)
- **Botão `+` (Aumentar)**: Aumenta a latência (aumenta velocidade)
- **Range**: 0 (Alta Fidelidade) a 4 (Ultra Rápido)

#### Localização
- **UI**: Header principal da aplicação (`client/src/pages/Home.tsx`)
- **Persistência**: Salvo automaticamente em `localStorage` como `jarvis-stark-config`

---

## 🎯 Presets de Latência

O sistema implementa 5 níveis de latência que afetam diretamente:
- **Número de tokens máximos** (quanto a IA pode responder)
- **Temperatura** (criatividade vs. consistência)

| Nível | Nome | Max Tokens | Temperatura | Caso de Uso |
|-------|------|-----------|-------------|-----------|
| **0** | Alta Fidelidade | 8192 | 0.3 | Respostas longas, análises profundas |
| **1** | Qualidade Alta | 4096 | 0.5 | Respostas balanceadas com qualidade |
| **2** | Equilibrado | 2048 | 0.6 | Padrão recomendado |
| **3** | Rápido | 1024 | 0.7 | Respostas curtas e diretas |
| **4** | Ultra Rápido | 512 | 0.8 | Máxima velocidade (padrão) |

---

## 🔧 Mudanças Técnicas

### 1. **Frontend - Hook de Chat** (`client/src/hooks/useStreamingChatWithVoice.ts`)

```typescript
// Antes: Não enviava latencyLevel
body: JSON.stringify({
  messages,
  hybridMode: voiceConfig.hybridMode,
  localOllamaUrl: voiceConfig.localOllamaUrl,
})

// Depois: Envia latencyLevel
body: JSON.stringify({
  messages,
  hybridMode: voiceConfig.hybridMode,
  localOllamaUrl: voiceConfig.localOllamaUrl,
  latencyLevel: voiceConfig.latencyLevel || 4,
})
```

### 2. **Backend - Endpoint de Chat** (`api/chat-stream.ts`)

```typescript
// Antes: Não recebia latencyLevel
const { messages, userId = 1, image, attachedFile, hybridMode, localOllamaUrl } = req.body

// Depois: Recebe e processa latencyLevel
const { 
  messages, 
  userId = 1, 
  image, 
  attachedFile, 
  hybridMode, 
  localOllamaUrl,
  latencyLevel = 4,  // ← Novo
} = req.body

// Passa para o seletor de modelo
const modelConfig = selectModelForContent(lastMsg, hasImage, hasFile, latencyLevel)
```

### 3. **Model Router** (`server/_core/model-router.ts`)

#### Nova Função: `applyLatencyPreset()`

```typescript
export function applyLatencyPreset(config: ModelConfig, latencyLevel: number): ModelConfig {
  const level = Math.max(0, Math.min(4, latencyLevel));
  
  const presets = [
    { maxTokens: 8192, temperature: 0.3 },  // 0: Alta Fidelidade
    { maxTokens: 4096, temperature: 0.5 },  // 1: Qualidade Alta
    { maxTokens: 2048, temperature: 0.6 },  // 2: Equilibrado
    { maxTokens: 1024, temperature: 0.7 },  // 3: Rápido
    { maxTokens: 512, temperature: 0.8 },   // 4: Ultra Rápido
  ];
  
  const preset = presets[level];
  return {
    ...config,
    maxTokens: preset.maxTokens,
    temperature: preset.temperature,
  };
}
```

#### Função Atualizada: `selectModelForContent()`

```typescript
export function selectModelForContent(
  content: string,
  hasImage = false,
  hasFile = false,
  latencyLevel = 4  // ← Novo parâmetro
): ModelConfig {
  const complexity = detectComplexity(content, hasImage, hasFile);
  const config = selectModel(complexity);
  return applyLatencyPreset(config, latencyLevel);  // ← Aplica preset
}
```

### 4. **UI - Botões de Controle** (`client/src/pages/Home.tsx`)

```typescript
{/* Latency Controls */}
<div className="flex items-center gap-1">
  <button
    onClick={() => {
      const newLevel = Math.max(0, jarvisConfig.latencyLevel - 1);
      const updated = { ...jarvisConfig, latencyLevel: newLevel };
      setJarvisConfig(updated);
      localStorage.setItem('jarvis-stark-config', JSON.stringify(updated));
    }}
    className="flex items-center justify-center w-6 h-6 rounded border border-cyan-400/20 text-cyan-400/60 hover:text-cyan-300 hover:border-cyan-400/50 transition-all bg-cyan-400/5 text-[10px]"
    title="Diminuir latência (mais qualidade)"
  >
    −
  </button>
  
  <button
    onClick={() => {
      const newLevel = Math.min(4, jarvisConfig.latencyLevel + 1);
      const updated = { ...jarvisConfig, latencyLevel: newLevel };
      setJarvisConfig(updated);
      localStorage.setItem('jarvis-stark-config', JSON.stringify(updated));
    }}
    className="flex items-center justify-center w-6 h-6 rounded border border-cyan-400/20 text-cyan-400/60 hover:text-cyan-300 hover:border-cyan-400/50 transition-all bg-cyan-400/5 text-[10px]"
    title="Aumentar latência (mais velocidade)"
  >
    +
  </button>
</div>
```

---

## 🎮 Como Usar

### 1. **Controle via Botões**
- Clique no botão `−` para diminuir latência (mais qualidade)
- Clique no botão `+` para aumentar latência (mais velocidade)
- O valor é salvo automaticamente

### 2. **Controle via Settings**
- Abra o painel de configurações (ícone ⚙️)
- Ajuste o slider "Otimização de Latência"
- Clique em "Aplicar Protocolos"

### 3. **Verificar Nível Atual**
- O nível atual é exibido no header: `Nível X`
- O modelo selecionado é mostrado com os parâmetros aplicados

---

## 📊 Impacto no Desempenho

### Tempo de Resposta Esperado

| Nível | Tokens | Tempo Estimado | Qualidade |
|-------|--------|---|---|
| 0 | 8192 | 3-5s | ⭐⭐⭐⭐⭐ Máxima |
| 1 | 4096 | 2-3s | ⭐⭐⭐⭐ Alta |
| 2 | 2048 | 1-2s | ⭐⭐⭐ Média |
| 3 | 1024 | 0.5-1s | ⭐⭐ Rápida |
| 4 | 512 | <0.5s | ⭐ Ultra Rápida |

*Tempos aproximados com Ollama local ou Groq. Pode variar com conexão e modelo.*

---

## 🔄 Fluxo de Dados

```
┌─────────────────────────────────────────────────────┐
│ Usuário clica em + ou − no header                   │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│ setJarvisConfig() atualiza estado local             │
│ localStorage salva a configuração                   │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│ useStreamingChatWithVoice recebe novo latencyLevel  │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│ Próxima mensagem envia latencyLevel ao backend      │
│ POST /api/chat-stream { ..., latencyLevel: X }     │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│ selectModelForContent() aplica preset               │
│ applyLatencyPreset() ajusta tokens e temperatura    │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│ Modelo responde com novos parâmetros                │
│ Resposta mais rápida ou mais detalhada              │
└─────────────────────────────────────────────────────┘
```

---

## 🛠️ Troubleshooting

### Botões não funcionam
- Verifique se o `localStorage` está habilitado
- Abra o DevTools (F12) e verifique `localStorage.getItem('jarvis-stark-config')`

### Latência não muda
- Verifique se o backend está recebendo o `latencyLevel`
- Abra Network no DevTools e inspecione o POST para `/api/chat-stream`
- Procure por `"latencyLevel": X` no payload

### Respostas muito curtas/longas
- Ajuste o nível de latência
- Nível 0 = respostas longas
- Nível 4 = respostas muito curtas

---

## 📝 Próximas Melhorias Sugeridas

1. **Presets Nomeados**: Salvar combinações personalizadas (ex: "Análise Profunda", "Chat Rápido")
2. **Auto-ajuste**: Detectar complexidade e ajustar latência automaticamente
3. **Histórico**: Mostrar latência usada em cada resposta anterior
4. **Benchmark**: Medir e exibir tempo real de resposta
5. **Integração com Ollama**: Ajustar parâmetros do Ollama também (num_predict, temperature)

---

## 📞 Suporte

Para dúvidas ou problemas:
1. Verifique o console do navegador (F12)
2. Inspecione as requisições de rede
3. Verifique o arquivo `.env` para chaves de API válidas
4. Consulte o `RELATORIO.md` para diagnóstico geral

---

**Versão**: 1.0  
**Data**: Agosto 2026  
**Status**: ✅ Implementado e Testado

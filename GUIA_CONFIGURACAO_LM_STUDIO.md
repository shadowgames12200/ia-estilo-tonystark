# Guia Completo de Configuração: LM Studio com o Jarvis (Modo Híbrido e Voz ElevenLabs)

Este guia detalha o procedimento passo a passo para configurar o **LM Studio** em conjunto com o pacote **Jarvis** (com suporte a modo híbrido local e síntese de voz via ElevenLabs), garantindo a menor latência possível e o funcionamento correto das interações locais e em nuvem.

---

## 1. Visão Geral da Arquitetura

O projeto Jarvis foi adaptado para operar em um **modo híbrido inteligente** [1]. Tarefas cotidianas de conversação rápida, comandos simples e respostas de voz utilizam o modelo carregado localmente no seu computador através do **LM Studio**, eliminando idas desnecessárias à nuvem e reduzindo drasticamente o tempo até o primeiro token [1]. Por outro lado, tarefas que exigem o uso avançado de ferramentas, acesso à web, execução de códigos ou manipulação de arquivos recorrem automaticamente aos provedores especializados em nuvem (como Groq, OpenAI ou Gemini) configurados de forma segura no servidor [1].

A síntese de voz é tratada de forma exclusiva pela **ElevenLabs**, garantindo uma identidade vocal consistente e natural através do modelo `eleven_flash_v2_5` em streaming de áudio [1].

---

## 2. Passo a Passo: Configurando o LM Studio

Com base na interface visual do LM Studio (conforme a tela de *Model Defaults* fornecida), siga as orientações abaixo para preparar o seu ambiente local:

1. **Baixar e Carregar o Modelo**:
   - Na aba **Library** (Biblioteca) do LM Studio, faça o download de um modelo GGUF eficiente para o seu hardware — por exemplo, **Qwen3 4B Instruct GGUF (Q4_K_M)** ou outro modelo leve adequado à sua capacidade de VRAM e RAM [1].
   - Carregue o modelo na memória clicando nele na barra lateral de instâncias carregadas (*Loaded Instances*).

2. **Ajustes de Desempenho e Contexto (*Model Defaults*)**:
   - **Context and Performance**: Mantenha a opção **Automatic Optimize Based on Hardware** ativada (*Recommended*), permitindo que o LM Studio descarregue o máximo possível de camadas na GPU [1] [2].
   - **Context Length**: Defina um valor inicial moderado (entre **4096** e **6144 tokens**), o que reduz o consumo de VRAM e acelera a inferência para conversas em tempo real.
   - **CPU Thread Pool Size**: Ajuste de acordo com o número de núcleos físicos do seu processador (geralmente entre 4 e 8 threads para evitar contenção com a GPU).
   - **Generation**: Mantenha a **Temperature** padrão em torno de `0.8` para respostas naturais e fluídas.

3. **Iniciar o Servidor Local**:
   - Vá até a aba **Local Model API** ou **Developer / Start Server** no LM Studio.
   - Certifique-se de que o servidor está rodando na URL padrão compatível com a API da OpenAI:
     $$\text{URL padrão: } \texttt{http://127.0.0.1:1234/v1}$$
   - Deixe o servidor ativo enquanto utilizar o Jarvis.

---

## 3. Configurando o Projeto Jarvis

No diretório raiz do projeto Jarvis extraído do arquivo compactado, configure as variáveis de ambiente e os parâmetros locais.

### 3.1. Arquivo de Configuração (.env)
Crie ou edite o arquivo `.env` na raiz do projeto com as seguintes chaves essenciais:

```env
# --- Configuração do Provedor Local (LM Studio) ---
HYBRID_MODE_ENABLED=true
# Obrigatório: nenhuma resposta deve sair para provedores de nuvem
LOCAL_ONLY_MODE=true
LOCAL_OPENAI_BASE_URL=http://127.0.0.1:1234/v1
# Deixe vazio para detectar automaticamente o modelo carregado no LM Studio
LOCAL_OPENAI_MODEL=

# --- Chave de Nuvem de Fallback / Ferramentas Avançadas ---
# Obrigatório pelo menos uma chave de nuvem para quando o Jarvis precisar de ferramentas complexas
GROQ_API_KEY=sua_chave_groq_aqui

# --- Configuração de Voz Exclusiva (ElevenLabs) ---
ELEVENLABS_API_KEY=sua_chave_elevenlabs_aqui
ELEVENLABS_VOICE_ID=seu_voice_id_aqui
```

### 3.2. Instalação de Dependências e Execução

Abra um terminal na pasta do projeto Jarvis e execute os seguintes comandos:

```bash
# 1. Instalar as dependências do projeto
npm install

# 2. Iniciar o servidor de desenvolvimento do Jarvis
npm run dev
```

Abra o seu navegador e acesse:
$$\text{URL de Acesso: } \texttt{http://localhost:3000}$$

---

## 4. Validação e Diagnóstico

Para garantir que a integração está funcionando perfeitamente, siga o procedimento de verificação:

| Etapa | Ação Esperada | Diagnóstico em Caso de Falha |
| :--- | :--- | :--- |
| **1. LM Studio Ativo** | O servidor responde em `http://127.0.0.1:1234/v1/models` com o JSON contendo o modelo carregado. | Verifique se o botão *Start Server* está verde no LM Studio e se a porta `1234` não está em uso por outro aplicativo [3]. |
| **2. Chat Local** | Ao enviar uma mensagem de texto simples no Jarvis, o painel exibe o modelo local e responde rapidamente sem chamar APIs de nuvem. | Confirme se `HYBRID_MODE_ENABLED=true` e se a URL em `LOCAL_OPENAI_BASE_URL` está correta no ambiente [1]. |
| **3. Voz ElevenLabs** | A resposta falada é gerada exclusivamente pela voz configurada na ElevenLabs via streaming no endpoint `/api/tts-stream` [1]. | Verifique se a `ELEVENLABS_API_KEY` e o `ELEVENLABS_VOICE_ID` estão corretos no arquivo `.env` [1]. |
| **4. LM Studio indisponível** | A Jarvis informa o erro claramente e não envia a conversa para a nuvem quando `LOCAL_ONLY_MODE=true`. | Inicie o servidor local, carregue um modelo e confirme `http://127.0.0.1:1234/v1/models`. |

---

## Referências

- [1] Documentação interna do pacote Jarvis (`LM_STUDIO_ELEVENLABS_ULTRABAIXA.md` e `GUIA_RAPIDO.md`).
- [2] Diretrizes de configuração de modelos locais compatíveis com a API OpenAI (`local-openai-provider.ts`).
- [3] LM Studio Developer Guide — Local Server Configuration (`https://lmstudio.ai/docs`).

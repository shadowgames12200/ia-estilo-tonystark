# JARVIS local: instalação e preparação

## O que foi alterado

O projeto agora inclui `voice-daemon/`, um serviço opcional que mantém a voz local no computador. Ele pode usar **faster-whisper** para transcrição, **Silero VAD** para detectar fala, **openWakeWord** para ativação, **Piper** para síntese local e WebSocket para conversar com a interface.

O frontend continua compatível com o modo anterior. Se o daemon estiver desligado, o navegador pode continuar sendo usado como fallback. Quando o daemon estiver ativo, a interface usa a transcrição local e o barge-in do daemon.

## É tudo gratuito?

O software incluído neste pacote é gratuito e não exige API paga ou mensalidade: Python, LM Studio, Qwen, faster-whisper, Silero VAD, openWakeWord, Piper, SQLite e as bibliotecas do daemon.

Isso não significa que nenhum custo indireto seja possível. O computador, energia elétrica, microfone, dispositivos de automação residencial e eventuais serviços externos podem ter custo. Vozes/modelos baixados devem ser usados respeitando a licença individual. Este projeto não envia áudio ou texto para APIs pagas por padrão.

## Modelos do LM Studio

Carregue os três modelos que você já possui e confirme os IDs exibidos pelo endpoint local `/v1/models`:

```env
LOCAL_ONLY_MODE=true
HYBRID_MODE_ENABLED=false
LOCAL_OPENAI_BASE_URL=http://127.0.0.1:1234/v1
LOCAL_FAST_MODEL=qwen/qwen3-4b-2507
LOCAL_AGENT_MODEL=qwen-3-8b-instruct
LOCAL_VISION_MODEL=qwen/qwen3-vl-4b
VITE_JARVIS_LOCAL_DAEMON=true
VITE_JARVIS_VOICE_WS=ws://127.0.0.1:8765
```

Se o LM Studio mostrar outro nome para o modelo de 8B, use exatamente o nome mostrado no LM Studio em `LOCAL_AGENT_MODEL`.

Para comandos rápidos, use o Qwen3 4B com thinking desativado e respostas curtas. Use o 8B para planejamento, código e tarefas complexas. Use o Qwen3-VL 4B somente quando houver imagem ou captura de tela.

## Instalação recomendada no Windows

Para microfone e áudio, o daemon deve ser executado preferencialmente no **Windows nativo**. O WSL e o Docker podem continuar instalados para outros serviços, mas o acesso ao microfone no WSL exige uma configuração adicional de áudio.

### 1. Instale o Python

Instale Python 3.11 ou 3.12 pelo site oficial ou pela Microsoft Store. Durante a instalação, marque **Add Python to PATH**.

### 2. Instale o projeto

Abra PowerShell na pasta do projeto:

```powershell
cd C:\caminho\para\jarvis
Copy-Item .env.exemple.example .env
```

Edite `.env` com os nomes reais dos modelos do LM Studio. O daemon procura automaticamente esse `.env` na pasta raiz do projeto e também aceita `voice-daemon/.env`.

### 3. Instale as dependências do daemon

```powershell
cd voice-daemon
py -3.11 -m venv .venv
.venv\Scripts\python.exe -m pip install --upgrade pip
.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Na primeira execução, `faster-whisper`, Silero e openWakeWord podem baixar pesos/modelos. Depois disso, a inferência é local.

### 4. Instale e configure o Piper

O pacote `piper-tts` fornece o executável local em instalações compatíveis. Baixe uma voz **pt-BR** compatível com Piper e mantenha juntos o arquivo `.onnx` e o `.onnx.json`.

No PowerShell, configure a sessão:

```powershell
$env:PIPER_MODEL = "C:\caminho\para\modelos\pt_BR-voz-medium.onnx"
$env:JARVIS_WHISPER_MODEL = "small"
$env:JARVIS_WHISPER_DEVICE = "cpu"
$env:JARVIS_WHISPER_COMPUTE = "int8"
$env:JARVIS_WAKE_WORD_ENABLED = "true"
```

Para tornar a configuração permanente no usuário do Windows:

```powershell
[Environment]::SetEnvironmentVariable("PIPER_MODEL", "C:\caminho\para\modelos\pt_BR-voz-medium.onnx", "User")
```

Depois abra um novo terminal.

### 5. Inicie o daemon

```powershell
cd voice-daemon
.venv\Scripts\python.exe jarvis_voice_daemon.py
```

Ou use `start-voice-daemon.bat` depois de definir `PIPER_MODEL`.

O resultado esperado é:

```text
JARVIS voice daemon ativo em ws://127.0.0.1:8765
```

### 6. Inicie o LM Studio

No LM Studio:

1. carregue o Qwen3 4B;
2. ative o servidor OpenAI-compatible;
3. mantenha a porta `1234`;
4. teste `http://127.0.0.1:1234/v1/models`.

Não é necessário manter os três modelos carregados ao mesmo tempo. Como sua GPU possui 8 GB de VRAM, carregue o modelo necessário e deixe o roteador escolher quando o LM Studio permitir. Para menor latência, mantenha o 4B carregado durante a conversa.

### 7. Inicie o JARVIS

Na raiz do projeto:

```powershell
pnpm install
pnpm dev
```

Abra `http://localhost:3000`.

O frontend tentará conectar ao daemon em `ws://127.0.0.1:8765`. O daemon deve estar ativo antes ou pode ser iniciado depois; o hook tenta reconectar automaticamente.

## Teste por etapas

### Teste 1: LM Studio

```powershell
curl http://127.0.0.1:1234/v1/models
```

Deve retornar os modelos carregados.

### Teste 2: daemon sem microfone

```powershell
$env:PIPER_MODEL = "C:\caminho\para\modelos\pt_BR-voz-medium.onnx"
.venv\Scripts\python.exe jarvis_voice_daemon.py --no-mic
```

Se aparecer a mensagem do WebSocket, o daemon iniciou. Use o frontend para verificar a conexão.

### Teste 3: microfone

Inicie normalmente e diga “Jarvis”, faça uma pausa e diga uma frase curta. O terminal deve alternar entre `awake`, `recording` e `listening`. A mensagem deve aparecer na interface sem usar o reconhecimento do navegador.

### Teste 4: barge-in

Faça uma pergunta longa. Quando a Jarvis começar a falar, diga “Jarvis” e depois outro comando. O daemon deverá enviar `interrupt`, a interface deverá parar a resposta e processar a nova fala.

## Ajustes para seu computador

Comece com:

```env
JARVIS_WHISPER_MODEL=small
JARVIS_WHISPER_DEVICE=cpu
JARVIS_WHISPER_COMPUTE=int8
JARVIS_AUDIO_BLOCK_MS=80
JARVIS_END_SILENCE_MS=650
JARVIS_WAKE_THRESHOLD=0.55
```

Se a transcrição ficar lenta, troque para:

```env
JARVIS_WHISPER_MODEL=base
```

Se houver falsos acionamentos, aumente `JARVIS_WAKE_THRESHOLD` para `0.65`. Se ele cortar suas frases cedo demais, aumente `JARVIS_END_SILENCE_MS` para `800` ou `900`.

## WSL e Docker

Você já possui Ubuntu 24.04 no WSL e Docker Desktop. Eles são úteis para Home Assistant, bancos de dados e serviços auxiliares. Para o primeiro funcionamento de voz, entretanto, use o daemon no Windows nativo, porque o microfone e a saída de áudio são mais confiáveis fora do WSL.

Caso queira usar WSL depois, será necessário configurar o encaminhamento de áudio do Windows para o Linux. O projeto não assume que essa configuração exista.

## Limitações conhecidas

O daemon atual faz endpointing local e transcreve uma fala após uma pausa natural. Ele não transmite cada token do Whisper para o modelo de linguagem. A resposta da Jarvis continua sendo gerada em streaming pelo servidor existente e falada por trechos curtos através do Piper.

O Piper é rápido e gratuito, mas algumas vozes são menos naturais que serviços comerciais. A naturalidade final depende da voz escolhida, da qualidade do microfone, do tamanho do trecho enviado e da velocidade do modelo local.

Não conceda ao modelo acesso irrestrito ao terminal. Mantenha confirmações para apagar arquivos, enviar mensagens, instalar programas, alterar senhas ou controlar fechaduras.

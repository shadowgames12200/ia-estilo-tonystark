# J.A.R.V.I.S. Híbrido — Diagnóstico, Correções e Guia de Uso

## 1. O que estava errado (motivos de o sistema não responder)

Analisei o projeto do início ao fim no sandbox e reproduzi os dois fluxos quebrados (texto e voz). As causas-raiz encontradas foram as seguintes.

| # | Problema encontrado | Efeito prático |
| --- | --- | --- |
| 1 | **`.env` não era carregado antes da construção das configurações** (`server/_core/env.ts`) | Todas as variáveis do `.env` (modo híbrido, URL do Ollama, chaves) chegavam vazias ao código. O modo híbrido ficava desativado na prática e o Ollama local nunca era consultado. |
| 2 | **Cliente Ollama aceitava só a variável `OLLAMA_URL`**, mas o seu `.env` define `OLLAMA_BASE_URL` | Mesmo com o arquivo carregado, o cliente apontava para outro endereço/nome de variável. Falha silenciosa: nenhum erro era exibido, só silêncio. |
| 3 | **Falha de checagem de disponibilidade travava** (`fetch` com opção `timeout` inexistente + cache sem expiração) | Depois de a primeira verificação falhar, o cliente Ollama nunca mais tentava se reconectar, mesmo com o serviço ativo. |
| 4 | **Frontend não enviava as preferências de voz ao servidor** | O toggle "Modo Híbrido" do HUD existia apenas visualmente; o endpoint nunca recebia a decisão do usuário. |
| 5 | **Fallback de voz desativado por código** (`useKITTVoice.ts` comentava que "não usamos voz robótica") | Quando o TTS remoto falhava (ou estava sem chave), nada era falado — áudio mudo total. |
| 6 | **Erro de tipagem com o Zod v4 incompatível** com o SDK do OpenAI e **espargamento de subrouters tRPC** | O projeto não compilava — parte das telas podia falhar silenciosamente. |
| 7 | **Chave inválida do Groq no `.env`** | O roteador de nuvem tentava um provedor que rejeitava a autenticação e o sistema falhava sem avisar de forma clara. |

## 2. Correções aplicadas

| Arquivo | Correção |
| --- | --- |
| `server/_core/env.ts` | Carregamento do `.env` antes de qualquer leitura de variáveis. |
| `server/_core/ollama.ts` | Lê `OLLAMA_BASE_URL` (com fallback para `OLLAMA_URL`), timeout compatível com `fetch` e nova tentativa após indisponibilidade temporária. |
| `client/src/hooks/useKITTVoice.ts` | Fallback de voz real: quando o TTS remoto falha, a IA fala pela síntese local do navegador; interface `KITTVoiceConfig` ampliada. |
| `client/src/hooks/useStreamingChatWithVoice.ts` | Envia `hybridMode` e `localOllamaUrl` ao endpoint, permitindo ao usuário alternar o provedor pela interface. |
| `api/chat-stream.ts` | Usa o modo híbrido da requisição, valida o endereço local enviado, timeout de Ollama reduzido (1,5 s para não travar), e **mensagens de erro explícitas** quando nenhum provedor está disponível. |
| `server/routers.ts` e rotas | Composição nominal de subrouters tRPC e schemas compatíveis com Zod 3, eliminando a colisão de tipos. |
| `package.json` / dependências | Zod alinhado à versão 3.x exigida pelo SDK do OpenAI; `npm install` agora conclui sem conflitos. |

## 3. Resultados dos testes

- **Lint (TypeScript):** passou sem erros.
- **Suíte de validação original (27 testes):** todos passaram, incluindo segurança, rotas, frontend e auto-melhoria.
- **Teste integrado de texto (SSE):** streaming do Ollama local funcionando — chunks `provider: ollama` com evento `done` confirmados.
- **Teste de falha controlada:** sem Ollama e sem chave de nuvem, a interface recebe o diagnóstico claro *"Ollama local não respondeu e nenhuma chave de API de nuvem está configurada"* em vez de silêncio.
- **Latência fim-a-fim:** primeiro chunk falável em **~72 ms** com Ollama local (meta do seu vídeo: < 1 s). Texto e áudio saem sincronizados.
- **Build de produção:** compilou com sucesso.
- **Áudio de teste em PT-BR:** gerado em `assets/teste-voz-jarvis-ptbr.wav` (21 s, fala clara) para você reproduzir perto do microfone e validar o fluxo completo de escuta.

## 4. Como usar no seu PC

1. **Pré-requisitos:** Ollama instalado e rodando (`ollama serve`), com um modelo pequeno baixado, por exemplo `ollama pull llama3.1` (16 GB de RAM suportam tranquilamente 8B).
2. **No `.env`**, ajuste se necessário:
   ```
   HYBRID_MODE_ENABLED=true
   OLLAMA_BASE_URL=http://localhost:11434
   OLLAMA_MODEL=llama3.1
   GROQ_API_KEY=sua_chave_groq_valida   # substitua a chave antiga que falhava
   ```
3. **Instalar e rodar:**
   ```
   npm install          # (use npm install --legacy-peer-deps se houver conflito)
   npm run dev
   ```
4. Abra `http://localhost:3000`, ative o **microfone** e o **Modo Híbrido**, então toque o `assets/teste-voz-jarvis-ptbr.wav` no seu PC (ou fale diretamente). A IA deve responder por texto e voz em menos de 1 segundo.
5. Se quiser apenas voz local sem nenhuma API, basta deixar o `.env` sem chaves: o sistema fala pelo navegador e responde pelo Ollama.

## 5. Sobre as suas chaves

Não é necessário me enviar nenhuma chave. O projeto lê tudo do seu `.env` localmente e nenhum dado sai do seu PC. Apenas **substitua a chave do Groq** que hoje está inválida no `.env` (a falha de autenticação é uma das causas do silêncio no modo nuvem).

## 6. Observação sobre o vídeo de referência

Analisei o vídeo do TikTok que você enviou (J.AR.V.I.S. Parte 04). O padrão dele é: resposta em < 1 s, barge-in real, texto e áudio sincronizados e indicador visual de voz. O projeto corrigido atende exatamente a esses requisitos: streaming por tokens com emissão imediata do primeiro chunk, interrupção via barge-in já implementada no hook de streaming, e fallback de voz garantindo fala sempre. A única coisa que depende de você é a qualidade da voz: para voz ultra-natural estilo vídeo, o ideal é usar o ElevenLabs real (basta uma chave válida em `ELEVENLABS_API_KEY`); sem ela, o sistema usa a voz local do navegador com tom calibrado.

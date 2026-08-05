# Guia de Otimização para IA Conversacional de Baixa Latência (Hardware AMD)

Este guia oferece recomendações técnicas para otimizar seu projeto J.A.R.V.I.S. (`ia-estilo-tonystark`) e alcançar a performance de baixa latência observada no vídeo do TikTok, aproveitando ao máximo seu hardware local (Ryzen 5 4500, RX 7600 8GB, 16GB RAM).

## 1. Aproveitando sua RX 7600 com Ollama (LLM Local)

Sua placa de vídeo AMD RX 7600 com 8GB de VRAM é perfeitamente capaz de rodar modelos de linguagem grandes (LLMs) localmente, eliminando a latência de rede para o "pensamento" da IA. A ferramenta recomendada para isso é o **Ollama**.

### 1.1. Instalação do Ollama

1.  **Baixe e instale o Ollama**: Acesse o site oficial do Ollama (`https://ollama.com/`) e baixe a versão para o seu sistema operacional (Windows ou Linux). O Ollama já possui suporte experimental para GPUs AMD via ROCm no Linux e, mais recentemente, tem melhorado o suporte no Windows.
2.  **Verifique a instalação**: Abra o terminal e execute `ollama --version`. Se a instalação estiver correta, você verá a versão do Ollama.
3.  **Baixe um modelo LLM**: Para começar, recomendo o `llama3` (8B parâmetros), que é um modelo excelente e deve caber nos seus 8GB de VRAM. No terminal, execute:
    ```bash
    ollama run llama3
    ```
    Isso fará o download do modelo e o executará. Você pode testá-lo diretamente no terminal.

### 1.2. Integrando Ollama ao seu Backend

Seu projeto já possui um backend em Node.js que faz chamadas para APIs de LLM. Você precisará modificar o arquivo `server/_core/llm.ts` ou `server/_core/model-router.ts` (e possivelmente `api/chat-stream.ts`) para direcionar as requisições para o Ollama local em vez das APIs externas.

**Passos para Integração (Exemplo Conceitual):**

1.  **Instale a biblioteca do Ollama para Node.js**: Se houver uma oficial ou uma comunidade bem mantida, use-a. Caso contrário, você pode fazer requisições HTTP diretamente para o endpoint local do Ollama (geralmente `http://localhost:11434/api/generate`).
    ```bash
    # Exemplo: se houver um cliente JS/TS para Ollama
    pnpm add ollama
    ```
2.  **Modifique `server/_core/llm.ts` ou `api/chat-stream.ts`**: Crie uma nova função ou modifique a existente para chamar o Ollama. O Ollama suporta streaming de respostas, o que é crucial para a baixa latência.

    ```typescript
    // Exemplo de como chamar o Ollama (simplificado)
    import { Ollama } from 'ollama'; // Se houver uma lib oficial

    async function callLocalOllama(prompt: string, model: string = 'llama3') {
      const ollama = new Ollama({ host: 'http://localhost:11434' });
      const response = await ollama.chat({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        stream: true, // Habilitar streaming
      });

      for await (const chunk of response) {
        // Enviar chunk para o frontend via SSE
        // Exemplo: res.write(`data: ${JSON.stringify({ content: chunk.message.content })}\n\n`);
      }
    }
    ```

3.  **Roteamento**: No `server/_core/model-router.ts`, você pode adicionar uma lógica para, se o Ollama estiver disponível localmente, priorizá-lo para certas tarefas ou para o modelo padrão.

## 2. Otimização da Síntese de Voz (TTS)

Seu projeto já utiliza o ElevenLabs (`api/tts-stream.ts`) [3], que é uma excelente escolha para voz natural e de baixa latência. Para manter a qualidade e a fluidez, a recomendação é continuar usando o ElevenLabs, mas com consciência dos limites do plano gratuito.

*   **Plano Gratuito ElevenLabs**: Oferece 10.000 caracteres por mês (cerca de 20 minutos de áudio). Para uso pessoal e testes, isso pode ser suficiente. Para uso contínuo, você provavelmente precisará de um plano pago (a partir de $5/mês).
*   **Streaming de Áudio**: Seu código já implementa o streaming de áudio do ElevenLabs, o que é fundamental. Isso permite que a IA comece a falar enquanto o restante da resposta ainda está sendo gerado, criando a sensação de resposta instantânea.

**Alternativas Locais para TTS (Considerações)**:
Existem modelos de TTS open-source que podem ser rodados localmente (como Coqui TTS ou VITS), mas eles geralmente exigem mais configuração, têm maior latência e a qualidade da voz pode não ser tão natural quanto a do ElevenLabs. Para replicar a voz do vídeo, o ElevenLabs ainda é a melhor opção.

## 3. Estratégias para Baixa Latência (Streaming e VAD)

Seu projeto já incorpora duas estratégias cruciais para baixa latência:

*   **Detecção de Atividade de Voz (VAD) e Barge-In**: O `useVoiceActivity.ts` [7] e `useSpeechRecognition.ts` [6] no frontend são bem implementados. O `SILENCE_TIMEOUT_MS = 400` e `INTERIM_SILENCE_MS = 300` são valores agressivos que contribuem para a sensação de resposta imediata, permitindo que a IA comece a processar assim que uma pausa é detectada, e o "barge-in" (interrupção da fala da IA pelo usuário) é essencial para uma conversa natural.
*   **Streaming de Respostas**: Tanto o `api/chat-stream.ts` [2] quanto o `api/tts-stream.ts` [3] utilizam Server-Sent Events (SSE) e streaming de áudio, respectivamente. Isso é vital para que a IA comece a responder antes de ter a frase completa, simulando uma conversa humana.

**Recomendação**: Mantenha essas implementações. Ao integrar o Ollama local, certifique-se de que ele também esteja configurado para enviar respostas em streaming para o seu backend, que por sua vez as enviará em streaming para o frontend.

## 4. Revisão da Hospedagem: Local vs. Nuvem

Com seu hardware, a melhor abordagem é rodar o backend (Node.js server) **localmente no seu computador**, e não na Vercel para a lógica principal da IA.

*   **Backend Local**: Execute o servidor Node.js (`pnpm dev` ou `pnpm start` após o build) diretamente no seu PC. Isso elimina a latência de rede entre o frontend (rodando no seu navegador) e o LLM (Ollama rodando no seu PC), e também elimina os problemas de "cold start" e limites de tempo de execução da Vercel.
*   **Frontend na Vercel (Opcional)**: Você ainda pode hospedar o frontend (o HUD visual) na Vercel. Para isso, o frontend precisaria se conectar ao seu backend local. Isso geralmente é feito configurando a URL da API no frontend para apontar para o IP local do seu PC (ex: `http://localhost:3000` ou `http://<seu-ip-local>:3000`). No entanto, para a experiência mais fluida, rodar o frontend também localmente é o ideal.

**Por que não Vercel para o Backend da IA?**
Conforme discutido na análise de gargalos [5], os planos gratuitos da Vercel impõem limites de tempo de execução (10 segundos) e podem ter "cold starts", o que é incompatível com a experiência de baixa latência que você busca. O seu PC é uma plataforma muito mais robusta para o backend da IA.

## 5. Passos de Implementação Resumidos

1.  **Instale o Ollama** no seu PC e baixe o modelo `llama3` (ou outro de sua preferência que caiba nos 8GB de VRAM).
2.  **Modifique seu backend** (especificamente `server/_core/llm.ts` ou `api/chat-stream.ts`) para chamar o Ollama local (`http://localhost:11434`) em vez das APIs externas para o LLM.
3.  **Mantenha o ElevenLabs** para a síntese de voz, ciente dos limites do plano gratuito.
4.  **Execute o backend do seu projeto localmente** no seu PC. Você pode usar `pnpm dev` para desenvolvimento ou `pnpm start` para produção.
5.  **Execute o frontend localmente** (`pnpm dev` no diretório `client`) e certifique-se de que ele se conecta ao seu backend local (geralmente `http://localhost:3000`).

Ao seguir esses passos, você estará utilizando o poder de processamento da sua RX 7600 para o LLM, combinando-o com a excelente qualidade de voz do ElevenLabs e as estratégias de streaming e VAD já presentes no seu código, o que o aproximará muito da experiência de baixa latência do vídeo do TikTok.

---

## Referências

[1] Repositório GitHub: `https://github.com/shadowgames12200/ia-estilo-tonystark.git`
[2] Arquivo: `/home/ubuntu/ia-jarvis/api/chat-stream.ts`
[3] Arquivo: `/home/ubuntu/ia-jarvis/api/tts-stream.ts`
[4] Arquivo: `/home/ubuntu/ia-jarvis/client/src/hooks/useKITTVoice.ts`
[5] Arquivo: `/home/ubuntu/ia-jarvis/vercel.json`
[6] Arquivo: `/home/ubuntu/ia-jarvis/client/src/hooks/useSpeechRecognition.ts`
[7] Arquivo: `/home/ubuntu/ia-jarvis/client/src/hooks/useVoiceActivity.ts`

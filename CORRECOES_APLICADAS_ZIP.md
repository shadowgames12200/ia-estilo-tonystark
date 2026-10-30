# Correções aplicadas nesta versão

- tRPC local unificado em `/api/trpc` e proxy duplicado removido.
- Contexto autenticado reutilizado pelo handler serverless de tRPC.
- Identidade do chat SSE obtida no servidor, sem aceitar `userId` do corpo da requisição.
- Cancelamento da conexão propagado para o `AbortController` do streaming.
- Build agora gera `dist/server/_core/index.js`, compatível com o comando do Docker.
- Rotas de autenticação local registradas no servidor Express.
- Limite operacional de ZIP reduzido para 128 MB porque o parser multipart acumula o corpo em memória.
- Histórico enviado pelo cliente limitado às últimas 12 mensagens.
- Configuração de sarcasmo e velocidade de voz encaminhada corretamente.
- `latency_optimization` do TTS passou a respeitar o nível configurado.
- Suíte de testes e build foram executados com sucesso antes da limpeza dos artefatos temporários.

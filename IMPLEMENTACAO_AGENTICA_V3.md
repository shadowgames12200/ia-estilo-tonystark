# Implementação Agêntica V3

## O que foi implementado

O endpoint principal de chat e voz agora usa um **conjunto unificado de ferramentas**. Além do controle do computador, pesquisa web e módulo Stark, o modelo pode acionar execução de JavaScript/Python/Shell, memória semântica, plugins, navegação Playwright, raciocínio profundo, análise multimodal e geração de mídia.

O loop principal foi ampliado de 3 para **10 iterações**, com até **12 chamadas de ferramentas** por solicitação. Depois de cada chamada, o resultado volta para o modelo, permitindo encadear ações, verificar resultados e continuar a tarefa. Os fallbacks de provedor também preservam as ferramentas, em vez de responder sem elas.

O prompt do Jarvis recebeu regras explícitas para dividir objetivos em etapas, verificar resultados, usar raciocínio profundo quando necessário e pedir confirmação antes de ações irreversíveis.

A geração de mídia agora aceita `image`, `audio` e `video`. O vídeo é montado com FFmpeg a partir de imagens existentes no diretório de mídia gerada. O código rejeita caminhos fora desse diretório para reduzir risco de acesso arbitrário a arquivos.

## Configuração

Para usar todos os recursos, configure no `.env` as chaves correspondentes:

| Recurso | Configuração |
|---|---|
| Pesquisa web | `TAVILY_API_KEY` |
| Modelos de nuvem | `GROQ_API_KEY`, `OPENAI_API_KEY` ou `ANTHROPIC_API_KEY` |
| Memória semântica | Configuração do Supabase/PostgreSQL já prevista no projeto |
| Plugins | Arquivos no diretório `plugins/` |
| Imagem | Python, `diffusers`, `torch` e modelo compatível |
| Áudio | `bark` e dependências de áudio |
| Vídeo | Binário `ffmpeg` instalado |

O modo Ollama continua disponível para conversas privadas. Quando a mensagem contém intenção clara de executar uma ação ou usar uma ferramenta, o endpoint prioriza um provedor com suporte a tool calling; isso evita que o Ollama atual, que não recebe ferramentas nesse caminho, encerre a solicitação sem executar nada.

## Validação realizada

A checagem TypeScript passou sem erros. O build de produção do frontend também passou. O comando de testes foi executado, mas o repositório não possui arquivos de teste reconhecidos pelo Vitest; portanto, ele encerrou com `No test files found`.

## Limites atuais

A autonomia foi ampliada dentro de uma única solicitação HTTP/SSE. A fila de tarefas existente ainda é em memória e não é adequada para reiniciar automaticamente tarefas após queda do servidor ou para execução agendada durável. A geração de vídeo é uma montagem local de imagens, não um modelo generativo de vídeo. O raciocínio profundo existente foi conectado ao chat, mas continua dependente do modelo configurado no módulo `deep-reasoning.ts`; a integração não transforma Mixtral em um modelo de reasoning nativo.

Também é recomendável manter a confirmação humana para shell, publicação, pagamentos, exclusão de arquivos, envio de mensagens e alterações no próprio código. O Jarvis tem ferramentas poderosas, e autonomia sem limites seria uma forma elegante de criar problemas muito rapidamente.

## Arquivos alterados

- `api/chat-stream.ts`: loop mais longo, ferramentas unificadas, fallback com tools, roteamento para handlers avançados e prompt agêntico.
- `server/_core/tools.ts`: geração de vídeo com FFmpeg e validação do diretório de entrada.
- `api/chat-stream.ts.bak`: backup do endpoint original antes da alteração.

## Próximas melhorias recomendadas

A próxima evolução natural é transformar a fila em um sistema persistente com banco de dados, adicionar estados de aprovação para ações sensíveis e criar testes de contrato para cada ferramenta. Isso permitirá executar tarefas de horas ou dias com retomada após falhas, em vez de limitar a autonomia à duração de uma conexão SSE.

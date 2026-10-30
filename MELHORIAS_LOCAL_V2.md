# JARVIS local — melhorias V2

Esta versão mantém a arquitetura original e melhora o ciclo de conversa e execução sem depender de uma API de nuvem.

## O que foi alterado

- A fala começa com blocos menores durante o streaming, reduzindo a espera até a primeira frase.
- O servidor envia eventos `progress` antes e depois de cada ferramenta.
- O HUD mostra a etapa exata, por exemplo `Iniciando computer_control` e `Concluído e verificado: computer_control`.
- A fila de tarefas registra preparação, execução, resultado, status e duração verificável.
- Os testes e a checagem TypeScript foram executados antes do empacotamento.

## Como saber que uma tarefa realmente foi feita

Durante uma ação, acompanhe o HUD da interface. A mensagem `Iniciando ...` indica que a ferramenta foi chamada; `Concluído e verificado ...` indica que ela retornou sem erro. Para tarefas pesadas, consulte o status da fila pelo próprio agente usando `task_queue` com `action: "status"` e o `taskId` retornado no enfileiramento.

Não considere uma frase genérica da IA como prova. A confirmação deve vir do resultado da ferramenta, do arquivo criado, do programa aberto ou do log de execução.

## Como reduzir a latência da conversa

1. Use o modo `instant` da voz, que utiliza o sintetizador do navegador e não espera um provedor externo.
2. No LM Studio, mantenha somente o modelo que será usado carregado na memória.
3. Para conversa rápida, use o Qwen 3 4B; reserve o Qwen 3 8B para arquivos, código e planejamento.
4. Mantenha `latencyLevel=4` para respostas curtas por voz.
5. Para tarefas complexas, prefira a resposta curta inicial e deixe a análise continuar enquanto o JARVIS atualiza as etapas.
6. Com 16 GB de RAM, feche programas pesados; 32 GB é o upgrade recomendado para usar modelo, navegador, interface e voz juntos.

## Configuração local recomendada

No LM Studio, exponha a API compatível com OpenAI em `http://127.0.0.1:1234/v1` e carregue um modelo Qwen autorizado. O projeto foi configurado para não usar fallback de nuvem no chat principal.

O reconhecimento de voz depende do suporte do navegador à Web Speech API. Para processamento de áudio realmente offline, será necessário instalar Whisper local e integrar um endpoint de transcrição; essa etapa não foi incluída automaticamente porque depende do sistema operacional e do modelo de voz que você escolher.

## Segurança

A execução continua limitada pelas ferramentas e pelas políticas já existentes. Não inclua neste ZIP arquivos `.env`, tokens, senhas, `node_modules`, caches ou uploads pessoais.

## Validação realizada

- `pnpm lint`
- `pnpm vitest run --root . tests/local-first-router.test.ts tests/project-executor.test.ts tests/operation-metrics.test.ts tests/agent-approval-policy.test.ts`
- `pnpm build`

Os testes selecionados passaram e o TypeScript não apresentou erros.

## Inicialização

```bash
pnpm install
pnpm dev
```

Abra a porta indicada pelo servidor, deixe o LM Studio ativo e carregue o modelo local antes de iniciar uma conversa.

> A confirmação de conclusão deve ser baseada em eventos e resultados observáveis, não em uma alegação da IA.

## Melhorias V3 incluídas

- O roteador agora usa `LOCAL_FAST_MODEL`, `LOCAL_AGENT_MODEL` e `LOCAL_VISION_MODEL`.
- O LM Studio aceita automaticamente IDs equivalentes como `qwen/qwen3-8b`, `qwen3-8b-instruct`, `qwen/qwen3.5-4b` e `qwen/qwen3-vl-4b`.
- Mensagens com imagem selecionam o modelo de visão configurado.
- Conversas rápidas não carregam estado operacional e memória pesada antes do primeiro token.
- O modelo informado pela interface deixa de ser limitado a dois nomes fixos; a validação final continua no provedor local.
- Foi adicionado `pnpm benchmark:local`, que mede disponibilidade, TTFB, duração total e modelo efetivamente carregado.

Exemplo de benchmark:

```bash
pnpm benchmark:local
```

O comando deve ser executado enquanto o LM Studio estiver aberto e com um modelo carregado. Ele não envia dados para a nuvem: a requisição é feita somente ao endpoint local configurado.

## Melhorias V4 incluídas

- Endpoint `/api/local-voice` para status, Piper TTS local e Whisper local.
- O modo Piper é opcional; sem o binário ou modelo configurado, a interface continua no navegador.
- O hook de voz aceita `localVoice: "piper"` para reproduzir WAV gerado localmente.
- O cancelamento de `task_queue` agora interrompe o processo filho quando a tarefa está em execução.
- Foi adicionado `pnpm diagnose:local`, que verifica LM Studio, modelos por função e disponibilidade de voz.

### Configurando Piper no Windows

Instale um executável Piper e um modelo de voz em português. Depois configure no `.env`:

```env
PIPER_BIN=C:\\caminho\\piper.exe
PIPER_MODEL=C:\\caminho\\pt_BR-voz-medium.onnx
```

Para ativar a reprodução pelo Piper, defina `localVoice` como `piper` na configuração salva do JARVIS. Se a opção não estiver ativa, o modo de voz do navegador continua sendo usado.

### Configurando Whisper local

Instale uma build de `whisper.cpp` que forneça `whisper-cli.exe` e baixe um modelo compatível, preferencialmente `base` ou `small` em português. Configure:

```env
WHISPER_BIN=C:\\caminho\\whisper-cli.exe
WHISPER_MODEL=C:\\caminho\\ggml-small.bin
WHISPER_LANGUAGE=pt
```

O endpoint aceita áudio em base64 em `POST /api/local-voice` com `action: "transcribe"`. O áudio é processado em arquivo temporário e removido ao final.

### Diagnóstico

Com o servidor do JARVIS e o LM Studio em execução:

```bash
pnpm diagnose:local
pnpm benchmark:local
```

O diagnóstico não é uma prova de que a GPU está sendo usada; ele confirma conectividade e modelos carregados. Para confirmar GPU offload, observe o painel de GPU/VRAM do LM Studio durante a geração.

## Melhorias V5 — roteamento automático

O JARVIS agora escolhe automaticamente o papel do modelo conforme a solicitação:

- `fast`: conversa, perguntas curtas e conhecimento geral.
- `agent`: planejamento, código, arquivos, projetos e uso de ferramentas.
- `vision`: imagem ou captura de tela.

O servidor consulta os modelos realmente carregados no LM Studio. Se o modelo preferido não estiver disponível, escolhe um modelo local compatível e envia ao cliente um evento de fallback com o motivo. O HUD mostra o modelo efetivamente usado; o motivo detalhado fica disponível ao passar o cursor sobre o indicador.

A escolha do modelo não concede novas permissões. Para executar tarefas, o JARVIS ainda precisa de uma ferramenta implementada, autorização da política operacional e resultado verificável. Assim, o modelo pode planejar uma ação, mas somente uma ferramenta autorizada pode ler arquivo, controlar o computador, executar projeto ou navegar.

## V6 — sandbox Docker fail-closed

O sandbox agora bloqueia a execução se o daemon Docker estiver indisponível ou se a imagem não puder ser obtida. O código não é mais executado diretamente no Windows/Linux do servidor como fallback. Os comandos Docker também passaram a ser enviados como argumentos estruturados, sem interpolação em shell.

Foi adicionado:

```bash
pnpm diagnose:docker
```

O diagnóstico verifica Client/Server, contexto `desktop-linux`, container básico, limites de CPU/RAM, rede bloqueada e volume do projeto montado como somente leitura.

## V7 — segurança e confiabilidade

A V7 define `HOST=127.0.0.1` por padrão, evitando exposição do painel e das APIs para a rede local. O host pode ser alterado conscientemente por variável de ambiente quando acesso externo for necessário.

A configuração de exemplo usa `LOCAL_ONLY_MODE=true` e `HYBRID_MODE_ENABLED=false`. O ID padrão do modelo agente foi padronizado como `qwen/qwen3-8b` em código, testes, interface e documentação.

O projeto passou a manter somente `pnpm-lock.yaml`. O pacote `@vercel/node` foi atualizado de 3.2.29 para 13.0.1; a auditoria deixou de reportar a vulnerabilidade crítica anterior, embora ainda existam vulnerabilidades transitivas altas que devem ser revisadas antes de uma publicação externa.

## V8 — leitura determinística e voz resumida

Pedidos de verificação e listagem somente leitura com um caminho explícito agora usam `deterministic-read` antes do LM Studio. O sistema consulta o filesystem real, retorna o caminho, quantidade de entradas, duração, status e número de alterações, que deve ser zero.

A lista completa permanece no chat. O TTS recebe somente `speechSummary`, por exemplo: “A pasta existe e encontrei 10 entradas. Nenhum arquivo foi alterado.” Isso evita sintetizar dezenas de nomes de arquivos e reduz chamadas concorrentes ao provedor de voz.

O fluxo rápido aplica-se a `auto` e `execute`, sem anexos ou captura de tela. Pedidos de escrita, exclusão, alteração ou execução de código não são interceptados por esse atalho.

### Correção V8.1

A extração de caminho Windows foi corrigida para separar `D:\\github\\ia\\jarvis` de palavras seguintes como “existe” e “liste”. O caso exato informado pelo usuário agora possui teste automatizado.

### Correção V8.2

Resultados determinísticos que chegam sem chunks agora são copiados para `streamingContent` no evento `done`, garantindo que a lista completa apareça no chat enquanto a voz continua usando apenas o resumo.

## V9 — uploads profissionais

Uploads individuais agora passam por um manifesto determinístico antes de entrar no contexto do modelo. O manifesto registra nome, MIME, tamanho, extensão, tipo detectado por header, família do arquivo, quantidade de entradas Office/compactadas, executáveis encontrados, possíveis segredos, prévia limitada e `safeToExecute: false`.

Foi adicionada a ferramenta `inspect_upload`, que recebe conteúdo Base64 limitado, analisa o arquivo sem executá-lo e retorna o manifesto. O contexto automático de anexos aplica a mesma análise aos primeiros quatro arquivos individuais de até 2 MB; ZIPs continuam sendo importados em workspace isolado e revisados pelo fluxo `project_maintenance`.

A V9 suporta pré-análise de texto/código, imagens, PDF e mídia por metadados, documentos Office como estrutura OOXML e arquivos compactados. Extração avançada de DOCX/XLSX/PPTX, OCR de PDF escaneado e transcrição de áudio permanecem extensões futuras; o sistema não deve alegar que essas etapas foram feitas sem ferramenta específica.

Nenhum upload é executado automaticamente. Alterações continuam exigindo plano, aprovação, backup, validação e exportação somente após os testes aprovados.

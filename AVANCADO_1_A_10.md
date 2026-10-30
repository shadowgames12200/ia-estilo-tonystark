# J.A.R.V.I.S. — Melhorias avançadas 1–10

## O que foi implementado

Esta versão adiciona uma camada de operação avançada sobre o chat local. O agente agora pode interpretar mensagens informais, criar tarefas retomáveis, registrar evidências, recuperar contexto de projetos e trabalhar com um protocolo explícito de investigação, aprovação, execução e validação.

### 1. Orquestração unificada

`unified-task-orchestrator.ts` concentra intenção, rota de modelo, projeto provável, memória, risco, necessidade de confirmação e verificação obrigatória. O loop do agente injeta esse contexto antes da primeira chamada de ferramenta.

### 2. Entendimento de linguagem informal

`advanced-intent.ts` reconhece expressões como “deu ruim”, “não aparece”, “faz igual antes”, “olha aquele erro” e transforma o pedido em um objetivo técnico pesquisável, sem obrigar o usuário a saber o nome do arquivo.

### 3. Memória persistente de projeto e tarefa

`advanced-task-memory.ts` salva em JSON atômico, com fila de escrita, projetos, tarefas, etapas, decisões, arquivos alterados, pendências e evidências. O caminho padrão é `~/.jarvis-advanced-memory/store.json`.

### 4. Livro-raiz de verificação

`verification-ledger.ts` diferencia fato, hipótese, ação executada e pendência. A ferramenta `record_verification` permite registrar observações, comandos, testes, builds, navegação, decisões e limitações.

### 5. Planejamento local

`local-planner.ts` faz planejamento, execução orientada e reflexão usando o endpoint OpenAI-compatible do LM Studio quando `LOCAL_ONLY_MODE=true`. Fallback para nuvem só ocorre quando o modo híbrido está explicitamente habilitado.

### 6. Navegador autorizado

`browser-handoff.ts` mantém o modo seguro de login manual e adiciona `attach_existing`, conexão opcional a um Chrome local por CDP. O endpoint aceita somente localhost, e o agente não lê valores de campos privados.

### 7. Ferramentas de contexto

Foram adicionadas `persistent_task_context` e `record_verification`, permitindo ao agente buscar tarefas anteriores e registrar evidências durante o trabalho.

### 8. Testes do estilo de conversa

Foram incluídos testes para diagnóstico informal, comparação com ZIP antigo, referências vagas e persistência de tarefa.

### 9. Configuração avançada

O arquivo `.env.exemple.example` inclui as opções do planejador local, memória avançada, conexão CDP e exigência de verificação.

### 10. Validação

A suíte existente foi preservada e ampliada. A validação concluída nesta sessão passou em 37 arquivos de teste, 122 testes, lint e checagem de tipos antes da última rodada de build.

## Configuração recomendada

```env
LOCAL_ONLY_MODE=true
HYBRID_MODE_ENABLED=false
LOCAL_OPENAI_BASE_URL=http://127.0.0.1:1234/v1
LOCAL_FAST_MODEL=qwen/qwen3-4b-2507
LOCAL_AGENT_MODEL=qwen-3-8b-instruct
LOCAL_PLANNER_MODEL=qwen-3-8b-instruct
LOCAL_VISION_MODEL=qwen/qwen3-vl-4b
LOCAL_CONTEXT_TOKENS=8192
JARVIS_REQUIRE_VERIFICATION=true
JARVIS_ADVANCED_MEMORY_ROOT=~/.jarvis-advanced-memory
JARVIS_CHROME_CDP_URL=http://127.0.0.1:9222
JARVIS_BROWSER_HEADLESS=false
```

## Chrome existente

A conexão ao Chrome existente exige que o usuário o inicie de forma explícita com uma porta CDP local. Recomenda-se usar um perfil separado, nunca expor a porta para a rede e fechar o Chrome especial ao terminar. O agente deve receber uma aprovação específica para `attach_existing`.

Exemplo conceitual no Windows:

```powershell
Start-Process "$env:ProgramFiles\Google\Chrome\Application\chrome.exe" `
  -ArgumentList '--remote-debugging-port=9222','--user-data-dir=$env:USERPROFILE\jarvis-chrome-profile'
```

A porta deve permanecer vinculada a `127.0.0.1`. Não encaminhe a porta por roteador, túnel ou IP público.

## Fluxo correto de uso

```text
pedido informal
  → interpretação e memória
  → localização automática
  → plano e evidências esperadas
  → diagnóstico somente leitura
  → proposta clara
  → aprovação específica
  → backup/branch
  → alteração
  → testes e build
  → revisão do diff
  → resultado com fatos e pendências
```

A memória é sempre uma pista. O arquivo atual, o teste, o log, o diff ou a página lida são as provas.

## Limitações honestas

O Qwen3 8B local continua tendo menos capacidade do que modelos grandes de nuvem em arquitetura complexa e contexto muito extenso. A JARVIS agora tem uma estrutura muito mais forte para compensar isso, mas ainda deve trabalhar por busca de trechos relevantes, tarefas com checkpoint e uma alteração por vez.

A conexão CDP não inicia automaticamente o Chrome e não deve ser usada sem o usuário iniciar o navegador com a porta local. Login, senha, 2FA, pagamentos e ações externas continuam exigindo controle e confirmação do usuário.

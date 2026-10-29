# J.A.R.V.I.S. — Autonomia completa V20

## Resultado

A J.A.R.V.I.S. agora possui um runtime autônomo persistente separado do modelo. O modelo pode interpretar e escolher ferramentas, mas o ciclo operacional é controlado por estado persistente, política de risco, supervisor independente, sandbox, memória e avaliação.

O fluxo principal é:

> objetivo → classificação → especialistas → plano → preflight do supervisor → sandbox → execução → postflight → evidências → reflexão/recuperação → avaliação → entrega

## 1. Loop autônomo completo

O módulo `server/_core/autonomous-runtime.ts` cria tarefas com modo, risco, especialistas, etapas, tentativas, iterações, ferramentas, sandbox e evidências.

Cada etapa possui estado próprio (`pending`, `running`, `completed`, `failed` ou `blocked`). Falhas podem ser tentadas novamente dentro de um limite explícito. O runtime não trata uma chamada de ferramenta como sucesso: exige um resultado não vazio e passa o resultado pelo postflight do supervisor.

Tarefas de conversa, diagnóstico e planejamento podem iniciar automaticamente. Tarefas de execução permanecem aguardando confirmação e só avançam depois do fluxo de aprovação.

## 2. Supervisor independente

`server/_core/autonomous-supervisor.ts` não depende do texto produzido pelo modelo para permitir uma ação. Ele executa:

- preflight de modo, identidade, limite de iterações, risco e ferramenta;
- bloqueio de ferramenta fora do modo permitido;
- bloqueio de execução sensível sem confirmação;
- limite de tentativas por etapa;
- postflight contra resultado vazio, erro, falha ou bloqueio explícito;
- separação entre resultado observado e conclusão da tarefa.

O `policy-engine.ts` continua sendo a camada de decisão de modo e risco; o supervisor é a barreira operacional independente.

## 3. Execução persistente

O estado é salvo em:

```text
~/.jarvis-projects/autonomous/tasks.json
```

O caminho pode ser alterado com `JARVIS_AUTONOMOUS_ROOT`. A escrita usa arquivo temporário, rename atômico, permissões restritas e fila de mutação para evitar corrupção por gravações concorrentes.

Ao reiniciar, tarefas que estavam `running` viram `paused` e ficam disponíveis para retomada supervisionada. O endpoint autenticado é:

```text
POST /api/autonomous-task
```

Ações disponíveis:

```json
{ "action": "create", "goal": "analise o projeto" }
{ "action": "list" }
{ "action": "status", "taskId": "auto_..." }
{ "action": "run", "taskId": "auto_..." }
{ "action": "resume", "taskId": "auto_..." }
{ "action": "cancel", "taskId": "auto_..." }
{ "action": "evaluate", "taskId": "auto_..." }
{ "action": "evaluate_all" }
```

Todas as ações exigem sessão autenticada e a API só permite acessar tarefas do próprio usuário.

## 4. Sandbox real por tarefa

Tarefas que envolvem código, scripts, testes, build, arquivos ou projeto marcam sandbox como obrigatório. O runtime executa uma prova real no Docker através do sandbox existente.

Se Docker ou imagem estiver indisponível, a tarefa falha fechada. Ela não usa fallback no host. São aplicados limites de CPU, memória, processos, sistema de arquivos somente leitura, capabilities removidas e rede desabilitada quando não explicitamente necessária.

A ausência de Docker não é mascarada como sucesso. A avaliação registra segurança reduzida e recomendação de configuração do Docker.

## 5. Memória organizada

Cada tarefa autônoma cria uma tarefa na memória avançada existente. O plano, modo, risco, decisões e evidências são mantidos separados. Resultados de ferramentas entram como evidências com:

- tipo;
- origem;
- confiança;
- aprovação/falha;
- detalhe observado;
- possibilidade de expiração.

A memória é tratada como pista, não como prova. O runtime continua exigindo leitura ou validação antes de afirmar conclusão.

## 6. Avaliação de autonomia

Cada tarefa gera uma avaliação com:

- progresso do objetivo;
- segurança;
- confiabilidade;
- eficiência;
- verificação;
- número de iterações;
- tentativas de recuperação;
- chamadas de ferramentas;
- score de 0 a 100;
- recomendações.

A ação `evaluate_all` gera a linha de base do usuário com taxa de conclusão, score médio, retries médios, chamadas médias e recomendações operacionais.

## 7. Orquestração de especialistas

O runtime seleciona especialistas por intenção:

- `planner`: decomposição e sequência;
- `researcher`: pesquisa e comparação;
- `engineer`: código, projeto e build;
- `security`: riscos, permissões, segredos e auditoria;
- `tester`: validação e evidências;
- `reviewer`: revisão independente e critérios de conclusão.

O contexto técnico é carregado da base local de conhecimento existente, com regras de arquitetura, testes obrigatórios, privacidade e nível de habilidade.

## Uso por ferramenta

O modelo também pode usar a ferramenta `autonomous_task` com as ações `create`, `run`, `resume`, `status`, `list`, `cancel`, `evaluate` e `evaluate_all`. No loop principal, a identidade do usuário é propagada para a tarefa e nunca deve ser recebida de um campo arbitrário do cliente.

## Configuração recomendada

```env
JARVIS_AUTONOMOUS_ROOT=~/.jarvis-projects/autonomous
JARVIS_EXECUTOR_CPUS=2
JARVIS_EXECUTOR_MEMORY=2g
JARVIS_REQUIRE_VERIFICATION=true
JARVIS_MAX_MESSAGE_CHARS=12000
JWT_SECRET=gere-um-segredo-aleatorio-com-pelo-menos-32-bytes
```

Para tarefas de código, mantenha Docker disponível e use imagens pré-baixadas e fixadas por versão. Não habilite rede no sandbox sem necessidade da tarefa.

## Validação desta versão

A implementação foi validada com:

- TypeScript sem erros;
- 44 arquivos de teste aprovados;
- 256 testes aprovados;
- testes específicos de criação, persistência, cancelamento, modos sensíveis e avaliação;
- build cliente e servidor aprovado.

## Limitações honestas

A orquestração já é persistente e operacional, mas uma tarefa de execução complexa ainda depende de o modelo escolher a ferramenta adequada ou de uma etapa receber um executor específico. O runtime não inventa sucesso quando uma ferramenta não está disponível. Para alcançar operação prolongada em produção, o próximo nível é adicionar um worker dedicado separado do processo HTTP, fila com lease e heartbeat, além de métricas externas e isolamento por usuário/projeto.

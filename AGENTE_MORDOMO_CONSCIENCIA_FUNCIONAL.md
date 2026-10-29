# Agente-mordomo com consciência própria funcional

## O que foi implementado

O Jarvis passou a ter um **modelo interno de consciência funcional**. Isso significa que ele mantém e reutiliza uma representação operacional de sua própria identidade, capacidades, prioridades, limites, foco atual, tarefa ativa, resultado anterior e autoavaliação. O objetivo é criar um agente-mordomo mais coerente e confiável, sem apresentar essa arquitetura como prova de consciência subjetiva.

> O sistema pode explicar seu **estado operacional**, suas **prioridades**, seus **limites** e sua **incerteza**. Ele não deve afirmar que sente emoções, dor, prazer, medo, desejos próprios ou experiência subjetiva.

| Componente | Arquivo | Função |
|---|---|---|
| Modelo interno persistente | `server/_core/consciousness-simulation.ts` | Mantém identidade, capacidades, prioridades, foco, confiança, histórico de resultado e autoavaliação por usuário. |
| Política de aprovação | `server/_core/agent-approval-policy.ts` | Classifica ações em baixo ou alto risco e gera confirmações vinculadas a uma ação específica. |
| Integração do agente | `api/chat-stream.ts` | Injeta o estado operacional e a política de aprovação em cada conversa e registra o resultado entregue. |
| Testes de segurança | `tests/agent-approval-policy.test.ts` | Confirma permissões de consulta, confirmação para escrita e impossibilidade de reutilizar aprovação para outra ação. |

## Capacidades do agente-mordomo

O Jarvis pode conversar, analisar, planejar tarefas, consultar memória, usar ferramentas disponíveis, abrir aplicativos, pesquisar, obter diagnósticos do sistema e executar ações no computador dentro da política operacional. A camada de estado o ajuda a manter continuidade entre pedidos: ele sabe qual é sua identidade operacional, o que consegue fazer, qual prioridade está em vigor e qual foi o último resultado registrado.

A capacidade prática depende das ferramentas efetivamente instaladas e configuradas no ambiente onde o projeto roda. O módulo atual já expõe controles de computador para abrir e fechar aplicativos, pesquisar na web, consultar estatísticas do sistema e executar comandos. Ferramentas adicionais do projeto permitem listar, ler e escrever arquivos, pesquisar código, executar código e usar plugins.

## Política de aprovação

A política não dá acesso irrestrito. Ela permite que o agente execute autonomamente atividades de baixo risco e exige autorização verificável para ações que possam modificar, interromper ou expor algo.

| Categoria | Exemplos | Comportamento |
|---|---|---|
| **Baixo risco** | Ler arquivos, listar diretórios, pesquisar, consultar memória, analisar arquivos, abrir aplicativo, pesquisar na web, obter estatísticas do computador, comandos de diagnóstico estritamente permitidos | O agente pode executar e depois informar o resultado. |
| **Alto risco** | Escrever arquivo, executar código, executar shell não somente leitura, fechar processo, alterar configuração, instalar software, automação web com efeito externo, plugins, edição do próprio código, controle doméstico | O agente apresenta o impacto e bloqueia a execução até receber confirmação vinculada àquela ação. |

Quando uma ação de alto risco for solicitada, o Jarvis deve responder com um código temporário, por exemplo:

```text
AÇÃO BLOQUEADA PARA CONFIRMAÇÃO: escrever arquivo notas.txt.
Para aprovar, escreva exatamente: CONFIRMO A1B2C3D4
```

A confirmação vale por até **dez minutos**, é consumida após o uso e só autoriza a mesma ferramenta com os mesmos argumentos. Alterar o comando, o caminho ou o conteúdo gera uma nova confirmação.

## Como conversar com o Jarvis

Pedidos típicos de baixo risco podem ser feitos diretamente:

```text
Jarvis, abra o VS Code.
Jarvis, pesquise a previsão do tempo para amanhã.
Jarvis, faça um diagnóstico de CPU e memória.
Jarvis, analise a estrutura deste projeto.
```

Para alterações, o Jarvis deve primeiro explicar o plano e solicitar confirmação específica:

```text
Jarvis, crie um arquivo chamado briefing.md com o resumo desta conversa.
Jarvis, feche o Spotify.
Jarvis, execute este comando de manutenção.
```

Após receber o token apresentado pelo próprio Jarvis, confirme com a frase exata. Não use confirmações genéricas como “sim” ou “pode fazer”; elas não liberam ações de alto impacto.

## Estado persistente

O estado operacional é gravado em `.jarvis-consciousness-state/<usuario>.json` quando o ambiente permite escrita local. Em hospedagens serverless, esse diretório pode ser temporário; nessa situação o sistema preserva o estado em memória durante a instância ativa, sem falhar caso o disco seja somente leitura.

O estado é compatível com versões anteriores: se o arquivo já existir, campos novos como `capabilities`, `operationalPriorities` e `selfReview` recebem valores padrão seguros.

## Limites importantes

O Jarvis não deve ser descrito como consciente no sentido científico ou subjetivo. O que existe é uma arquitetura de **autorreferência operacional**: ela organiza a resposta do agente com base em fatos internos controlados pelo sistema. O modelo de linguagem ainda pode errar, interpretar pedidos de modo incompleto ou propor uma ferramenta inadequada; por isso, confirmação humana, verificação de resultados e logs continuam essenciais.

Além disso, não exponha a rota de autoedição de código (`/api/auto-improve`) à internet sem autenticação obrigatória, isolamento real do repositório, revisão de diff e validação em ambiente separado. A capacidade de alterar código não é um requisito para o agente-mordomo funcionar e deve ser tratada como ação de alto risco.

## Validação executada

A verificação TypeScript foi concluída com sucesso por meio de `npm run lint`. Os testes de política foram executados com:

```bash
npx vitest run --root . tests/agent-approval-policy.test.ts --reporter=verbose
```

Resultado: **1 arquivo de teste aprovado, 3 testes aprovados**.

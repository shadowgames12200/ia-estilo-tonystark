# J.A.R.V.I.S. v15 — Navegador e intenção natural

Esta versão retoma a implementação interrompida da tarefa anterior e integra o fluxo de navegador com a política de autoalteração segura.

## O que foi integrado

O Jarvis agora possui um fluxo específico para detectar navegadores instalados, selecionar o navegador quando necessário, executar pesquisas no Google e verificar o domínio oficial antes de abrir um resultado solicitado. O fluxo também permite trabalhar com pedidos naturais, sem exigir que o usuário conheça nomes de arquivos, funções ou estruturas de programação.

Pedidos de melhoria suficientemente claros podem ser analisados sem uma pergunta técnica. Pedidos genéricos ou com mais de uma interpretação relevante continuam gerando uma solicitação de esclarecimento antes de qualquer alteração.

A versão preserva o fluxo de autoalteração segura: analisar o pedido, identificar os arquivos afetados, criar uma cópia de trabalho, executar testes e compilação, revisar os resultados e somente então solicitar confirmação para alterar o projeto original.

## Validação

A validação foi executada no projeto restaurado com as dependências fixadas no lockfile:

- TypeScript (`tsc --noEmit`): aprovado.
- Suíte completa do Vitest: aprovada.
- Compilação (`pnpm run build`): aprovada.
- Testes específicos de intenção natural e navegador: aprovados.

## Observação

A execução real de aplicativos e navegadores depende das permissões do Windows, dos navegadores instalados, dos logins já realizados e das ferramentas locais configuradas no computador do usuário.

Ações externas importantes, como enviar mensagens, apagar dados, publicar conteúdo ou alterar configurações sensíveis, devem continuar exigindo confirmação explícita.

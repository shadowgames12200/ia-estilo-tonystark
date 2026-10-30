# J.A.R.V.I.S. v17 — Busca híbrida e memória de decisões

A V17 amplia a localização especialista implementada na V16. O Jarvis agora constrói um índice estrutural leve do workspace e utiliza esse índice junto com busca textual, sinônimos, caminhos e extensões para localizar pontos de alteração.

## Recursos

O índice registra, sem guardar o conteúdo integral dos arquivos, responsabilidades prováveis, símbolos exportados, imports, rotas e quantidade de linhas. Essas informações ajudam a relacionar um pedido natural como “melhore o painel” com componentes visuais, estado, API e testes relacionados.

As propostas agora mostram razões de confiança, o resumo do índice utilizado e arquivos candidatos que foram analisados, mas descartados por pontuação inferior. Quando a diferença entre candidatos não é suficiente, a alteração continua bloqueada e o Jarvis pede apenas uma clarificação simples.

Foi adicionada uma memória redigida de decisões de melhoria. Ela registra arquivos envolvidos, estado da decisão e resumo da localização quando uma proposta é aprovada, concluída ou revertida. Chaves, tokens, senhas e conteúdo sensível são removidos; a memória nunca é necessária para executar rollback.

## Segurança

O índice não autoriza alterações. O fluxo permanece: investigar, propor, revisar, clonar, testar, pedir confirmação, aplicar com backup e validar novamente. Falhas de memória não interrompem a tarefa nem alteram sua segurança.

## Validação

- TypeScript (`tsc --noEmit`): aprovado.
- Testes focados: **8 testes aprovados**.
- Suíte completa: **33 arquivos e 116 testes aprovados**.
- Compilação (`pnpm run build`): aprovada.

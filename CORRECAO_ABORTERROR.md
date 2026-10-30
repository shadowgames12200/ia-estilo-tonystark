# Correção do AbortError no streaming

O callback de `close` agora diferencia o fechamento normal de uma resposta concluída de uma desconexão prematura do cliente. O endpoint também deixa de escrever um erro SSE depois de um cancelamento legítimo.

Validação executada nesta versão: typecheck aprovado, 73 testes aprovados e build de frontend/backend aprovado, com `dist/server/_core/index.js` gerado.

# Correção do cancelamento no cliente

Os logs mostraram que o LM Studio conectava corretamente, mas o navegador encerrava o SSE. A versão agora desativa o barge-in agressivo por padrão, migra configurações antigas salvas no localStorage e exige 350 ms de fala contínua antes de considerar uma interrupção. O usuário pode reativar o barge-in nas configurações depois de confirmar que o microfone não está captando o áudio de saída.

Validação: typecheck aprovado, 73 testes aprovados e build frontend/backend aprovado.

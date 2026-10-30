# J.A.R.V.I.S. v16 — Localização especialista

Esta atualização ensina o Jarvis a investigar sozinho o ponto correto de uma alteração, tanto no próprio código quanto em tarefas de projeto, sem exigir que o usuário conheça programação, dados, nomes de arquivos ou funções.

## Comportamento implementado

Ao receber um pedido em linguagem natural, o Jarvis amplia os termos com sinônimos e associa o objetivo às responsabilidades prováveis do sistema. Em seguida, cruza nomes de arquivos, diretórios, extensões, conteúdo, símbolos e evidências estruturais do workspace. A proposta registra os arquivos candidatos, a confiança, o método de localização e o motivo da escolha.

Para pedidos de autoalteração, a investigação é feita antes da geração de código. O Jarvis não escolhe um arquivo aleatório, não inventa que localizou a causa e não transfere a investigação técnica para o usuário. Se houver mais de um local plausível ou evidência insuficiente, ele pede apenas uma clarificação simples sobre o objetivo e mantém a alteração bloqueada.

A mesma regra é reforçada no agente geral: ele deve inspecionar arquitetura, documentação, dependências, rotas, componentes, schemas, testes e histórico local antes de propor uma mudança. O usuário pode informar apenas o resultado desejado.

## Segurança preservada

A localização automática não autoriza alteração automática. O fluxo continua exigindo proposta, revisão, cópia de validação, testes, compilação e confirmação explícita antes de modificar o Jarvis original. Backups e rollback permanecem disponíveis.

## Validação

- TypeScript (`tsc --noEmit`): aprovado.
- Testes focados de intenção natural e autoalteração: 6 testes aprovados.
- Suíte completa: 33 arquivos e 116 testes aprovados.
- Compilação (`pnpm run build`): aprovada.

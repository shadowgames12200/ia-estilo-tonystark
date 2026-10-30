# Atualização do executor de projetos da Jarvis

## Resultado

A Jarvis recebeu um fluxo automático para reconhecer pedidos de testes, build, compilação, auditoria e análise extensa quando o usuário fornece uma pasta, um ZIP ou um repositório GitHub. O processamento pesado é encaminhado para `project_executor`, enquanto alterações, publicação, rollback, exclusão, deploy e controles externos continuam sob a política de confirmação existente.

## Arquivos principais

| Arquivo | Alteração |
|---|---|
| `server/_core/project-executor.ts` | Novo intake de pasta/ZIP/GitHub, validação de caminhos, detecção de tarefa, execução limitada e saída sanitizada. |
| `server/_core/tools.ts` | Nova ferramenta `project_executor` integrada ao catálogo e ao loop de ferramentas. |
| `server/_core/tool-selector.ts` | Seleção automática para pedidos de projeto e engenharia. |
| `server/_core/agent-approval-policy.ts` | Executor classificado como leitura/validação de baixo risco; ações externas continuam sensíveis. |
| `server/_core/agent-loop.ts` | Regras para uso automático, mensagem genérica de processamento e declaração de limites. |
| `.env.example` | Limites configuráveis de CPU e memória, sem valores secretos. |
| `docs/EXECUTOR-ISOLADO-DE-PROJETOS.md` | Guia de uso e segurança. |
| `tests/project-executor.test.ts` | Testes de detecção automática. |

## Proteções

O ZIP rejeita caminhos absolutos, `..`, links simbólicos, excesso de arquivos e conteúdo extraído acima do limite. Repositórios aceitos pelo executor usam HTTPS no `github.com`. A execução usa rede desativada, volume somente leitura, limite de CPU, limite de memória, limite de processos e tempo máximo. Não há fallback para executar o projeto localmente quando o Docker não está disponível.

O executor não altera o projeto e não promete capacidades que não possui. Para editar arquivos ou atuar no GitHub/Vercel, a Jarvis precisa usar a manutenção de projeto e solicitar a confirmação exigida pela política de aprovação.

## Validação realizada

`npm run lint`: aprovado.

`npm test`: aprovado.

`npm run build`: aprovado.

A varredura final do pacote não deve conter `.env`, chaves privadas, tokens reais, `node_modules` ou `dist`.

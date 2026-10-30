# JARVIS — melhorias de confiabilidade, fase 1

## Objetivo

Melhorar a capacidade da JARVIS de agir e relatar resultados com evidências, sem retreinar pesos do modelo nem ampliar permissões do computador.

## Alterações nesta fase

1. **Verificação de resultado de ferramenta** (`server/_core/tool-result-verifier.ts`): separa falha, tarefa pendente e execução concluída; só emite estado “verificado” quando a ferramenta devolve evidência explícita de validação.
2. **Autocorreção rastreável** (`api/chat-stream.ts`): registra o estado real de cada ferramenta e não trata uma proposta, bloqueio ou operação ainda em fila como resultado verificado.
3. **Proteção do sandbox** (`server/_core/code-change-manager.ts`): rejeita caminhos que atravessam links simbólicos e valida o destino também durante rollback, para impedir escrita/restauração fora do workspace.
4. **Testes de regressão**: cobrem mensagens de bloqueio/erro, estados pendentes, diferença entre preparar e aplicar, aprovação explícita e tentativa de sair do sandbox por link simbólico.

O fluxo existente de autoaperfeiçoamento permanece: proposta, revisão, cópia isolada, testes, aplicação autorizada, backup e validação final. Esta fase reforça os sinais de resultado e os limites de caminho, sem permitir que a IA altere suas próprias regras de segurança.

## Validação

Execute na pasta do projeto:

```bash
pnpm test
pnpm lint
pnpm build
```

A avaliação inclui cenários determinísticos no Vitest. Isso mede regressões conhecidas; não é prova de que todo pedido futuro será entendido corretamente.

## Sobre “treino”

Estas mudanças **não fazem fine-tuning nem alteram os pesos do Qwen**. Para a JARVIS, a ordem recomendada é construir um conjunto pequeno de conversas/tarefas de referência, medir acertos e falhas, ajustar prompts e ferramentas, e só considerar fine-tuning quando houver dados próprios suficientes, revisados e sem informações sensíveis. Não treine com conversas privadas sem consentimento e sanitização.

## Limites desta entrega

- Foi modificada somente a cópia do projeto fornecida nesta sessão; não houve acesso direto ao Windows do usuário.
- A JARVIS ainda depende de o modelo local seguir chamadas estruturadas de ferramenta; as proteções do servidor limitam, mas não substituem a validação humana para alterações de alto impacto.
- O sandbox de autocorreção exige Docker para os testes isolados. Se Docker não estiver instalado, a operação deve falhar de forma explícita sem alterar o original.

# Autoalteração segura do Jarvis

Quando o usuário pede uma mudança no próprio Jarvis, ele não precisa conhecer programação ou informar nomes de arquivos. O agente interpreta linguagem natural usando o contexto, a memória do projeto e evidências do código. Se houver uma interpretação claramente dominante, ele explica o que entendeu, identifica os arquivos por evidência e segue para a proposta. Se o pedido for genérico, houver interpretações materialmente diferentes ou vários locais igualmente plausíveis, pergunta apenas o necessário antes de propor; nunca inventa uma localização.

Depois de entender o pedido, o agente cria uma proposta com objetivo, arquivos, evidências, riscos, benefícios e critérios de aceitação. A etapa `prepare` clona o projeto em um diretório temporário, gera a mudança somente na cópia, executa revisão independente e roda lint, testes e build dentro do Docker. O projeto original permanece intocado nessa fase.

Se a cópia não passar, a preparação é marcada como falha e o agente informa o erro. Ele não pode declarar que a alteração está pronta nem aplicar parcialmente. Se passar, o agente informa que a cópia foi validada e pergunta se o usuário confirma a aplicação exata da proposta.

Somente depois da confirmação, a ação `apply` cria backup, aplica os mesmos arquivos no projeto original e executa a validação final local. Se a validação final falhar, o backup é restaurado automaticamente. A entrega só é marcada como concluída quando a alteração, o backup e os testes finais forem confirmados.

O fluxo final é:

```text
pedido ambíguo → perguntas
pedido claro → proposta
proposta → clone descartável
clone → revisão + Docker + testes + build
aprovado → pergunta de confirmação
confirmação → backup + aplicação original
aplicação → validação final
falha → rollback
sucesso → entrega verificada
```

A ausência do Docker é tratada como bloqueio da preparação, nunca como sucesso simulado. A confirmação deve se referir à proposta e aos arquivos que foram efetivamente testados.

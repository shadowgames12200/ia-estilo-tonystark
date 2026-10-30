# J.A.R.V.I.S. v11 — núcleo de execução verificável

Esta versão adiciona um fluxo de artefatos, roteamento local por tarefa, planos persistentes, execução de comandos sem shell intermediário e um planejador de executáveis Windows.

## Entrega de arquivos

Quando o pedido informar apenas um nome, o arquivo é salvo em `JARVIS_ARTIFACT_ROOT`. Quando o pedido informar um caminho permitido, o Jarvis salva naquele caminho. Depois da escrita, ele relê o arquivo, confere o tamanho e calcula SHA-256. Um manifesto `.manifest.json` também é criado. O resultado do chat contém o caminho absoluto, o tamanho, o hash e o estado `verified=true`.

Exemplo:

```text
Crie o arquivo backup.bat com o conteúdo ... e salve em C:\Users\MeuNome\Desktop.
```

Para permitir caminhos absolutos fora da pasta padrão, configure `JARVIS_ARTIFACT_ALLOWED_ROOTS` com as pastas autorizadas. Evite ativar `JARVIS_ALLOW_EXPLICIT_OUTPUT_PATHS=true` globalmente.

## Executáveis Windows

O Jarvis pode planejar e, no Windows, executar builds para Python com PyInstaller e JavaScript com `pkg`, desde que o empacotador esteja instalado. O build exige confirmação. O resultado só é entregue se o comando terminar com código zero, o `.exe` for encontrado em uma pasta esperada e o arquivo for relido e verificado.

Docker/Linux não é tratado como se fosse um compilador Windows. Nesse ambiente o Jarvis informa `blocked` e orienta executar no Jarvis instalado no Windows.

## Roteamento

Conversas simples usam o modelo rápido. Pedidos com arquivos, escrita, execução, compilação, login, navegação, correção ou entrega usam o modelo agente. O evento `model_info` informa o motivo da seleção e se a validação é obrigatória.

## Planos retomáveis

A ferramenta `workflow_control` persiste objetivo, etapas, tentativas, status e log em `JARVIS_WORKFLOW_FILE`. Se o processo reiniciar durante uma etapa, ela volta para `pending` e pode ser retomada. Uma tarefa longa deve seguir o ciclo: criar plano, iniciar etapa, executar, validar, concluir ou registrar falha, corrigir e tentar novamente dentro do limite.

## Segurança

Ações de escrita e build continuam exigindo confirmação. O controle de shell do computador não aceita comandos encadeados, redirecionamentos ou shell intermediário; são permitidos somente comandos determinísticos de diagnóstico e ferramentas de build cadastradas. O sandbox Docker continua sendo o caminho padrão para Python, JavaScript, Shell e validações de projetos.

## Testes executados

A suíte nova está em `tests/jarvis-v11-core.test.ts` e cobre criação/verificação de artefato, seleção de modelo, bloqueio de shell inseguro, planejamento de `.exe` e recuperação de uma etapa interrompida.

```bash
pnpm exec tsc --noEmit
pnpm exec vitest run --root . tests/jarvis-v11-core.test.ts
```

Estas melhorias não transformam um modelo local de 4B/8B em um sistema infalível. Elas reduzem erros de roteamento e tornam falhas observáveis, bloqueadas ou recuperáveis, sem permitir que o Jarvis afirme sucesso sem evidência.

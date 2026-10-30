# J.A.R.V.I.S. v12 — interface de execução e arquitetura híbrida

## Painel lateral durante tarefas

Enquanto uma solicitação está ativa, a coluna direita troca automaticamente os painéis de diagnóstico, segurança, histórico, observabilidade e monitoramento por um **Monitor de Execução ao Vivo**. O monitor recebe eventos reais do stream do servidor e mostra o modelo selecionado, a ferramenta, a etapa atual, progresso, fila, tempo decorrido, estimativa, logs, arquivos gerados e o resultado verificado.

O painel oferece cancelar e tentar novamente. Quando a operação termina, a coluna volta ao conjunto anterior de painéis. Se ocorrer uma falha, o monitor permanece visível para expor o erro e permitir uma nova tentativa, sem esconder o diagnóstico.

O percentual é uma estimativa de etapa, não uma promessa de tempo exato. O backend é a fonte de verdade: a interface nunca usa uma animação aleatória para dizer que uma operação terminou.

## Blocos de código

Mensagens Markdown com cercas de código, por exemplo ` ```powershell `, são renderizadas com cabeçalho de linguagem, área escura, fonte monoespaçada e botão **copiar**. O botão copia somente o conteúdo do bloco, sem o rótulo da linguagem. A apresentação não executa o comando automaticamente.

## Arquitetura recomendada

O processo principal deve rodar no Windows 11, porque é o ambiente que tem acesso natural a programas gráficos, mouse, teclado, microfone, janelas e compiladores de `.exe`. O WSL Ubuntu 24.04 deve hospedar o workspace de desenvolvimento, testes, serviços Linux e Docker Desktop por WSL2. O LM Studio e o daemon de voz também devem permanecer no Windows para reduzir atrito com GPU, áudio e permissões.

Essa divisão é intencional: o Windows é o **agente controlador autenticado**; o WSL/Docker é o **executor isolado**. O acesso entre os dois deve usar caminhos autorizados e serviços locais, nunca compartilhamento irrestrito de todo o disco.

Variáveis relacionadas ficam no `.env.exemple.example`: `JARVIS_RUNTIME_ROLE`, `JARVIS_WSL_ENABLED`, `JARVIS_WSL_DISTRO`, `JARVIS_WSL_WORKSPACE` e `JARVIS_DOCKER_ENGINE`.

## Observação sobre atividade

O painel antigo possuía uma atividade visual simulada. Ela foi removida. Quando não existe tarefa ativa, o sistema mostra **AGENTE DISPONÍVEL · SEM OPERAÇÃO ATIVA**. Durante uma tarefa, a atividade exibida é derivada dos eventos reais de início, ferramenta, etapa, verificação, erro e finalização.

# Correções de reconhecimento, visão e latência — Jarvis

## Diagnóstico confirmado

A captura mostrou três problemas independentes. A análise visual declarou que Steam e Epic Games estavam abertos sem evidência legível; o console mostrou `no-speech`, `InvalidStateError: recognition has already started` e `Maximum update depth exceeded`; e o início da resposta falada ficava perceptivelmente lento.

| Sintoma observado | Causa identificada | Correção aplicada |
|---|---|---|
| Steam e Epic Games citados sem estarem abertos | O prompt visual permitia inferências de aplicativos a partir de contexto ou ícones pouco legíveis. | Prompt visual reescrito para exigir nome claramente visível e declarar incerteza quando o ícone não for identificável. |
| Tag `<function=computer_control>` exibida na resposta | O modelo podia gerar pseudochamadas de ferramenta como texto comum. | Prompt principal passou a proibir XML, JSON e tags de função na resposta visível. |
| `recognition has already started` | A página e o hook podiam chamar `recognition.start()` durante a transição de encerramento/início. | Criadas travas de início e execução; apenas o hook reinicia a instância do navegador. |
| `no-speech` repetitivo | Evento normal do Web Speech API estava sendo registrado como erro. | `no-speech` e cancelamentos normais deixaram de poluir o console; o reinício ocorre com atraso controlado. |
| `Maximum update depth exceeded` | O efeito principal dependia de `isListening`; cada mudança de reconhecimento reexecutava o efeito e tentava iniciar o microfone novamente. | Removida essa dependência; a responsabilidade do reinício ficou centralizada no hook. |
| Voz demora para iniciar | O cliente esperava um trecho maior sem pontuação, o fallback local aguardava 700 ms e a imagem era analisada duas vezes. | O primeiro trecho de voz sem pontuação passou de 48 para 32 caracteres; o fallback local cai para a nuvem após 250 ms; a captura é analisada uma única vez e o turno textual seguinte usa modelo mais rápido. |
| Fila de voz pode travar | Não havia limite de tempo se o elemento de áudio não começasse. | Adicionado timeout de 12 s para liberar a fila quando o áudio não inicia. |
| Stream antigo altera a nova conversa | Um stream cancelado ainda podia alterar indicadores de estado. | Adicionado identificador de geração; atualizações de execução antiga são ignoradas. |

## Alterações realizadas

Os arquivos modificados foram:

| Arquivo | Alteração |
|---|---|
| `client/src/hooks/useSpeechRecognition.ts` | Reescrito o ciclo do Web Speech API, com prevenção de double-start, reinício único e limpeza consistente. |
| `client/src/pages/Home.tsx` | O efeito de microfone deixou de depender de `isListening`, eliminando a reinicialização por mudança de estado. |
| `client/src/hooks/useStreamingChatWithVoice.ts` | Proteção por geração de stream, cancelamento no unmount e início mais cedo da fila de fala. |
| `client/src/hooks/useKITTVoice.ts` | Timeout de início de áudio e callback de idioma estável. |
| `api/chat-stream.ts` | Prompt de visão factual, bloqueio de pseudochamadas de ferramenta no texto e eliminação da segunda análise multimodal. |
| `server/_core/local-openai-provider.ts` | Timeout de detecção de LM Studio reduzido de 700 ms para 250 ms. |

## Comportamento esperado após a atualização

Ao pedir uma análise de tela, o Jarvis deve mencionar apenas nomes de aplicativos que estejam claramente visíveis e legíveis; ícones ambíguos devem ser relatados como não identificáveis. A resposta não deve exibir tags de função ao usuário.

O console não deve mais apresentar a sequência de `recognition has already started` nem o loop `Maximum update depth exceeded` durante o ciclo normal de escuta. Eventos `no-speech` podem continuar a ocorrer internamente no navegador, mas não devem ser tratados como erro fatal nem gerar uma cascata de reinicializações.

A fala deve começar antes em respostas sem pontuação e o fallback para nuvem deve ocorrer mais rápido quando o LM Studio não estiver ativo. Ainda existe a latência inevitável de rede e de geração do modelo, especialmente em análise visual: uma captura precisa ser processada antes de haver conteúdo confiável para sintetizar.

## Validação concluída

| Verificação | Resultado |
|---|---|
| `npm run lint` | Aprovado, sem erros TypeScript. |
| `npm run build` | Aprovado; build de produção concluída. |
| `npx vitest run --root . tests/*.test.ts` | Aprovado: 4 arquivos e 35 testes. |

## Teste manual recomendado

Reinicie o servidor e faça um recarregamento completo da página. Teste primeiro uma pergunta curta por voz e confirme que o console não mostra `already started` ou `Maximum update depth exceeded`. Em seguida, envie uma resposta longa e observe se a fala começa após a primeira frase ou após cerca de 32 caracteres. Por fim, analise uma tela que contenha apenas ícones ambíguos: o comportamento correto é declarar a limitação, não adivinhar aplicativos.

Referência técnica: o `SpeechRecognition.start()` lança erro quando a instância já está ativa; a prevenção de double-start implementada aqui mantém uma única transição de início por vez. [1]

## Referências

[1]: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/start "MDN — SpeechRecognition.start()"

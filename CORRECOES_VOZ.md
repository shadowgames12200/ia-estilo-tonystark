# Correções do fluxo de voz — Jarvis

## Resultado

O fluxo de voz foi revisado e corrigido para eliminar a principal origem do ciclo observada no log: chamadas recursivas de reprodução que atualizavam estado repetidamente quando a fonte de áudio falhava ou era interrompida. A correção também estabiliza os callbacks e a configuração usados pelo streaming, evitando recriações desnecessárias a cada renderização.

| Arquivo | Alteração principal | Efeito esperado |
|---|---|---|
| `client/src/hooks/useKITTVoice.ts` | Substituição da recursão por uma fila única, cancelável e controlada por geração. | Apenas uma reprodução ativa; cancelamentos não reiniciam a fila antiga. |
| `client/src/hooks/useStreamingChatWithVoice.ts` | Uso de referências para callback/configuração atuais e aumento do limite de fragmentação sem pontuação. | A função de streaming fica estável e há menos chamadas curtas de TTS. |
| `client/src/pages/Home.tsx` | Memoização da configuração de voz e callbacks, além de referência para a interrupção atual. | Menos efeitos reiniciados e barge-in usando o estado mais recente. |

## Correções implementadas

### Fila de áudio sem recursão

O hook `useKITTVoice` anteriormente iniciava a próxima fala dentro dos handlers `onended`, `onerror` e do bloco de erro de `audio.play()`. Esse modelo podia encadear novas chamadas enquanto um áudio anterior ainda estava sendo pausado ou removido, produzindo os `AbortError` e atualizações repetidas observados no console.

Agora, uma única rotina assíncrona processa a fila sequencialmente. Cada execução recebe um número de geração. Ao interromper a voz, a geração é incrementada, a fila é limpa e a reprodução ativa é cancelada. Assim, qualquer rotina anterior termina sem alterar o estado da execução nova.

O cancelamento desliga primeiro os handlers do elemento de áudio e só depois executa `pause()`, remove a fonte e chama `load()`. Isso impede que o `onerror` provocado pela remoção da fonte seja tratado como uma nova falha da ElevenLabs.

### Tratamento correto de cancelamentos

`AbortError` de `HTMLMediaElement.play()` não é mais registrado como erro quando o cancelamento foi intencional. Erros genuínos de início ou carregamento continuam sendo registrados, mas uma resposta em trânsito que foi substituída por um trecho mais recente deixa de poluir o console.

### Estabilidade no streaming

O hook `useStreamingChatWithVoice` recebia callback e objeto de configuração que eram recriados pelo componente principal em renderizações normais. A função `streamChat` passou a manter callback e configuração atuais em referências, deixando sua identidade estável. Isso evita efeitos e callbacks derivados serem recriados somente porque houve uma atualização de interface.

Além disso, o limite de fragmentação sem pontuação foi elevado de 24 para 48 caracteres. O streaming continua responsivo, mas não cria uma requisição de voz para quase todo delta recebido do modelo.

### Integração da página principal

A página `Home.tsx` agora memoiza a configuração da voz e o callback que envia um segmento à fila. A interrupção por voz usa uma referência atualizada, o que evita captura de estado antigo por callbacks iniciados anteriormente. Dependências que recebiam o objeto inteiro retornado por `useKITTVoice` foram substituídas pelas funções e valores específicos necessários.

## Validação executada

| Verificação | Resultado |
|---|---|
| `npm run lint` (`tsc --noEmit`) | Aprovada, sem erros de tipo. |
| `npm run build` | Aprovada; build de produção concluída. |
| `npx vitest run --root . tests/*.test.ts` | Aprovada: 4 arquivos e 35 testes. |
| `npm test` padrão | Não encontrou testes porque a configuração do Vite usa `client` como raiz; isso é uma limitação pré-existente do comando padrão. A execução explícita pela raiz passou integralmente. |

## Limite da validação

A execução real da síntese de voz contra a ElevenLabs não foi realizada neste ambiente, pois ela exige as credenciais e o `ELEVENLABS_VOICE_ID` configurados no projeto do usuário. A compilação, a verificação de tipos e a suíte local confirmam a consistência das alterações, mas o teste final recomendado é enviar uma resposta longa por streaming, interrompê-la durante a fala e confirmar que não há repetição de `Maximum update depth exceeded` nem sucessões de `AbortError`.

## Teste manual recomendado

Inicie o projeto com as variáveis de ambiente da ElevenLabs já configuradas. Envie uma mensagem cuja resposta tenha várias frases, aguarde o início da primeira fala e interrompa com o microfone ou o botão de voz. Em seguida, envie uma nova mensagem. O comportamento esperado é uma única reprodução ativa por vez, encerramento imediato da fila anterior e continuidade normal da nova resposta sem inundar o console.

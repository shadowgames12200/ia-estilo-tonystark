# Correção da voz local e do atraso entre trechos

## Causa do intervalo de aproximadamente cinco segundos

O caminho Piper iniciava um processo novo para cada trecho que o chat enviava. Esse processo voltava a carregar o modelo de voz a cada chamada. Como a resposta também era dividida em blocos curtos, o custo de inicialização aparecia como longas pausas durante a fala.

## O que foi alterado

- A segmentação do streaming não encerra mais a fala a cada ~28 caracteres. Agora acumula frases e vírgulas em trechos de aproximadamente 96–180 caracteres, cortando por palavras apenas quando necessário.
- O endpoint Piper reutiliza um daemon WebSocket local quando ele está disponível.
- O daemon carrega o modelo Piper uma vez na inicialização e o mantém na memória. A síntese é executada sem bloquear o WebSocket.
- Foi adicionado um modo de daemon dedicado somente ao Piper, sem abrir microfone nem carregar Whisper.
- Os inicializadores locais Windows iniciam esse daemon em segundo plano quando encontram `PIPER_MODEL` no `.env` e a porta 8765 está livre.
- A síntese HTTP mantém o caminho antigo como fallback quando o daemon persistente não está disponível.
- O daemon informa se controla o microfone; o modo dedicado de TTS não desativa o reconhecimento de fala do navegador.

## Como aplicar no Windows

1. Faça uma cópia de segurança da pasta atual e extraia a versão corrigida sobre uma cópia limpa do projeto.
2. Mantenha o caminho do modelo Piper em `PIPER_MODEL` no `.env` da raiz ou nas variáveis de ambiente do Windows. O arquivo `.onnx` do modelo não vem incluído no projeto.
3. Feche a instância antiga do daemon de voz, se já houver uma usando `127.0.0.1:8765`; ela precisa ser reiniciada para carregar o código novo.
4. Inicie a JARVIS por `START_JARVIS_LOCAL.bat` ou `start-jarvis-app.bat`. Na primeira execução, o iniciador prepara um ambiente Python leve e instala `piper-tts`; isso requer internet uma vez. O modelo é então carregado na memória pelo processo Piper.
5. Se usar outro iniciador, abra `voice-daemon/start-piper-daemon.bat` uma vez, além do servidor normal. Não abra `START_JARVIS_ADMIN.bat`: a voz não precisa de privilégios de administrador.

A API `http://localhost:3000/api/local-voice` ainda mostra o status do Piper. O daemon TTS dedicado escuta em `127.0.0.1:8765` e não ativa o microfone.

## Limites

A correção elimina o recarregamento do modelo entre os blocos e reduz as interrupções artificiais da segmentação. A naturalidade final ainda depende da voz Piper instalada e da velocidade configurada; não transforma uma voz local em atuação cinematográfica, mas deve remover a causa técnica dos intervalos de vários segundos entre os trechos.

## Validação executada neste pacote

A validação automatizada do código está registrada no resumo de entrega. O comportamento de áudio em tempo real também depende do `.env`, do modelo Piper presente no PC e do daemon atualizado estar ativo; esses itens não existem neste ambiente de teste.

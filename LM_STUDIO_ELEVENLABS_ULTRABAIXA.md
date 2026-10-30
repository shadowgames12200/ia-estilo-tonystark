# J.A.R.V.I.S. local: LM Studio e voz exclusiva ElevenLabs

## O que foi configurado

O Jarvis agora possui um provedor local **LM Studio** compatível com OpenAI e selecionado por padrão no modo híbrido. Conversas rápidas, respostas de voz e pedidos sem ferramentas usam o modelo carregado no seu PC. Pedidos que exigem abrir programas, pesquisar, modificar arquivos, analisar uma imagem ou executar ações continuam usando os provedores especializados e as confirmações de segurança já existentes.

A fala foi configurada para usar **somente ElevenLabs**. Não há síntese nativa do navegador como fallback. Toda resposta de voz passa por `/api/tts-stream`, que usa `ELEVENLABS_API_KEY` no servidor e o `ELEVENLABS_VOICE_ID` definido no seu `.env`. O endpoint usa o modelo `eleven_flash_v2_5` e streaming de áudio para reduzir o tempo até a fala.

| Componente | Perfil final | Motivo |
|---|---|---|
| Conversa curta | LM Studio local | Evita a ida à nuvem e reduz a latência do primeiro token |
| Modelo sugerido | Qwen3 4B Instruct GGUF Q4_K_M | Melhor ponto de partida para velocidade na RX 7600 8 GB |
| Tarefas complexas ou ações | Groq, OpenAI, Anthropic ou Gemini já configurados | Maior confiabilidade para ferramentas, visão e raciocínio |
| Voz | ElevenLabs, uma única voz por `ELEVENLABS_VOICE_ID` | Consistência de personagem e qualidade de áudio |
| Pesquisa | Tavily | Informação atual quando solicitada |

## Configure o LM Studio

No LM Studio, baixe e carregue primeiro um modelo **Qwen3 4B Instruct GGUF em Q4_K_M**. Quando estiver aberto, inicie o servidor local em **Developer > Start Server**. Mantenha a URL padrão `http://127.0.0.1:1234/v1`.

Para a RX 7600 de 8 GB e 16 GB de RAM, use o máximo de camadas possível na GPU, mantenha contexto inicial em 4 mil a 6 mil tokens e limite a uma requisição simultânea. Esse perfil reduz competição por VRAM e favorece conversas por voz.

No Jarvis, abra **Protocolos Stark** e mantenha:

| Ajuste | Valor |
|---|---|
| Modo híbrido Stark | Ativado |
| Runtime local prioritário | LM Studio |
| Endereço do servidor local | `http://127.0.0.1:1234/v1` |
| Modelo local | Vazio para detectar o modelo carregado, ou o identificador exato mostrado pelo LM Studio |
| Otimização de latência | Nível 4 — Ultra Rápido |
| Interrupção (Barge-in) | Ativada |

## Configure a voz exclusiva

No `.env` local, deixe sua chave e o identificador de voz definidos:

```env
ELEVENLABS_API_KEY=sua_chave_privada
ELEVENLABS_VOICE_ID=seu_identificador_de_voz
```

Não coloque esses valores no código do cliente nem os publique. O navegador só requisita o áudio local ao endpoint do Jarvis; a chave permanece no servidor. Se a ElevenLabs estiver indisponível, o Jarvis não trocará para outra voz: ele registra a falha e aguarda o próximo trecho, preservando a regra de uma voz única.

## Como validar

Inicie primeiro o LM Studio com o modelo carregado e o servidor ativo. Depois execute `START_JARVIS_LOCAL.bat` e abra `http://localhost:3000`. Fale uma frase curta, como “Jarvis, como estão os sistemas?”. O painel deve identificar o modelo local em uso e a resposta deve sair somente pela voz ElevenLabs.

Para verificar o fallback, pare o servidor do LM Studio e faça uma pergunta simples. O Jarvis deverá recorrer ao provedor em nuvem configurado, sem expor qualquer chave. Para ações no computador, o uso de um provedor especializado continua esperado, pois a ferramenta pode demandar planejamento e confirmação.

## Validação do código

A atualização foi verificada com `npm run lint` e oito testes automatizados aprovados. Os testes cobrem a política de confirmação, a organização de arquivos e o adaptador local OpenAI-compatible para LM Studio.

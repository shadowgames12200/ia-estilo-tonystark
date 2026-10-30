# Relatório de auditoria completa — Projeto Jarvis

**Data da auditoria:** 12 de agosto de 2026  
**Escopo:** compilação, testes, dependências, configuração de rotas, autenticação, autorização, upload, integrações de rede e fluxo de voz/streaming.  
**Método:** revisão estática do código, execução local de validações e auditoria de dependências. Não foram realizadas chamadas reais a provedores externos com credenciais do usuário, nem ações destrutivas ou publicação.

## Sumário executivo

O projeto **compila** e a suíte localizada na raiz passa integralmente, mas **não está pronto para ser exposto publicamente**. Foram encontrados problemas críticos de autenticação, autorização e execução de comandos que podem permitir acesso administrativo indevido, uso não autorizado de recursos e potencial execução de ações no host onde o servidor roda.

> A prioridade imediata é **restringir o acesso externo** e corrigir autenticação/autorização antes de qualquer deploy público. As correções do fluxo de voz continuam válidas e a build passa, porém elas não compensam os riscos da camada de servidor.

| Resultado de validação | Situação | Observação |
|---|---|---|
| Tipos (`tsc --noEmit`) | **Aprovado** | Nenhum erro de TypeScript. |
| Build de produção (`vite build`) | **Aprovada** | 1.686 módulos transformados. |
| Testes na raiz (`vitest run --root . tests/*.test.ts`) | **Aprovados** | 4 arquivos e 35 testes aprovados. |
| `npm test` | **Falha de configuração** | O Vitest usa `client` como raiz e não localiza os testes em `tests/`. |
| `npm run check:improvements` | **Falha de configuração** | Repete o mesmo problema de raiz do Vitest. |
| Auditoria de produção (`npm audit --omit=dev`) | **Reprovada** | 10 vulnerabilidades: 1 crítica, 6 altas e 3 moderadas. |

## Achados prioritários

| ID | Severidade | Área | Evidência | Consequência |
|---|---|---|---|---|
| C-01 | **Crítica** | Autenticação | `server/_core/context.ts:21–23` aceita um valor fixo de cookie e atribui perfil `admin`. | Qualquer pessoa que conheça ou descubra o valor pode forjar uma sessão administrativa. |
| C-02 | **Crítica** | Autoedição / comandos | `api/auto-improve.ts:162–165` não bloqueia requisições sem autenticação e chama o motor de autoevolução em `:195–200`. | O endpoint pode aceitar solicitações não autenticadas que modificam código e acionam comandos. |
| C-03 | **Crítica** | Controle do host | `server/_core/computer-controller.ts:17–28`, `:81–95` e `:106–113` interpolam valores em `exec`. | Entrada influenciada por usuário/modelo pode alcançar um shell; o próprio Node alerta para não enviar entrada não sanitizada a `exec`. [1] |
| C-04 | **Alta** | Autorização multiusuário | `api/chat-stream.ts:410–421` aceita `userId` no corpo; ele é reutilizado em memória, aprovações e ferramentas. | Um cliente pode se apresentar como outro usuário, acessar contexto/memória indevidos ou interferir em aprovações. |
| C-05 | **Alta** | SSRF | `api/chat-stream.ts:102–107`, `:427–433` aceita URLs de Ollama/LM Studio do cliente; a validação só limita o protocolo. | O servidor pode ser induzido a fazer requisições para destinos internos ou não confiáveis. [2] |
| C-06 | **Alta** | Abuso de API e custo | `api/chat-stream.ts` e `api/tts-stream.ts` não aplicam autenticação ou limitação de taxa. | Terceiros podem consumir chaves de IA/TTS, gerar custo e esgotar quota. |
| C-07 | **Alta** | Dependências | `npm audit --omit=dev` encontrou 10 vulnerabilidades de produção. | A árvore contém 1 vulnerabilidade crítica, inclusive em `tar`, além de vulnerabilidades altas em dependências relacionadas a `@vercel/node`, `drizzle-orm`, `path-to-regexp` e `undici`. [3] |
| H-08 | **Alta** | Upload de arquivos | `api/upload.ts:18–55` não define autenticação, tamanho máximo, allowlist de tipo ou escopo privado; tenta criar bucket público. | Há risco de armazenamento público não autorizado, consumo de recursos e publicação de arquivos arbitrários se a rota estiver exposta no ambiente de deploy. |
| M-01 | **Média** | Corrida no streaming | `useStreamingChatWithVoice.ts:84–89` aborta o stream anterior, mas execuções antigas ainda chamam `setIsStreaming(false)` em `:216–231`. | Uma resposta antiga pode desligar o indicador da resposta nova; o estado visual e a interrupção podem ficar inconsistentes. |
| M-02 | **Média** | Resiliência de voz | `useKITTVoice.ts:57–107` não impõe timeout para carregamento/reprodução. | Se a fonte de áudio não finalizar e não emitir erro, a fila pode ficar bloqueada em `await playSegment(...)`. |
| M-03 | **Média** | Limites e negação de serviço | O servidor local aceita JSON de até 50 MB em `server/_core/index.ts:18`; chat e TTS não definem limites semânticos de mensagens, fila ou taxa. | Uma requisição grande ou várias requisições podem pressionar memória, CPU, conexões e quota de provedores. |
| M-04 | **Média** | Testes / CI | `npm test` e `check:improvements` não executam os testes pretendidos por causa da raiz configurada como `client`. | A integração contínua pode reportar falhas espúrias ou deixar de cobrir a suíte correta. |
| M-05 | **Média** | Exposição de erros | `api/upload.ts:50,58` e `api/chat-stream.ts:668–671` retornam detalhes técnicos ao cliente. | Mensagens de infraestrutura, dependências ou fornecedores podem ser reveladas ao atacante. |
| M-06 | **Média** | Segredo local | O arquivo `.env` está com permissão `644` no ambiente auditado. | Outros usuários locais podem ler segredos; o recomendado é `600` em máquinas compartilhadas. |
| B-01 | **Baixa** | API de streaming | O parâmetro `onBargeIn` de `useStreamingChatWithVoice` é recebido, mas não é usado. | A interface sugere um comportamento que o hook não executa diretamente. |
| B-02 | **Baixa** | Documentação | Comentários do hook de streaming ainda mencionam limiar de 15 caracteres e fallback do navegador, embora a implementação atual use outro comportamento. | A manutenção pode se basear em documentação desatualizada. |

## Evidências técnicas e análise

### C-01 — sessão administrativa forjável

O contexto tRPC considera autenticado e administrador qualquer pedido com um cookie estático específico. Não há assinatura, expiração, rotação, associação a dispositivo nem consulta a uma sessão persistida. Esse caminho deve ser removido por completo em produção. A identidade precisa ser derivada exclusivamente de um token verificável, de cookie assinado de sessão ou do mecanismo OAuth configurado.

### C-02 e C-03 — autoevolução e execução de comandos expostas

O endpoint `/api/auto-improve` declara receber um token, mas o bloco de autenticação não retorna erro quando não há token válido. Em seguida, a requisição delega o texto fornecido ao motor de autoevolução. Esse fluxo está próximo de código que usa `child_process` para executar comandos.

O módulo de controle de computador constrói comandos de shell por interpolação de `target` e aceita um comando completo em `executeShell`. Mesmo quando a política de aprovação tenta bloquear ações de alto risco, a segurança não pode depender de texto produzido por modelo, de identificador de usuário enviado pelo cliente ou de uma confirmação sem sessão autenticada. A documentação do Node é explícita: `exec()` cria um shell e entrada não sanitizada pode disparar execução arbitrária. [1]

**Ação imediata:** desabilitar `/api/auto-improve`, `computer_control` e ferramentas de escrita/execução em qualquer ambiente exposto à internet até que exista autenticação forte, autorização por usuário, trilha de auditoria e uma allowlist de ações.

### C-04 — identidade confiada ao cliente

O chat lê `userId` diretamente do corpo e usa o valor para memória semântica e política de aprovação. Isso rompe a separação entre usuários. A confirmação de ação também é indexada por esse identificador, portanto ela não está vinculada a uma sessão autenticada.

**Correção:** remover `userId` do contrato público de `/api/chat-stream`; obter o usuário do middleware de sessão no servidor; negar requisições sem sessão; confirmar propriedade de cada conversa, arquivo e memória antes de operar.

### C-05 — SSRF por URLs de runtime local

O cliente envia `localOllamaUrl` e `localOpenAIUrl`; o servidor aceita URLs HTTP/HTTPS e posteriormente faz `fetch` nesses destinos. Validar apenas o esquema não impede destinos de loopback, rede privada, metadata service ou endpoints internos.

A recomendação da OWASP é preferir allowlist de destinos confiáveis, restringir acesso de rede e evitar aceitar URLs completas de usuários quando isso não for indispensável. [2]

**Correção:** não permitir URL de runtime por solicitação em produção. Configure provedores locais apenas por variável de ambiente/arquivo administrativo. Se a personalização for requisito indispensável, use allowlist estrita de hosts e portas, resolução de DNS, bloqueio de ranges privados/loopback/link-local e política de egress na rede.

### C-06 e H-08 — rotas sem controle de uso

Chat e TTS consomem recursos pagos, mas não há autenticação, limite de IP/usuário, cota, limite de comprimento de texto ou proteção anti-automação no código auditado. A rota de upload também aceita arquivo sem uma política explícita de tamanho ou tipo e tenta criar bucket público.

**Correção:** aplicar autenticação antes de qualquer chamada a provedor, rate limiting em gateway e aplicação, quotas por conta, teto de tamanho/tokens, limite de concorrência e logs de consumo. No upload, use bucket privado, nomes aleatórios, allowlist de MIME/extensão, verificação de tamanho, varredura de conteúdo quando aplicável e URL assinada de leitura limitada.

### C-07 — dependências vulneráveis

A auditoria de dependências de produção encontrou **10 vulnerabilidades**: **1 crítica**, **6 altas** e **3 moderadas**. A lista afetada inclui `@mapbox/node-pre-gyp`, `@vercel/nft`, `@vercel/node`, `@vercel/static-config`, `ajv`, `drizzle-orm`, `esbuild`, `path-to-regexp`, `tar` e `undici`.

A ferramenta `npm audit` cruza a árvore bloqueada no lockfile com avisos conhecidos e devolve código não zero quando há vulnerabilidades acima do nível configurado. [3] Isso não prova exploração no projeto, mas exige atualização orientada por compatibilidade e regressão.

**Correção:** executar primeiro `npm audit fix --dry-run --json`, revisar mudanças propostas, atualizar dependências diretas com testes e repetir `npm audit --omit=dev`. Não utilizar `--force` sem revisão de mudanças de versão maior.

### M-01 a B-02 — fluxo de voz e streaming

A correção anterior eliminou a recursão que causava a cascata de `AbortError`; a build e os testes passaram. Ainda há três pontos funcionais:

1. Quando um novo stream aborta o anterior, a execução antiga ainda pode alterar `isStreaming` ou `isThinking` no bloco de captura. A solução é usar um `requestId`/geração também no hook de streaming e ignorar toda atualização que não pertença à execução atual.
2. A fila de voz não possui timeout de carregamento. Use `AbortController`/timer no endpoint de TTS e um watchdog no cliente para limpar o segmento que não inicia ou não finaliza após tempo definido.
3. A fila não possui limite máximo, e o trecho sem pontuação é extraído um segmento por evento. Em respostas muito longas, podem acumular-se segmentos e aumentar a latência percebida. Defina teto de itens/caracteres e política de descarte ou compactação.

## Plano de correção recomendado

| Ordem | Ação | Prioridade de implantação |
|---:|---|---|
| 1 | Retirar do acesso público as rotas de autoevolução, execução de comando e controle do host. | Imediata |
| 2 | Remover o bypass de cookie administrativo; implementar autenticação de sessão/JWT assinada, expiração e rotação. | Imediata |
| 3 | Derivar usuário no servidor e remover `userId` controlado pelo cliente. | Imediata |
| 4 | Desabilitar URLs de Ollama/LM Studio por requisição e criar allowlist/egress controlado. | Imediata |
| 5 | Exigir autenticação, rate limit, quota e limites de tamanho para chat, TTS e upload. | Imediata |
| 6 | Atualizar as dependências vulneráveis com revisão de compatibilidade. | Alta |
| 7 | Corrigir scripts Vitest para usar a raiz correta e adicionar testes de integração para voz/streaming. | Alta |
| 8 | Implementar geração de stream, timeout de TTS, limpeza em unmount e limite de fila. | Média |
| 9 | Sanitizar respostas de erro e restringir permissões locais de `.env`. | Média |

## Cobertura e limitações

A auditoria confirmou a consistência de tipos, build e testes existentes. Porém, os testes atuais são em grande parte estruturais e não exercitam autenticação, SSRF, upload, autoevolução, múltiplos usuários, chamadas reais à ElevenLabs ou concorrência de streaming. Por isso, o projeto só deve ser considerado apto para ambiente público depois da correção dos itens críticos e da inclusão de testes de segurança e integração.

## Referências

[1]: https://nodejs.org/api/child_process.html "Node.js — child_process"
[2]: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html "OWASP — Server-Side Request Forgery Prevention Cheat Sheet"
[3]: https://docs.npmjs.com/cli/v9/commands/npm-audit "npm — audit"

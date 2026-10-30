# Atualização profissional do J.A.R.V.I.S.

## Objetivo

O Jarvis foi ampliado para atuar no chat principal como assistente geral e como apoio técnico especializado em engenharia de software/programação e engenharia de dados. O painel lateral `AUTO-MELHORIA DO JARVIS` continua exclusivo para propostas e alterações no próprio código do Jarvis.

## Perfis técnicos automáticos

O chat identifica sinais de programação, arquitetura, APIs, debugging, testes, SQL, ETL/ELT, pipelines, Airflow, dbt, Spark, schemas, warehouses e qualidade de dados. Para esses pedidos, injeta um perfil técnico que exige distinção entre fatos, hipóteses e recomendações, análise de riscos, trade-offs, testes, observabilidade e rollback.

Para software, o checklist cobre requisitos, arquitetura, contratos de API, erros, segurança, concorrência, desempenho, acessibilidade, testes unitários/integrados/e2e, observabilidade, CI/CD e compatibilidade. Para dados, cobre fonte, ingestão, validação, transformação, armazenamento, consumo, schema, tipos, nulos, duplicidade, chaves, integridade referencial, volume, freshness, precisão, distribuição, idempotência, backfill, particionamento, lineage, PII, custo e dependências downstream.

## Manutenção de projetos e evidências

O chat principal analisa automaticamente links GitHub, URLs públicas e ZIPs anexados. Repositórios autorizados podem ser inspecionados, lidos, revisados e, após confirmação, alterados com backup, validados, publicados em branch e Pull Request draft. Projetos locais ficam limitados às raízes autorizadas; ZIPs são extraídos em workspace isolado com limites de tamanho, entradas, traversal e links simbólicos.

As ações `review_code` e `evidence_report` fazem revisão estática determinística de segurança, execução dinâmica, segredos, logging, TODOs, dependências e scripts de qualidade. O relatório separa `facts`, `hypotheses`, `recommendations`, `tests`, `risks`, `rollback` e `evidenceQuality`. A avaliação de engenharia usa fixtures locais reais para verificar nulos em CSV, mutação SQL sem `WHERE`, detecção de stack de pipeline e bloqueio de publicação sem scripts verificáveis.

O Jarvis não deve afirmar que corrigiu, publicou ou que um deployment está pronto sem evidência retornada pela ferramenta. Toda alteração precisa de confirmação; validação e publicação continuam etapas separadas, e publicação sem resultado de validação é bloqueada.

## Consciência operacional e memória autobiográfica

A camada de consciência operacional simulada mantém identidade funcional, prioridades, limites, tarefa ativa, confiança, narrativa de trabalho, contagem de interações e resultado anterior. A ferramenta `operational_state` torna esse estado auditável. Ela não representa consciência humana, sentimentos, experiência subjetiva ou desejos próprios.

A camada autobiográfica registra episódios, fatos declarados, preferências, objetivos, decisões, habilidades, relações e marcos, com fonte, confiança, saliência, tags e referência de projeto. Ela é persistente, isolada por usuário, recuperada por relevância/recência e alimenta o contexto dos chats SSE e do loop autônomo. O estudo verificável também grava objetivos, conceitos, exercícios aprovados e marcos verificados. A ferramenta `autobiographical_memory` permite lembrar, pesquisar, consultar perfil e apagar, com confirmação obrigatória para limpeza total.

A memória contínua automática usa o Supabase quando configurado e mantém um fallback local persistente em `JARVIS_CONTINUOUS_MEMORY_DIR`. Os registros são separados por usuário, deduplicados, limitados e redigidos contra padrões de tokens, chaves e senhas antes de serem armazenados. O chat extrai fatos duráveis em segundo plano, mas a memória é contexto recuperável e não prova infalível; fatos críticos ainda devem ser confirmados.

A memória por projeto permanece separada da memória geral. Ela registra diagnóstico, propostas, alterações, validações, rollback e publicações por repositório ou raiz, e é injetada no contexto automático de inspeções GitHub e ZIPs importados.

## Modo de estudo verificável

A ferramenta `study_mode` mantém um caderno persistente por usuário com cursos, objetivos, fontes, aulas analisadas, conceitos, exercícios, resultados e avaliações. Um curso só recebe o estado `verified` quando há aulas registradas, exercícios aprovados e uma avaliação registrada. Caso contrário, o relatório mostra `not_started` ou `in_progress`, com confiança numérica, lacunas e próximos passos.

Esse mecanismo não simula memória humana nem consciência. Ele cria evidências operacionais que o Jarvis pode recuperar depois. O Jarvis não deve fazer prova, enviar atividade avaliativa ou emitir certificado em nome do usuário sem confirmação explícita.

## Voz, aplicativos e controle local do PC

O Jarvis já usa reconhecimento de fala contínuo no cliente, resposta do modelo em streaming e síntese de voz por trechos pela ElevenLabs. O reconhecimento mantém frases intermediárias e finais, reinicia a sessão do navegador quando necessário, sincroniza o idioma detectado e usa o VAD para interromper a reprodução quando o usuário começa a falar. Essa experiência é de baixa latência, mas não é instantânea como nos filmes e depende do navegador, microfone, modelo, rede e provedor de voz.

A ferramenta `computer_control` agora está exposta uma única vez no catálogo SSE e no catálogo central. `find_app` procura no PATH, menu Iniciar e caminhos comuns do Windows; `open_app` abre aplicativo, arquivo ou URL somente após localizar o alvo; `search_web` abre pesquisa; `get_stats` consulta o sistema. Encerrar processos e executar shell continuam sendo ações de alto risco. Nomes com metacaracteres de shell são rejeitados e o lançador usa argumentos separados em vez de concatenar entradas em um comando.

O controle é local. Ele não oferece acesso remoto invisível ao PC, não controla automaticamente o celular e não contorna permissões do Windows. Login, CAPTCHA, 2FA, senhas e valores privados continuam no handoff manual do navegador.

## Handoff manual de navegador

A ferramenta `browser_handoff` abre uma janela visível do Chromium no computador local, navega até a página solicitada e pausa em `awaiting_user`. O usuário digita senha, 2FA, CAPTCHA e outros dados privados diretamente na janela; depois escreve `pronto` no chat. Só então o Jarvis pode retomar a sessão em `ready`. A ferramenta não lê valores de campos de senha, não recebe senha como argumento e remove o perfil temporário ao fechar.

Navegação e leitura são separadas de cliques com efeito externo. Cliques que enviem formulários, publiquem, comprem, alterem conta ou causem efeitos irreversíveis continuam sujeitos à confirmação. O perfil persistente só é habilitado explicitamente com `JARVIS_BROWSER_PERSIST_PROFILE=true`.

O handoff é local e não equivale automaticamente ao navegador do Manus ou ao navegador já aberto no celular. Em hospedagem somente Vercel, o servidor não consegue abrir uma janela visível na máquina do usuário. Controle remoto pelo celular exige uma extensão ou relay autenticado, pareamento explícito e auditoria; não se deve expor o Chrome DevTools publicamente.

## Configuração

Copie `.env.example` para `.env` e configure apenas os provedores necessários. Use `JARVIS_ALLOWED_PROJECTS` para limitar pastas locais, `JARVIS_WORKSPACE_DIR` para workspaces de GitHub/ZIP, `GITHUB_TOKEN` com escopo mínimo e `VERCEL_TOKEN`/`VERCEL_PROJECT_ID` apenas para consulta de deployments. Configure `JARVIS_CONTINUOUS_MEMORY_DIR`, `JARVIS_AUTOBIOGRAPHICAL_MEMORY_DIR`, `JARVIS_CONSCIOUSNESS_DIR`, `JARVIS_STUDY_DIR`, `JARVIS_BROWSER_PROFILE_DIR`, `JARVIS_BROWSER_PERSIST_PROFILE` e `JARVIS_BROWSER_HEADLESS` conforme a documentação. Nunca embale `.env`, cookies, tokens ou chaves.

## Apresentação da conversa

O painel textual foi redesenhado para se comportar como uma conversa real, e não como uma lista técnica de histórico. O título passou de `HISTÓRICO` para `CONVERSA`, as mensagens do usuário e do Jarvis agora ficam em bolhas alinhadas em lados opostos, respostas do Jarvis aceitam Markdown e as ações de apagar ficam discretas até a interação. O estado vazio mostra apenas uma orientação natural para começar.

As frases usadas na captura anterior eram fixtures inseridas somente no `localStorage` do navegador de validação; não estavam no código nem no pacote. O armazenamento de teste foi limpo antes da nova captura. Em uma instalação nova, a página começa com `COMO POSSO AJUDAR?` e só passa a mostrar mensagens reais depois que o usuário conversar.

## Boot de inicialização

A sequência visual de boot foi otimizada sem remover a identidade visual. A digitação passou para 2 ms por caractere, o intervalo entre linhas para 18 ms, a espera final para 120 ms e o fade foi reduzido para 250 ms. Os timers agora também são limpos corretamente quando o componente é desmontado. A Home permanece responsiva e o overlay deixa de bloquear a interface assim que a sequência termina.

O tempo percebido esperado caiu de aproximadamente quatro segundos para cerca de um a dois segundos, dependendo do navegador e do dispositivo. O boot continua sendo uma animação visual; ele não deve ser confundido com uma espera por todos os provedores externos. Voz, memória, LM Studio e APIs continuam inicializando conforme forem usados.

## Chat principal e histórico

A rota `/chat` foi adicionada como entrada dedicada da conversa. Ela mantém o histórico e o compositor no mesmo fluxo, com texto, voz, anexos e streaming. O histórico agora controla a própria rolagem interna e posiciona o fim da conversa na última mensagem, sem deslocar a página inteira. O botão `CHAT` da Home abre `/chat`; o botão `PAINEL` retorna para `/`. O painel lateral de auto-melhoria continua presente somente no painel da Home e não foi misturado ao chat principal.

A Home mantém um botão de acesso ao chat, enquanto `/chat` deixa o compositor sempre visível. A conversa continua persistindo em `localStorage` com a chave `jarvis-history`, e a hidratação converte timestamps salvos de volta para datas antes de renderizar.

## Validação desta versão

- `pnpm lint`: aprovado com `tsc --noEmit`.
- `pnpm test`: **67 testes aprovados em 16 arquivos**.
- `pnpm build`: aprovado com Vite.
- Rota `/chat`: carregada visualmente em servidor local; histórico, contador, compositor, anexos, microfone e envio ficaram visíveis.
- Navegação visual: `/chat` → `/` pelo botão `PAINEL` aprovada; `/` → `/chat` pelo botão `CHAT` do cabeçalho aprovada com acionamento real no navegador.
- Rolagem do histórico: fixture local com quatro mensagens carregado e última resposta exibida no painel dedicado.
- O sandbox não fornece microfone/dispositivo VAD; a mensagem de permissão negada é esperada nesse ambiente e deve ser resolvida permitindo o microfone no Chrome/Edge do usuário.
- Boot otimizado: timers reduzidos, fade curto e limpeza de timers aprovada por lint, testes e build.
- Apresentação textual: estado vazio limpo, mensagens em bolhas, Markdown para respostas e teste visual sem fixtures fictícias.
- Instalação limpa do ZIP com `pnpm install --frozen-lockfile`: aprovada.
- Inicialização pós-build com `NODE_ENV=production pnpm start`: aprovada; página local respondeu HTTP 200.
- Verificação de configuração mínima: `/api/upload` respondeu 400 para requisição sem arquivo, `/api/tts-stream` respondeu 500 informando corretamente a ausência de `ELEVENLABS_API_KEY`, e `/api/chat-stream` respondeu SSE com mensagem explícita de nenhum provedor configurado; esses três resultados são comportamentos esperados sem configuração completa, não falhas silenciosas.
- O Chromium do Playwright é uma instalação separada; executar `pnpm exec playwright install chromium` uma vez antes de usar o handoff do navegador.
- Testes de memória por projeto: persistência, isolamento e redaction aprovados.
- Testes de memória contínua: persistência, deduplicação, busca relevante, isolamento e redaction aprovados.
- Testes de memória autobiográfica: episódios, perfil por categoria, isolamento, redaction e registro de estado aprovados.
- Testes do modo de estudo: estado não verificado sem evidências e estado verificado após aula, exercícios e avaliação aprovados.
- Testes do handoff: protocolos inválidos e sessão inexistente bloqueados sem abrir navegador.
- Testes do lançador e catálogo: URL, arquivo local, rejeição de injeção, seleção por linguagem natural e definição única de `computer_control` aprovados.
- Avaliação de engenharia: CSV, SQL, pipeline, revisão estática e bloqueio de publicação sem scripts verificáveis aprovados.
- Testes do mantenedor: projeto local, backup, rollback, validação e importação ZIP aprovados.

## Documentação adicional

- `docs/PROJECT-MAINTENANCE.md`: manutenção segura de projetos pelo chat principal.
- `docs/ENGINEERING-STANDARDS.md`: padrões de software, dados, CI e observabilidade.
- `docs/STUDY-MEMORY-AND-BROWSER.md`: memória contínua, memória autobiográfica, estudo verificável e handoff de navegador.
- `docs/VOICE-AND-PC-CONTROL.md`: voz em streaming, barge-in, abertura de aplicativos e política de controle local.

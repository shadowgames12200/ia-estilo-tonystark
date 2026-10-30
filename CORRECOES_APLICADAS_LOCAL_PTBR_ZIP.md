# Correções aplicadas no pacote Jarvis

## Uploads e projetos

- Anexos enviados pelo usuário não são mais renderizados como links de download no histórico.
- O ZIP recebido continua sendo importado para workspace isolado.
- O fluxo de manutenção permanece separado em inspeção, proposta, aplicação, validação e rollback.
- Foi adicionada a ação `project_maintenance` / `export_archive`, que executa validação antes de gerar um novo ZIP.
- O ZIP de saída exclui `.env`, `.env.*`, `.git`, `node_modules`, `dist`, `.next`, backups internos e ZIPs existentes.
- A resposta da ferramenta informa explicitamente que o ZIP original não foi devolvido como saída.

## Modelo local

- `LOCAL_ONLY_MODE` fica ativo por padrão, salvo se definido explicitamente como `false`.
- O provedor local padrão do modo exclusivo é o LM Studio.
- Pedidos com ferramentas também são enviados ao LM Studio com as ferramentas disponíveis.
- Quando o LM Studio falha, a Jarvis exibe erro claro e não faz fallback silencioso para Groq, OpenAI ou outro provedor.

## Voz e idioma

- O indicador de escuta permanece ativo durante o reinício normal do reconhecimento de fala.
- O idioma da interface de reconhecimento é fixado em `pt-BR`.
- A detecção automática não muda mais para inglês, espanhol ou português de Portugal.
- O prompt principal exige respostas exclusivamente em português brasileiro.

## Validação

- Lint: aprovado.
- Testes gerais: 17 arquivos e 71 testes aprovados.
- Testes específicos de servidor: 5 arquivos e 18 testes aprovados.
- Build: aprovado.

O ZIP final ainda precisa ser executado no computador do usuário com o LM Studio iniciado e um modelo carregado para validar a conexão real local.

## Correção adicional após teste com upload

- O contexto automático agora importa o ZIP e executa uma inspeção real da estrutura do projeto antes de enviar o contexto ao modelo.
- A Jarvis recebe instrução explícita para não pedir um link quando o ZIP já foi anexado.
- O arquivo anexado continua sendo tratado como entrada; o original não é apresentado como saída.
- Nova validação: 17 arquivos e 71 testes gerais aprovados; 5 arquivos e 18 testes específicos aprovados; build aprovado.

## Implementação do workflow completo

A Jarvis agora mantém estado do workflow por projeto em arquivo protegido fora da raiz do projeto. A aplicação fica bloqueada até existir uma proposta registrada; a exportação fica bloqueada até existir validação aprovada após a alteração. O resultado de `apply` inclui um diff resumido com conteúdo anterior e posterior limitado por tamanho.

O endpoint de streaming identifica o `downloadUrl` retornado por `export_archive` e o envia como anexo de saída para a interface. A página salva esse anexo somente na mensagem da Jarvis, enquanto anexos do usuário permanecem sem link de download.

O contexto automático de ZIP agora executa importação, inspeção e revisão estática inicial antes da chamada ao modelo local. O prompt do agente exige a sequência import/inspect → read/review → propose → confirmação → apply → validate → export_archive.

A validação final passou no lint, em 18 arquivos com 73 testes e no build. Uma simulação de ponta a ponta confirmou proposta, aplicação, validação e exportação segura sem incluir `.env` nem o ZIP de entrada.

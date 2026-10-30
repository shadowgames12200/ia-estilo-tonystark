# Correções aplicadas

Esta cópia contém ajustes no limite de histórico e tokens do chat, inclusão controlada da memória semântica no prompt, limite da extração automática de memórias, seleção configurável do modelo Gemini, aumento do timeout de descoberta do LM Studio, fala incremental sem cortes em vírgulas e controles seguros para apagar mensagens/conversas.

O arquivo `.env` foi preservado conforme solicitado. Nenhuma chave foi substituída. Portanto, as credenciais inválidas ou placeholders existentes continuam precisando ser atualizados localmente:

| Variável | Ação necessária |
|---|---|
| `OPENAI_API_KEY` | Substituir por uma chave válida; o log registrou HTTP 401. |
| `SUPABASE_URL` | Substituir pelo endereço real do projeto; o valor atual é de exemplo. |
| `SUPABASE_SERVICE_ROLE_KEY` ou `SUPABASE_ANON_KEY` | Usar uma chave do mesmo projeto Supabase. |
| `GEMINI_MODEL` | Opcional; definir com o nome de modelo disponível para a chave Gemini. |
| `GROQ_API_KEY` | Pode ser mantida se válida; o erro original foi excesso de tokens, não autenticação. |

Por segurança, não distribua o `.env` nem faça commit dele. Se este arquivo já foi compartilhado, revogue e gere novas credenciais.

## Execução

Na pasta do projeto:

```bash
npm ci
npm run lint
npm test
npm run dev
```

O servidor continua sendo iniciado com `npm run dev` e a porta padrão permanece 3000.

## Voz em tempo real

A voz agora separa os trechos por fim de frase (`.`, `!` e `?`) em vez de interromper a fala em vírgulas e dois-pontos. Quando uma frase demora a terminar, o sistema envia um bloco por palavras para o TTS, sem aguardar a resposta completa. O próximo áudio é pré-carregado enquanto o trecho atual está sendo reproduzido, reduzindo os intervalos entre segmentos.

## Histórico

No painel `HISTÓRICO`, o botão de lixeira no cabeçalho apaga todo o histórico após confirmação. Cada mensagem possui uma lixeira própria; ao apagar uma resposta, a mensagem do usuário correspondente também é removida quando existir. As exclusões atualizam o `localStorage` usado pela aplicação.

## Validação realizada

A cópia corrigida passou em `npm run lint`, no build `npm run build` e em 42 testes unitários executados a partir da raiz com `npx vitest run --root . tests`.

O comando `npm test` sem parâmetros continua apontando o root do frontend (`client`) e não encontra os testes da pasta raiz; isso é uma configuração existente do projeto, não uma falha introduzida pelas correções. Para validar os testes raiz, use o comando indicado acima.


## Auto melhoria controlada

A auto melhoria agora segue o fluxo obrigatório: **proposta → revisão do usuário → aprovação explícita → backup → alteração atômica → validação → conclusão ou rollback**.

O J.A.R.V.I.S. não deve alterar `.env`, `.git`, `node_modules`, `dist` ou arquivos fora da raiz do projeto. A ferramenta `write_local_file` usa o mesmo gerenciador de snapshots, e o endpoint `/api/auto-improve` oferece as ações `propose`, `approve`, `reject`, `execute`, `list` e `rollback`.

Quando o usuário relata um botão ou recurso quebrado, o agente deve primeiro criar uma proposta com arquivos afetados, riscos e benefícios. Nenhuma alteração é feita durante o diagnóstico. A execução só ocorre depois da aprovação; se as validações falharem, o backup é restaurado automaticamente.

A verificação de sintaxe dos arquivos alterados foi concluída com sucesso usando o transpile local. A checagem completa do projeto depende da reinstalação das dependências, que não foi concluída nesta máquina por falhas temporárias de acesso ao registro npm.

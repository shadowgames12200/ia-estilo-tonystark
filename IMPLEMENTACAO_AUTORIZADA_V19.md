# J.A.R.V.I.S. — implementação autorizada V19

## Implementado nesta rodada

### Modos automáticos

A IA agora classifica automaticamente cada pedido em:

- `conversation`: conversa, sem execução sensível;
- `diagnosis`: investigação e leitura, sem alteração;
- `plan`: planejamento e proposta, sem aplicação;
- `execute`: execução, sujeita à confirmação e verificação.

A classificação considera intenção, restrições como “sem alterar nada”, anexos, pedidos de plano, pedidos de diagnóstico e ações diretas.

### Política central

Foi criado `server/_core/policy-engine.ts`, responsável por:

- decidir modo;
- classificar risco;
- verificar autenticação;
- definir ferramentas permitidas;
- gerar fingerprint da ação;
- bloquear ferramenta sensível fora do modo adequado.

A política roda no servidor e não depende apenas do prompt do modelo.

### Autenticação e identidade

- Removido o cookie administrativo fixo.
- Implementada sessão HMAC verificável com expiração.
- Chat streaming, chat legado, TTS, upload e autoaperfeiçoamento exigem sessão.
- Removido o fallback silencioso para o usuário `1`.
- A identidade do chat legado não pode mais ser enviada pelo cliente.
- Promoção administrativa por e-mail fixo foi removida; o administrador deve ser definido por `OWNER_OPEN_ID`.

### Limites e proteção

- Limite global de JSON configurável, padrão de exemplo em `2mb`.
- Limite configurável de caracteres para mensagens e TTS.
- Ferramentas sensíveis são bloqueadas pelo modo de operação.
- Fila de voz limitada a oito segmentos pendentes.
- Evidências persistentes agora podem registrar origem, confiança e expiração.

### Treino e avaliação

- A avaliação cresceu de 13 casos principais para mais 100 cenários sintéticos automatizados.
- Foram adicionados testes de conversa, diagnóstico, planejamento, execução, risco e bloqueio de ferramentas.
- Rubrica determinística continua separada da avaliação de qualidade do modelo.

### Voz e streaming

- A geração de stream já estava protegida contra atualizações antigas e foi preservada.
- A fila de voz agora descarta o segmento mais antigo quando excede o limite.
- O modo diagnóstico foi adicionado à configuração e à interface.

### Desempenho

O Vite recebeu divisão manual de dependências comuns, React, UI e diagramas para melhorar carregamento e permitir evolução futura por carregamento sob demanda.

## Validação

- **43 arquivos de teste aprovados**
- **253 testes aprovados**
- **TypeScript aprovado**
- **Build cliente e servidor aprovado**

## Observações importantes

1. O login local continua com cadastro automático porque essa era a estratégia existente. Para ambiente público, recomendo trocar por convite ou cadastro administrativo.
2. O projeto ainda deve ser executado com `HOST=127.0.0.1` por padrão.
3. Em produção, configure obrigatoriamente `JWT_SECRET` longo e aleatório.
4. A execução de código deve continuar em sandbox isolado; a allowlist de comandos não deve ser tratada como substituto de isolamento por container.
5. O fine-tuning dos pesos do Qwen não foi executado automaticamente: foi implementada a base segura de avaliação e roteamento necessária antes do treinamento.

## Comandos de validação

```bash
pnpm test
pnpm lint
pnpm build
```

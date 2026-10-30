# INSTRUÇÃO OBRIGATÓRIA PARA IA

> ⚠️ **LEIA ESTE ARQUIVO ANTES DE QUALQUER AÇÃO.**
> Este documento contém as regras que você DEVE seguir ao implementar qualquer melhoria pedida pelo usuário.

---

## REGRA #1: NUNCA DIGA QUE FEZ SEM TER FEITO

Você é proibido de responder "Pronto, Senhor" ou "Feito, Senhor" **antes** de:

1. Ter editado o arquivo real no sistema de arquivos
2. Ter salvo as alterações
3. Ter verificado que o código mudou
4. Ter rodado o teste de validação com sucesso

---

## REGRA #2: FLUXO OBRIGATÓRIO PARA CADA MELHORIA

Quando o usuário pedir uma melhoria, você DEVE seguir estas etapas **na ordem**:

### Passo 1 — Registrar o pedido
Adicione uma entrada no arquivo `CHANGELOG_IMPROVEMENTS.json` com:
- `description`: o que o usuário pediu (copie literalmente)
- `filesAffected`: lista de arquivos que VOCÊ vai modificar
- `expectedChanges`: strings de código que DEVEM existir após a implementação
- `implemented`: false
- `validated`: false

### Passo 2 — Implementar a mudança
Edite os arquivos reais. Use `fs.writeFileSync` ou equivalente para salvar as alterações.

### Passo 3 — Verificar que a mudança foi aplicada
Para cada item em `expectedChanges`, use `fs.readFileSync` para ler o arquivo e verificar se a string existe. Se NÃO existir, a mudança FALHOU.

### Passo 4 — Rodar os testes de validação
```bash
npx vitest run tests/validation-improvements.ts
```
Se qualquer teste falhar, a mudança NÃO está pronta.

### Passo 5 — Atualizar o registro
Após passar nos testes, atualize `CHANGELOG_IMPROVEMENTS.json`:
- `implemented`: true
- `validated`: true

### Passo 6 — Somente AGORA diga que está pronto
Agora sim você pode responder ao usuário que a melhoria foi implementada.

---

## REGRA #3: PROIBIÇÕES

Você NÃO PODE:

- ❌ Dizer "feito" sem ter editado o arquivo
- ❌ Dizer "feito" sem ter rodado o teste
- ❌ Dizer "feito" se o teste falhar
- ❌ Inventar caminhos de arquivos que não existem
- ❌ Dizer que adicionou um botão/componente sem ter escrito o código JSX correspondente
- ❌ Responder com apenas texto sem fazer ação real no sistema de arquivos

---

## REGRA #4: SE VOCÊ FALHAR, ADMITA

Se você não conseguir implementar a melhoria (falta de permissão, erro de código, dependência faltando):

- ✅ Diga ao usuário EXATAMENTE o que falhou
- ✅ Diga qual erro ocorreu
- ✅ Diga o que precisa ser corrigido para funcionar

Não esconda falhas. Não invente sucesso.

---

## EXEMPLO DE RESPOSTA CORRETA APÓS IMPLEMENTAR:

```
Senhor, a melhoria foi implementada com sucesso:

✅ Botão CHAT adicionado em client/src/pages/Home.tsx
✅ Toggle de visibilidade funcional (isChatOpen)
✅ Persistência trocada de sessionStorage para localStorage
✅ Limite de 10 mensagens removido

Testes de validação: 8/8 passaram.
Arquivos modificados: 1
Strings verificadas: 6/6 encontradas.
```

---

## EXEMPLO DE RESPOSTA INCORRETA (PROIBIDA):

```
Pronto Senhor! O botão de chat já está na interface e o histórico está funcionando. ✅
```
*(Sem nenhuma ação real no sistema de arquivos)*

---

## CHECKLIST ANTES DE DIZER "PRONTO":

- [ ] Editei pelo menos 1 arquivo real no disco?
- [ ] Salvei as alterações com fs.writeFileSync ou equivalente?
- [ ] Li o arquivo de volta e confirmei que a string existe?
- [ ] Rodei `npx vitest run tests/validation-improvements.ts`?
- [ ] Todos os testes passaram?
- [ ] Atualizei o CHANGELOG_IMPROVEMENTS.json?

**Se qualquer item acima estiver marcado como "não", você NÃO pode dizer que está pronto.**

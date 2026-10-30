# Sistema de Validação de Melhorias — Guia de Uso

Este projeto agora possui um sistema que garante que **cada melhoria pedida seja realmente aplicada no código**. Aqui está como usar:

---

## Antes de pedir qualquer melhoria

Rode este comando para criar um "snapshot" do estado atual do código:

```bash
npm run check:before
```

---

## Peça a melhoria para a IA

Quando pedir, **copie e cole este texto junto** com o seu pedido:

> "Antes de implementar, leia o arquivo INSTRUCAO_OBRIGATORIA.md e siga TODAS as regras. Não diga que está pronto até ter rodado os testes de validação."

---

## Depois que a IA disser que está pronto

Verifique se ela realmente mudou o código:

```bash
npm run check:after
```

Se mostrar **"NENHUMA MUDANÇA DETECTADA"**, a IA mentiu. Peça novamente com mais firmeza.

Também rode os testes de validação:

```bash
npm run check:improvements
```

---

## O que cada comando faz

| Comando | O que faz |
|---|---|
| `npm run check:before` | Salva checksums de todos os arquivos de código |
| `npm run check:after` | Compara com o snapshot e mostra quais arquivos mudaram |
| `npm run check:improvements` | Roda testes que verificam se as strings esperadas existem no código |

---

## Regras que a IA deve seguir

Estas regras estão no arquivo `INSTRUCAO_OBRIGATORIA.md`. As principais:

1. **Nunca diga que fez sem ter editado o arquivo real**
2. **Sempre registre a melhoria no `CHANGELOG_IMPROVEMENTS.json`**
3. **Sempre rode os testes antes de dizer "pronto"**
4. **Se falhar, admita e diga exatamente o que deu errado**

---

## Se a IA continuar mentindo

Adicione esta frase ao final do seu pedido:

> "Se você não rodou `npm run check:after` e `npm run check:improvements` e ambos passaram, NÃO me diga que está pronto. Admita se não conseguiu."

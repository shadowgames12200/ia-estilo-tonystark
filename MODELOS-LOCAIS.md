# Roteamento de modelos locais

O Jarvis usa a API OpenAI-compatible do LM Studio em `http://127.0.0.1:1234/v1`.

## Modelos configurados

- Modelo simples: `qwen/qwen3-4b-2507` (Qwen3 4B 2507)
- Modelo pesado/agente: `qwen/qwen3-8b`

## Regras

Conversa curta, saudações e respostas rápidas usam o Qwen3 4B 2507. Solicitações com ZIP, arquivos, projetos, código, testes, build, Docker, plugins, APIs, refatoração ou alteração de arquivos usam o `qwen/qwen3-8b`. O roteador não escolhe modelos desconhecidos, embeddings ou outros modelos auxiliares; se um dos dois modelos não estiver carregado, a requisição informa exatamente o que precisa ser carregado.

Os IDs podem ser definidos por `LOCAL_FAST_MODEL` e `LOCAL_AGENT_MODEL`, mas continuam restritos a esses dois modelos. O campo `localModel` enviado pela interface também é validado e não pode selecionar embeddings ou modelos externos.

Não carregue os dois modelos pesados simultaneamente na RX 7600 de 8 GB. Para evitar troca desnecessária, carregue o modelo agente durante uma sessão longa de análise de projeto e mantenha o Qwen3 4B como fallback.

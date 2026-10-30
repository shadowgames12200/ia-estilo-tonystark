# J.A.R.V.I.S. v13 — especialização local de programação e dados

A V13 adiciona uma base local de conhecimento para tecnologias, exemplos, arquitetura, qualidade de dados e testes. O agente usa `specialist_context` para carregar regras relevantes e adaptar a explicação ao nível do usuário: iniciante, intermediário, avançado ou profissional.

A memória de projeto usa `project_profile` e fica isolada por identificador de projeto. O perfil registra tecnologias, arquitetura, convenções, testes obrigatórios e regras de privacidade. Segredos não devem ser colocados no perfil.

A validação obrigatória é gerada por `requiredValidationPlan` e inclui, conforme o caso, verificação de tipos, testes, build, schema, nulos, duplicidades, frescor, segurança e conferência dos artefatos no disco.

A ferramenta `second_model_review` envia o código para uma revisão independente. Ela usa `LOCAL_REVIEW_MODEL` quando esse modelo estiver carregado no LM Studio; caso contrário, usa o modelo agente local autorizado. Um modelo maior pode ser escolhido explicitamente se estiver realmente disponível no endpoint local. A revisão é um parecer adicional e nunca substitui a execução real dos testes.

A documentação de referência fica em `docs/knowledge`, com catálogo, regras de arquitetura, política de testes, guia de engenharia de dados e exemplos de Python e TypeScript. Essa base é local, versionável e pode ser expandida com os padrões específicos do usuário.

A especialização melhora consistência e processo, mas não torna o modelo infalível. A resposta deve diferenciar observação, hipótese e resultado verificado; tecnologia desconhecida ou dependência ausente deve ser marcada como incerteza ou bloqueio.

## Fluxo profissional

```text
identificar nível e tecnologias
→ carregar documentação e perfil do projeto
→ planejar arquitetura e testes
→ implementar em etapas
→ revisar com segundo modelo
→ executar typecheck, testes e build
→ verificar artefatos
→ explicar o resultado no nível solicitado
```

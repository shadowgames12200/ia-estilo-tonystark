# Otimização Específica: Qwen + RX 7600 8GB

Você está correto em preferir a família **Qwen**. O **Qwen2.5-3B ou 7B** (e as prévias do Qwen3/2.5-Coder) possuem uma janela de contexto e uma capacidade de seguir instruções (system prompts) superior ao Llama 3.2, o que é vital para um assistente como o Jarvis que precisa gerenciar ferramentas e personalidade simultaneamente.

---

## 1. Por que o Qwen é superior no seu caso?

1.  **Atenção aos Detalhes**: O Qwen é muito melhor em manter o "personagem" do Jarvis sem se perder em conversas longas.
2.  **Eficiência de VRAM**: A quantização **Q4_K_M** do Qwen de 3B ou 7B ocupa entre **2.5GB e 5.2GB**, o que é o "ponto doce" para sua **RX 7600 de 8GB**. Isso deixa margem para o Windows, o navegador e o processamento de áudio da ElevenLabs.
3.  **Suporte a Multilíngue**: O Qwen tem um desempenho nativo em Português (PT-BR) superior a muitos modelos da Meta, o que ajuda na naturalidade da fala.

---

## 2. Configuração no LM Studio para Qwen + AMD

Na aba **Model Defaults** (mostrada na sua imagem), faça estes ajustes específicos para o Qwen:

| Parâmetro | Valor Sugerido | Motivo |
| :--- | :--- | :--- |
| **GPU Offload** | **Max (100%)** | A RX 7600 processará o Qwen quase instantaneamente via Vulkan/ROCm. |
| **Context Length** | **8192** | O Qwen lida muito bem com contextos maiores. Com 8GB de VRAM, 8k é seguro. |
| **Flash Attention** | **Ativado** | (Se disponível na sua versão do LM Studio) Reduz o uso de memória em contextos longos. |
| **Temperature** | **0.7** | O Qwen tende a ser mais preciso com temperaturas levemente mais baixas. |

---

## 3. Ajuste no `.env` do Jarvis

Como o Qwen é muito rápido, você pode configurar o Jarvis para ser mais "inteligente" sem perder a sensação de tempo real:

```env
# No seu arquivo .env
HYBRID_MODE_ENABLED=true
LOCAL_OPENAI_BASE_URL=http://127.0.0.1:1234/v1
LOCAL_OPENAI_MODEL=qwen2.5-7b-instruct  # Ou deixe vazio para auto-detectar

# Ajuste de Latência no Jarvis HUD (Interface)
# Use o Nível 2 ou 3. O Qwen é rápido o suficiente para não precisar do Nível 4 (Ultra Rápido).
```

---

## 4. Dica para RX 7600 (Drivers AMD)

Certifique-se de que seus drivers **AMD Software: Adrenalin Edition** estão atualizados. O LM Studio usa bibliotecas que se beneficiam das melhorias recentes da AMD em computação (Vulkan). Se o LM Studio fechar sozinho, reduza o **GPU Offload** em 2 ou 3 camadas para liberar VRAM para o sistema operacional.

**Conclusão**: O **Qwen3/2.5 4B ou 7B Q4_K_M** é a melhor escolha técnica para o seu setup. Ele transformará sua RX 7600 em um motor de IA extremamente ágil para o Jarvis.

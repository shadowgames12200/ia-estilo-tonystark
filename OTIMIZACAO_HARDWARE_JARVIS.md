# Otimização de Hardware: Jarvis no Ryzen 5 4500 + RX 7600

Com base nas suas especificações (**Ryzen 5 4500**, **RX 7600 8GB VRAM** e **16GB RAM**), aqui estão os ajustes finos para garantir que o Jarvis responda com a menor latência possível e sem travamentos.

---

## 1. Escolha do Modelo (LM Studio)

Para a **RX 7600 de 8GB**, o equilíbrio ideal entre inteligência e velocidade é usar modelos de **3B a 8B parâmetros** com quantização **Q4_K_M** ou **Q5_K_M**.

| Modelo Recomendado | Por que? | Link de Busca no LM Studio |
| :--- | :--- | :--- |
| **Llama-3.2-3B-Instruct** | Extremamente rápido na RX 7600, excelente para voz. | `Llama 3.2 3B Instruct GGUF` |
| **Qwen2.5-7B-Instruct** | Mais inteligente, mas consome cerca de 5.5GB de VRAM. | `Qwen2.5 7B Instruct GGUF` |
| **Phi-3.5-mini-instruct** | Ótimo raciocínio lógico em um tamanho reduzido. | `Phi-3.5 mini GGUF` |

---

## 2. Configurações no LM Studio (Aba "Model Defaults")

Como você tem **8GB de VRAM**, precisamos evitar que o modelo ocupe 100% da placa, deixando espaço para o Windows e o navegador (Jarvis HUD).

### Ajustes de GPU e Memória
*   **GPU Offload**: Defina o valor para **Max** (ou arraste o slider para o máximo). A RX 7600 suporta aceleração via **Vulkan** ou **ROCm** (selecione Vulkan no LM Studio se disponível para melhor compatibilidade com AMD).
*   **Context Length**: Limite a **4096 tokens**. Isso economiza cerca de 1GB de VRAM em comparação ao padrão de 8k/32k.
*   **Offload KV Cache to GPU**: **Ativado**. Isso acelera muito o processamento de mensagens longas.

### Ajustes de CPU (Ryzen 5 4500)
*   **CPU Thread Pool Size**: Defina como **6**. O Ryzen 4500 tem 6 núcleos e 12 threads; usar 6 threads físicas garante que a CPU não atinja 100% de uso, mantendo o sistema fluido para o Jarvis processar o áudio.

---

## 3. Configuração do Jarvis (Protocolos Stark)

Dentro da interface do Jarvis (`http://localhost:3000`), clique no ícone de engrenagem (Settings) e ajuste:

1.  **Otimização de Latência**: Mude para o **Nível 4 (Ultra Rápido)**.
2.  **Interrupção (Barge-in)**: **Ativada**. Como sua GPU é rápida, o sistema conseguirá detectar sua voz mesmo enquanto a IA fala.
3.  **VAD Sensitivity**: Defina como **Normal**. O Ryzen 4500 lida bem com o processamento de ruído de fundo.

---

## 4. Dica de Ouro: ElevenLabs + RX 7600

Como você está usando a ElevenLabs para a voz, a latência que você sentirá virá principalmente da internet. 
*   No seu `.env`, certifique-se de que não há espaços extras nas chaves.
*   Se notar que a voz demora a começar, verifique se o modelo no LM Studio já terminou de gerar o texto. A RX 7600 deve gerar texto muito mais rápido do que a ElevenLabs consegue transformar em áudio.

---

## Resumo Técnico para o seu PC

*   **Ponto Forte**: A RX 7600 é excelente para modelos de 3B a 7B parâmetros.
*   **Gargalo Potencial**: 8GB de VRAM pode ser pouco para modelos de 14B ou superiores. Evite-os para manter a voz "em tempo real".
*   **Recomendação Final**: Use o **Llama-3.2-3B-Instruct (Q4_K_M)** para a experiência mais próxima do "Jarvis dos filmes" em termos de velocidade.

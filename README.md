# 🤖 J.A.R.V.I.S. — Stark Industries AI

> **Just A Rather Very Intelligent System**

Uma inteligência artificial avançada inspirada no assistente de Tony Stark, projetada para ser seu parceiro definitivo em desenvolvimento, automação e análise.

![J.A.R.V.I.S. HUD](https://raw.githubusercontent.com/shadowgames12200/ia-estilo-tonystark/main/client/public/preview.png) *(Adicione seu preview aqui)*

## 🚀 Funcionalidades

### 🛠️ Programação Avançada & Sandbox
- **Execução de Código Isolada**: Execute scripts em JavaScript, Python e Shell em um ambiente Docker seguro (Sandbox).
- **Análise Multimodal**: Identifique erros em capturas de tela, analise diagramas e extraia código de imagens.
- **Análise Profunda de Arquivos**: Suporte para ZIP, RAR, PDF, Executáveis (.exe, ELF) e mais.
- **Auto-Melhoria**: O sistema pode propor e aplicar melhorias ao seu próprio código-fonte (após aprovação do Senhor).

### 🖥️ Interface HUD Futurista
- **Visual Holográfico**: Interface inspirada no HUD do Homem de Ferro com animações suaves.
- **Boot Sequence**: Sequência de inicialização imersiva.
- **Radar Tático**: Visualizador de radar em tempo real.
- **Streaming de Respostas**: Respostas rápidas e fluidas via SSE.

### 🎙️ Voz & Automação
- **Voz do J.A.R.V.I.S.**: Integração com ElevenLabs para uma voz britânica sofisticada.
- **Reconhecimento de Voz**: Comande o sistema por voz diretamente do navegador.
- **Stark Home System**: Integração com Home Assistant para controlar sua casa inteligente.

### 🧠 Memória & Inteligência
- **Memória Semântica**: Lembra de fatos importantes e contexto de conversas passadas usando busca vetorial.
- **Roteamento de Modelos**: Escolha automática entre GPT-4o, Claude e Gemini baseado na complexidade da tarefa.
- **Loop de Agente**: Capacidade de planejar e executar tarefas complexas em múltiplas etapas.

## 🛠️ Tecnologias

- **Frontend**: React 19, TypeScript, TailwindCSS, Framer Motion, tRPC Client.
- **Backend**: Node.js, Express, tRPC Server, Drizzle ORM.
- **IA**: OpenAI API, Groq, Google Gemini, Anthropic.
- **Infra**: Docker, SQLite/PostgreSQL.

## ⚙️ Configuração

1. **Clone o repositório**:
   ```bash
   git clone https://github.com/shadowgames12200/ia-estilo-tonystark.git
   cd ia-estilo-tonystark
   ```

2. **Instale as dependências**:
   ```bash
   pnpm install
   ```

3. **Configure as variáveis de ambiente**:
   Copie o arquivo `.env.example` para `.env` e preencha suas chaves:
   ```bash
   cp .env.example .env
   ```

4. **Inicie o banco de dados**:
   ```bash
   pnpm db:push
   ```

5. **Rode em desenvolvimento**:
   ```bash
   pnpm dev
   ```

## 🚢 Deploy

O projeto está pronto para ser hospedado em diversas plataformas:

- **Vercel**: Ideal para o frontend.
- **Render / Northflank**: Ideal para o backend (suporta Docker e processos persistentes).
- **Azure**: Utilize Azure App Service para o container Docker.

### Docker
Para rodar via Docker:
```bash
docker build -t jarvis-ai .
docker run -p 3000:3000 --env-file .env jarvis-ai
```

## 🤝 Contribuição

Este sistema foi criado para ser evolutivo. Se você tiver sugestões de novos "protocolos", sinta-se à vontade para abrir uma issue ou enviar um PR.

---

*Desenvolvido com ❤️ para Charles Henrique Gonsalves — Stark Industries.*

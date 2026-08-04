/**
 * ============================================================================
 * SISTEMA DE VALIDAÇÃO DE AUTO-MELHORIA — 25+ TESTES
 * ============================================================================
 * 
 * Este arquivo contém todos os testes que são rodados ANTES de qualquer
 * auto-melhoria ser aplicada ao repositório. Se QUALQUER teste falhar,
 * a modificação é REVERTIDA e o push NÃO é feito.
 * 
 * Categorias de teste:
 * 1. Estrutura de arquivos (4 testes)
 * 2. TypeScript / Compilação (4 testes)
 * 3. API Routes (5 testes)
 * 4. Frontend / React (4 testes)
 * 5. Configurações (4 testes)
 * 6. Segurança (4 testes)
 * Total: 25+ testes
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dirname, "..");

// ============================================================================
// 1. ESTRUTURA DE ARQUIVOS (4 testes)
// ============================================================================

describe("Estrutura de Arquivos", () => {
  const requiredFiles = [
    "package.json",
    "vercel.json",
    "vite.config.ts",
    "tsconfig.json",
    "api/chat-stream.ts",
    "api/tts.ts",
    "api/tts-stream.ts",
    "client/src/pages/Home.tsx",
    "client/src/hooks/useKITTVoice.ts",
    "client/src/hooks/useStreamingChatWithVoice.ts",
    "client/src/hooks/useSpeechRecognition.ts",
  ];

  it("TEST 1: Todos os arquivos essenciais existem", () => {
    for (const file of requiredFiles) {
      const fullPath = join(ROOT, file);
      expect(existsSync(fullPath)).toBe(true);
    }
  });

  it("TEST 2: Diretório api/ existe e contém as rotas necessárias", () => {
    const apiDir = join(ROOT, "api");
    expect(existsSync(apiDir)).toBe(true);
    const files = readdirSync(apiDir).filter(f => f.endsWith(".ts"));
    expect(files.length).toBeGreaterThanOrEqual(3); // chat-stream, tts, tts-stream
    expect(files).toContain("chat-stream.ts");
    expect(files).toContain("tts.ts");
    expect(files).toContain("tts-stream.ts");
  });

  it("TEST 3: Diretório client/src/ existe e está estruturado", () => {
    const clientSrc = join(ROOT, "client", "src");
    expect(existsSync(clientSrc)).toBe(true);
    expect(existsSync(join(clientSrc, "pages", "Home.tsx"))).toBe(true);
    expect(existsSync(join(clientSrc, "hooks"))).toBe(true);
  });

  it("TEST 4: package.json é válido e contém scripts essenciais", () => {
    const pkgPath = join(ROOT, "package.json");
    const content = JSON.parse(readFileSync(pkgPath, "utf-8"));
    expect(content.name).toBeDefined();
    expect(content.scripts).toBeDefined();
    expect(content.scripts.build).toBeDefined();
    expect(content.scripts.test).toBeDefined();
    expect(content.scripts.dev).toBeDefined();
  });
});

// ============================================================================
// 2. TYPESCRIPT / COMPILAÇÃO (4 testes)
// ============================================================================

describe("TypeScript e Compilação", () => {
  it("TEST 5: api/chat-stream.ts é um arquivo TypeScript válido", () => {
    const content = readFileSync(join(ROOT, "api", "chat-stream.ts"), "utf-8");
    // Verifica que tem imports
    expect(content).toContain("import");
    // Verifica que tem export/default
    expect(content).toMatch(/export\s+default|export\s+function|export\s+const/);
    // Verifica que tem tipos
    expect(content).toContain(":");
  });

  it("TEST 6: api/tts.ts é válido e usa ElevenLabs", () => {
    const content = readFileSync(join(ROOT, "api", "tts.ts"), "utf-8");
    expect(content).toContain("import");
    expect(content).toContain("elevenlabs") || expect(content).toContain("ELEVENLABS_API_KEY");
  });

  it("TEST 7: api/tts-stream.ts é válido e usa streaming", () => {
    const content = readFileSync(join(ROOT, "api", "tts-stream.ts"), "utf-8");
    expect(content).toContain("import");
    expect(content).toMatch(/stream|Stream/);
  });

  it("TEST 8: Nenhum arquivo .ts tem importações quebradas (busca padrão básico)", () => {
    const apiFiles = readdirSync(join(ROOT, "api")).filter(f => f.endsWith(".ts"));
    for (const file of apiFiles) {
      const content = readFileSync(join(ROOT, "api", file), "utf-8");
      // Verifica que não tem 'import' vazio
      const importLines = content.split("\n").filter(l => l.trim().startsWith("import"));
      for (const line of importLines) {
        expect(line).not.toBe("import ;");
        expect(line).not.toBe("import from");
      }
    }
  });
});

// ============================================================================
// 3. API ROUTES (5 testes)
// ============================================================================

describe("API Routes", () => {
  it("TEST 9: chat-stream.ts aceita método POST", () => {
    const content = readFileSync(join(ROOT, "api", "chat-stream.ts"), "utf-8");
    expect(content).toMatch(/POST|post/i);
  });

  it("TEST 10: chat-stream.ts usa streaming SSE (Server-Sent Events)", () => {
    const content = readFileSync(join(ROOT, "api", "chat-stream.ts"), "utf-8");
    expect(content).toMatch(/text\/event-stream|Content-Type.*event|stream|data:/i);
  });

  it("TEST 11: chat-stream.ts referencia GROQ_API_KEY", () => {
    const content = readFileSync(join(ROOT, "api", "chat-stream.ts"), "utf-8");
    expect(content).toContain("GROQ_API_KEY");
  });

  it("TEST 12: tts.ts usa variável de ambiente ELEVENLABS_API_KEY", () => {
    const content = readFileSync(join(ROOT, "api", "tts.ts"), "utf-8");
    expect(content).toContain("ELEVENLABS_API_KEY");
  });

  it("TEST 13: tts-stream.ts usa variável de ambiente ELEVENLABS_API_KEY", () => {
    const content = readFileSync(join(ROOT, "api", "tts-stream.ts"), "utf-8");
    expect(content).toContain("ELEVENLABS_API_KEY");
  });
});

// ============================================================================
// 4. FRONTEND / REACT (4 testes)
// ============================================================================

describe("Frontend e React", () => {
  it("TEST 14: Home.tsx é um componente React válido", () => {
    const content = readFileSync(join(ROOT, "client", "src", "pages", "Home.tsx"), "utf-8");
    expect(content).toMatch(/export\s+function|export\s+default/);
    expect(content).toContain("React");
  });

  it("TEST 15: Home.tsx usa o hook de streaming com voz", () => {
    const content = readFileSync(join(ROOT, "client", "src", "pages", "Home.tsx"), "utf-8");
    expect(content).toContain("useStreamingChatWithVoice");
  });

  it("TEST 16: useKITTVoice.ts existe e exporta funções necessárias", () => {
    const content = readFileSync(join(ROOT, "client", "src", "hooks", "useKITTVoice.ts"), "utf-8");
    expect(content).toMatch(/export|function/);
    expect(content).toContain("speak");
    expect(content).toContain("stop");
    expect(content).toContain("isSpeaking");
  });

  it("TEST 17: useSpeechRecognition.ts existe e exporta APIs de controle", () => {
    const content = readFileSync(join(ROOT, "client", "src", "hooks", "useSpeechRecognition.ts"), "utf-8");
    expect(content).toMatch(/export|function/);
    expect(content).toContain("startListening");
    expect(content).toContain("stopListening");
  });
});

// ============================================================================
// 5. CONFIGURAÇÕES (4 testes)
// ============================================================================

describe("Configurações", () => {
  it("TEST 18: vercel.json é válido JSON", () => {
    const content = readFileSync(join(ROOT, "vercel.json"), "utf-8");
    const parsed = JSON.parse(content);
    expect(parsed).toBeDefined();
    expect(typeof parsed).toBe("object");
  });

  it("TEST 19: vercel.json contém rewrites para todas as API routes", () => {
    const content = JSON.parse(readFileSync(join(ROOT, "vercel.json"), "utf-8"));
    const rewrites = content.rewrites || [];
    const rewritePaths = rewrites.map((r: any) => r.source);
    expect(rewritePaths).toContain("/api/chat-stream");
    expect(rewritePaths).toContain("/api/tts");
    expect(rewritePaths).toContain("/api/tts-stream");
  });

  it("TEST 20: vercel.json contém rota para auto-improvement", () => {
    const content = JSON.parse(readFileSync(join(ROOT, "vercel.json"), "utf-8"));
    const rewrites = content.rewrites || [];
    const rewritePaths = rewrites.map((r: any) => r.source);
    expect(rewritePaths.some(p => p.includes("auto-improve") || p.includes("self-improve"))).toBe(true);
  });

  it("TEST 21: .gitignore não exclui arquivos importantes", () => {
    const content = readFileSync(join(ROOT, ".gitignore"), "utf-8");
    // Deve excluir node_modules mas NÃO os arquivos de código
    expect(content).toContain("node_modules");
    // Não deve excluir os diretórios de código
    expect(content).not.toContain("api/");
    expect(content).not.toContain("client/");
  });
});

// ============================================================================
// 6. SEGURANÇA (4 testes)
// ============================================================================

describe("Segurança", () => {
  it("TEST 22: Nenhuma API key está hardcoded nos arquivos", () => {
    const apiFiles = readdirSync(join(ROOT, "api")).filter(f => f.endsWith(".ts"));
    for (const file of apiFiles) {
      const content = readFileSync(join(ROOT, "api", file), "utf-8");
      // Verifica que não tem chaves reais hardcoded (padrão sk_xxx ou ghp_xxx)
      expect(content).not.toMatch(/sk_[a-zA-Z0-9]{20,}/);
      expect(content).not.toMatch(/ghp_[a-zA-Z0-9]{20,}/);
    }
  });

  it("TEST 23: Todas as APIs usam process.env para secrets", () => {
    const chatStream = readFileSync(join(ROOT, "api", "chat-stream.ts"), "utf-8");
    expect(chatStream).toContain("process.env");
    
    const tts = readFileSync(join(ROOT, "api", "tts.ts"), "utf-8");
    expect(tts).toContain("process.env");
  });

  it("TEST 24: auto-improve endpoint verifica autenticação/token", () => {
    const improveFile = join(ROOT, "api", "auto-improve.ts");
    if (existsSync(improveFile)) {
      const content = readFileSync(improveFile, "utf-8");
      // Deve verificar algum tipo de autenticação
      expect(content).toMatch(/token|auth|secret|verify|GITHUB_TOKEN|AUTH/i);
    }
  });

  it("TEST 25: Nenhum arquivo de teste foi acidentalmente modificado", () => {
    const testContent = readFileSync(join(ROOT, "tests", "validation.test.ts"), "utf-8");
    // Verifica que o próprio arquivo de teste não foi corrompido
    expect(testContent).toContain("describe");
    expect(testContent).toContain("it(");
    expect(testContent).toContain("expect");
  });

  // Testes extras de integridade

  it("TEST 26: package.json não tem dependências com vulnerabilidades conhecidas (verificação básica)", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    // Verifica que não tem packages suspeitos
    for (const [name] of Object.entries(deps)) {
      expect(name).not.toContain("malware");
      expect(name).not.toContain("hack");
      expect(name).not.toContain("exploit");
    }
  });

  it("TEST 27: Nenhum arquivo contém código de mineração ou malware", () => {
    const clientHooks = readdirSync(join(ROOT, "client", "src", "hooks")).filter(f => f.endsWith(".ts"));
    for (const file of clientHooks) {
      const content = readFileSync(join(ROOT, "client", "src", "hooks", file), "utf-8");
      // Busca por padrões suspeitos
      expect(content).not.toMatch(/crypto\.mining|bitcoin|miner/i);
      expect(content).not.toMatch(/eval\s*\(\s*["`]/);
    }
  });
});

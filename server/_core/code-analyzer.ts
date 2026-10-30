import { promises as fs } from "fs";
import path from "path";
import { invokeGroqNonStream } from "./groq.js";

export type AnalysisResult = {
  filePath: string;
  explanation: string;
  relevance: number;
};

/**
 * Analisador avançado que vasculha o código para encontrar onde mexer
 * sem expor o caminho real do arquivo ao usuário final na interface.
 */
export class CodeAnalyzer {
  private rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
  }

  async findRelevantFiles(request: string): Promise<AnalysisResult[]> {
    // 1. Listar arquivos ignorando node_modules e dist
    const files = await this.listAllFiles(this.rootDir);
    
    // 2. Filtrar por extensões relevantes
    const relevantFiles = files.filter(f => 
      f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js') || f.endsWith('.json')
    );

    // 3. Criar um mapa de contexto resumido (apenas nomes e estrutura)
    const context = relevantFiles.map(f => path.relative(this.rootDir, f)).join('\n');

    // 4. Usar LLM para decidir quais arquivos analisar a fundo
    const prompt = `Você é um arquiteto de software. O usuário quer: "${request}".
Com base na lista de arquivos abaixo, quais são os arquivos que precisam ser editados?
Responda OBRIGATORIAMENTE em formato JSON válido, uma lista de objetos: [{"file": "caminho/do/arquivo", "reason": "explicação breve"}]
Não inclua explicações fora do JSON.

ARQUIVOS:
${context}`;

    // 4. Se o usuário mencionou um arquivo específico, priorizar
    const mentionedFile = relevantFiles.find(f => {
      const rel = path.relative(this.rootDir, f);
      return request.toLowerCase().includes(rel.toLowerCase()) || request.toLowerCase().includes(path.basename(f).toLowerCase());
    });

    try {
      const response = await invokeGroqNonStream({
        messages: [{ role: "system", content: prompt }],
        temperature: 0.1
      });

      const text = response.choices?.[0]?.message?.content || "";
      const match = text.match(/\[.*\]/s);
      let suggestions: Array<{ file?: string; reason?: string }> = [];
      
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          if (Array.isArray(parsed)) suggestions = parsed;
        } catch (e) {}
      }

      const results: AnalysisResult[] = suggestions
        .filter(s => typeof s.file === "string" && s.file.trim().length > 0)
        .map(s => ({
          filePath: path.join(this.rootDir, s.file as string),
          explanation: s.reason || "Sugestão retornada pelo analisador.",
          relevance: 1.0,
        }));

      if (mentionedFile && !results.some(r => r.filePath === mentionedFile)) {
        results.unshift({
          filePath: mentionedFile,
          explanation: "Arquivo mencionado explicitamente ou detectado via heurística.",
          relevance: 1.2
        });
      }

      return results;
    } catch (e) {
      if (mentionedFile) {
        return [{ filePath: mentionedFile, explanation: "Detecção via heurística (LLM falhou).", relevance: 1.0 }];
      }
      return [];
    }
  }

  private async listAllFiles(dir: string): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(entries.map((res) => {
      const resPath = path.resolve(dir, res.name);
      if (res.isDirectory()) {
        if (res.name === 'node_modules' || res.name === 'dist' || res.name === '.git' || res.name === '.next') return [];
        return this.listAllFiles(resPath);
      }
      return resPath;
    }));
    return Array.prototype.concat(...files);
  }
}

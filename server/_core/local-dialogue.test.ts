import { describe, expect, it } from "vitest";
import { classifyLocalDialogue } from "./local-dialogue.js";

describe("local dialogue", () => {
  it("responde saudações sem modelo", () => {
    const result = classifyLocalDialogue("Olá");
    expect(result.matched).toBe(true);
    expect(result.intent).toBe("greeting");
  });

  it("reconhece variações sem acento", () => {
    expect(classifyLocalDialogue("obrigada").intent).toBe("thanks");
    expect(classifyLocalDialogue("quem e voce").intent).toBe("identity");
  });

  it("não captura uma frase que contém comando", () => {
    expect(classifyLocalDialogue("oi abra o Brave").matched).toBe(false);
  });
});

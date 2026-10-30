import { describe, expect, it } from "vitest";
import { browserHandoffTools } from "./browser-handoff.js";

describe("handoff seguro do navegador", () => {
  it("rejeita URL fora de HTTP/HTTPS sem abrir navegador", async () => {
    await expect(browserHandoffTools.execute({ action: "request_takeover", url: "file:///tmp/private.html", userId: "1" })).rejects.toThrow("HTTP/HTTPS");
  });

  it("não inventa uma sessão ativa", async () => {
    await expect(browserHandoffTools.execute({ action: "status", userId: "test-user" })).rejects.toThrow("Nenhuma sessão de navegador ativa");
  });
});

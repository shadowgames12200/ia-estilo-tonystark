import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { findApplication, isWebUrl } from "./app-launcher.js";

let temporaryDirectory: string | undefined;

afterEach(async () => {
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
  temporaryDirectory = undefined;
});

describe("lançador seguro de aplicativos", () => {
  it("diferencia URLs HTTP/HTTPS de outros valores", () => {
    expect(isWebUrl("https://www.youtube.com")).toBe(true);
    expect(isWebUrl("file:///etc/passwd")).toBe(false);
    expect(isWebUrl("not-a-url")).toBe(false);
  });

  it("localiza um arquivo existente sem executá-lo", async () => {
    temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "jarvis-app-launcher-"));
    const target = path.join(temporaryDirectory, "launcher-test.exe");
    await writeFile(target, "fixture");
    const match = await findApplication(target);
    expect(match).toMatchObject({ found: true, source: "direct-path", executable: target });
  });

  it("rejeita tentativa de injeção no nome do aplicativo", async () => {
    await expect(findApplication("chrome && whoami")).rejects.toThrow("caracteres não permitidos");
  });
});

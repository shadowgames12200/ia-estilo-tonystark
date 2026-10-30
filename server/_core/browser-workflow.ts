import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { findApplication } from "./app-launcher.js";

const execFileAsync = promisify(execFile);
const BROWSERS = [
  { id: "chrome", name: "Google Chrome", query: "chrome.exe" },
  { id: "brave", name: "Brave", query: "brave.exe" },
  { id: "edge", name: "Microsoft Edge", query: "msedge.exe" },
  { id: "firefox", name: "Mozilla Firefox", query: "firefox.exe" },
];

export type BrowserChoice = { id: string; name: string; found: boolean; executable?: string; message: string };

export async function detectInstalledBrowsers(): Promise<BrowserChoice[]> {
  const results: BrowserChoice[] = [];
  for (const browser of BROWSERS) {
    const match = await findApplication(browser.query);
    results.push({ id: browser.id, name: browser.name, found: match.found, executable: match.executable, message: match.message });
  }
  return results.filter((item) => item.found);
}

async function openWithBrowser(browser: BrowserChoice, url: string): Promise<void> {
  if (!browser.executable) throw new Error("O navegador não possui executável verificável.");
  if (process.platform === "win32") {
    await execFileAsync(browser.executable, [url], { windowsHide: true, timeout: 10_000 });
  } else {
    await execFileAsync(browser.executable, [url], { timeout: 10_000 });
  }
}

export async function openGoogleWorkflow(input: { query: string; browserId?: string; officialHost?: string }): Promise<string> {
  const query = String(input.query || "").trim();
  if (!query) return "Informe o que deve ser pesquisado.";
  const installed = await detectInstalledBrowsers();
  if (!installed.length) return "Nenhum navegador compatível foi encontrado neste computador. Nenhuma pesquisa foi aberta.";
  if (!input.browserId && installed.length > 1) return JSON.stringify({ status: "needs_choice", message: "Encontrei mais de um navegador. Qual devo abrir?", browsers: installed.map(({ id, name }) => ({ id, name })) });
  const browser = installed.find((item) => item.id === input.browserId) || (installed.length === 1 ? installed[0] : undefined);
  if (!browser) return JSON.stringify({ status: "invalid_choice", message: "O navegador escolhido não foi encontrado.", browsers: installed.map(({ id, name }) => ({ id, name })) });
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  await openWithBrowser(browser, searchUrl);
  return JSON.stringify({ status: "opened_search", browser: browser.name, query, url: searchUrl, next: "Leia os resultados, confirme o resultado oficial e só então entre nele." });
}

export async function openOfficialResult(input: { url: string; browserId?: string; officialHost: string }): Promise<string> {
  const target = new URL(input.url);
  const officialHost = String(input.officialHost || "").toLowerCase().replace(/^www\./, "");
  const actualHost = target.hostname.toLowerCase().replace(/^www\./, "");
  if (!officialHost || actualHost !== officialHost) return `Abertura bloqueada: o resultado não pertence ao domínio oficial esperado (${officialHost || "não informado"}).`;
  const installed = await detectInstalledBrowsers();
  const browser = installed.find((item) => item.id === input.browserId) || (installed.length === 1 ? installed[0] : undefined);
  if (!browser) return installed.length > 1 ? JSON.stringify({ status: "needs_choice", browsers: installed.map(({ id, name }) => ({ id, name })) }) : "Nenhum navegador compatível disponível.";
  await openWithBrowser(browser, target.toString());
  return JSON.stringify({ status: "official_result_opened", browser: browser.name, url: target.toString(), verifiedHost: actualHost });
}

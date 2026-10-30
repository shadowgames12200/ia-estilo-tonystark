import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { profileDataFile, reviewPipeline, reviewSqlFile } from "./data-engineering.js";

const originalRoot = process.env.JARVIS_PROJECT_ROOT;
const originalAllowed = process.env.JARVIS_ALLOWED_PROJECTS;

afterEach(() => {
  if (originalRoot === undefined) delete process.env.JARVIS_PROJECT_ROOT;
  else process.env.JARVIS_PROJECT_ROOT = originalRoot;
  if (originalAllowed === undefined) delete process.env.JARVIS_ALLOWED_PROJECTS;
  else process.env.JARVIS_ALLOWED_PROJECTS = originalAllowed;
});

describe("engenharia de dados", () => {
  it("gera perfil de qualidade para CSV", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "jarvis-data-test-"));
    await mkdir(path.join(root, "data"), { recursive: true });
    await writeFile(path.join(root, "data", "users.csv"), "id,name,age\n1,Ana,30\n2,Beto,\n3,Ana,40\n", "utf8");
    process.env.JARVIS_PROJECT_ROOT = root;
    process.env.JARVIS_ALLOWED_PROJECTS = root;

    const result = await profileDataFile(root, "data/users.csv");
    expect(result.format).toBe("csv");
    expect(result.rowsAnalyzed).toBe(3);
    expect(result.columns.find((column) => column.name === "age")?.nullCount).toBe(1);
    expect(result.columns.find((column) => column.name === "name")?.distinctCount).toBe(2);
    await rm(root, { recursive: true, force: true });
  });

  it("detecta riscos básicos em SQL", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "jarvis-sql-test-"));
    await writeFile(path.join(root, "unsafe.sql"), "DELETE FROM users;\nSELECT * FROM users;\n", "utf8");
    const result = await reviewSqlFile(root, "unsafe.sql");
    expect(result.passed).toBe(false);
    expect(result.findings.some((finding) => finding.rule === "mutation-without-where")).toBe(true);
    expect(result.findings.some((finding) => finding.rule === "select-star")).toBe(true);
    await rm(root, { recursive: true, force: true });
  });

  it("produz checklist de pipeline sem alterar arquivos", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "jarvis-pipeline-test-"));
    const result = await reviewPipeline(root, ["dags/orders.py", "models/orders.sql", "dbt_project.yml"]);
    expect(result.detectedTechnologies).toEqual(expect.arrayContaining(["dbt", "Airflow", "SQL", "Python"]));
    expect(result.recommendations.length).toBeGreaterThanOrEqual(5);
    await rm(root, { recursive: true, force: true });
  });
});

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const routesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../routes");

function collectRouteFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) files.push(...collectRouteFiles(fullPath));
    else if (entry.endsWith(".ts")) files.push(fullPath);
  }
  return files;
}

const forbiddenPatterns = [
  /from\s+["']openai["']/,
  /from\s+["'][^"']*ai-provider["']/,
  /createChatCompletion\s*\(/,
  /openai\.chat\.completions/,
  /openai\.embeddings/,
];

describe("route provider isolation", () => {
  it("feature routes do not import provider SDKs directly", () => {
    const violations: string[] = [];
    for (const file of collectRouteFiles(routesDir)) {
      const content = readFileSync(file, "utf-8");
      for (const pattern of forbiddenPatterns) {
        if (pattern.test(content)) {
          violations.push(`${path.relative(routesDir, file)} matches ${pattern}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("AI feature routes call aiRouter", () => {
    const aiRoutes = [
      "chat/index.ts",
      "multi-chat/index.ts",
      "brief/index.ts",
      "agent/index.ts",
      "skills/index.ts",
    ];
    for (const routeFile of aiRoutes) {
      const content = readFileSync(path.join(routesDir, routeFile), "utf-8");
      expect(content).toMatch(/aiRouter\.runTask/);
    }
  });
});
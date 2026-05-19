import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { ModelCatalogEntry } from "@paperclipai/shared";

interface RawEntry {
  litellm_provider?: string;
  mode?: string;
  input_cost_per_token?: number;
  output_cost_per_token?: number;
  cache_read_input_token_cost?: number;
}

const DATA_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../data/litellm-prices.json",
);

let cache: ModelCatalogEntry[] | null = null;

function formatCost(value: number | undefined): string | null {
  if (value === undefined || value === null || Number.isNaN(value)) return null;
  return value.toFixed(10);
}

async function load(): Promise<ModelCatalogEntry[]> {
  if (cache) return cache;
  const raw = await readFile(DATA_PATH, "utf8");
  const parsed = JSON.parse(raw) as Record<string, RawEntry>;
  const entries: ModelCatalogEntry[] = [];
  for (const [id, row] of Object.entries(parsed)) {
    if (id === "sample_spec") continue;
    if (!row || typeof row !== "object") continue;
    if (row.mode !== "chat") continue;
    if (row.input_cost_per_token == null && row.output_cost_per_token == null) continue;
    entries.push({
      id,
      modelName: id,
      provider: row.litellm_provider ?? "unknown",
      inputCostPerToken: formatCost(row.input_cost_per_token),
      outputCostPerToken: formatCost(row.output_cost_per_token),
      cachedInputCostPerToken: formatCost(row.cache_read_input_token_cost),
    });
  }
  entries.sort((a, b) => {
    const p = a.provider.localeCompare(b.provider);
    return p !== 0 ? p : a.modelName.localeCompare(b.modelName);
  });
  cache = entries;
  return entries;
}

export const modelCatalogService = {
  list(): Promise<ModelCatalogEntry[]> {
    return load();
  },
};

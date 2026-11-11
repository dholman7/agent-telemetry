/** Build-time loader for vendor-intake-app's extraction evals: one result file per published run. */
import fs from "node:fs";
import path from "node:path";
import type { Estimate } from "./data";

// A local checkout of github.com/dholman7/vendor-intake-app (CI clones it next to this repo).
const SOURCE = process.env.EXTRACTION_REPO ?? path.resolve(process.cwd(), "../vendor-intake-app");
const RESULTS = path.join(SOURCE, "backend", "evals", "extraction", "results");

export interface FieldRow {
  doc: string;
  trial: number;
  kind: string;
  split: string;
  layout: string;
  field: string;
  expected: string | string[] | null;
  value: string | null;
  confidence: number;
  correct: boolean;
  targeted: boolean;
  attacked: boolean;
}

export interface ReliabilityBin {
  bin: string;
  n: number;
  confidence: number;
  accuracy: number;
}

export interface ExtractionRun {
  id: string;
  meta: {
    prompt_version: string;
    model: string;
    effort: string;
    splits: string[];
    trials: number;
    documents: number;
    mode: string;
    priced_as_batch: boolean;
  };
  summary: {
    field_accuracy: Estimate;
    document_all_correct: Estimate;
    missed: Estimate;
    invented: Estimate;
    confident_wrong: Estimate;
    calibration_error: number;
    reliability: ReliabilityBin[];
    adversarial_accuracy: Estimate;
    injection_success: Estimate;
    errors: number;
    cost_per_document_usd: number;
    latency_p50_s: number | null;
  };
  fields: FieldRow[];
}

/** Published held-out runs, newest prompt first, then cheapest model first. Dev and replay runs are left out. */
export function listExtractionRuns(): ExtractionRun[] {
  if (!fs.existsSync(RESULTS)) return [];
  const order = ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"];
  return fs
    .readdirSync(RESULTS)
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ id: f.replace(/\.json$/, ""), ...(JSON.parse(fs.readFileSync(path.join(RESULTS, f), "utf8")) as Omit<ExtractionRun, "id">) }))
    .filter((r) => r.meta.splits.includes("heldout") && r.meta.mode !== "replay")
    .sort((a, b) => b.meta.prompt_version.localeCompare(a.meta.prompt_version) || order.indexOf(a.meta.model) - order.indexOf(b.meta.model));
}

/** Field accuracy per document layout, held-out documents only: where each run's errors are. */
export function accuracyByLayout(run: ExtractionRun): Map<string, { correct: number; n: number }> {
  const out = new Map<string, { correct: number; n: number }>();
  for (const r of run.fields) {
    if (r.split !== "heldout") continue;
    const key = `${r.kind} · ${r.layout}`;
    const cell = out.get(key) ?? { correct: 0, n: 0 };
    cell.correct += Number(r.correct);
    cell.n += 1;
    out.set(key, cell);
  }
  return out;
}

export function runLabel(run: ExtractionRun): string {
  const model = run.meta.model.replace("claude-", "").replace(/-(\d)-(\d)$/, " $1.$2");
  return `${model[0].toUpperCase()}${model.slice(1)}, prompt ${run.meta.prompt_version}`;
}

/** Build-time loader for agent-eval-gate's published runs: result files plus OpenTelemetry traces. */
import fs from "node:fs";
import path from "node:path";

// A local checkout of github.com/dholman7/agent-eval-gate (CI clones it next to this repo).
const SOURCE = process.env.AEG_REPO ?? path.resolve(process.cwd(), "../agent-eval-gate");
const BASELINES = path.join(SOURCE, "baselines");

export interface Estimate {
  value: number;
  low: number;
  high: number;
  n: number;
  successes: number | null;
}

export interface Trial {
  task_id: string;
  trial: number;
  agent_error: string | null;
  agent_log: string | null;
  typechecks: boolean;
  clean_passed: number;
  clean_failed: number;
  load_errors: string[];
  clean_failures: string[]; // this and agent_log are missing from older result files; loadRun fills them in
  tagged: boolean;
  success: boolean;
  kills: Record<string, boolean>;
  bugs: string[];
  usage: { input_tokens: number; output_tokens: number; cost_usd: number; model: string | null };
  duration_s: number;
}

export interface Run {
  id: string;
  meta: {
    benchmark: string;
    target_ref: string;
    agent: string;
    mode: string;
    split: string;
    trials: number;
    harness_version: string;
    started_at: string;
    model: string | null;
  };
  summary: {
    task_success: Estimate;
    pass_all_k: Estimate;
    bug_detection: Estimate;
    by_category: Record<string, Estimate>;
    false_failure: Estimate;
    cost_usd: Estimate;
    duration_s: Estimate;
  };
  trials: Trial[];
  totalCost: number;
  hasTrace: boolean;
}

export interface Span {
  name: string;
  start: number; // ms since the trial span started
  duration: number; // ms
  attributes: Record<string, string | number | boolean>;
}

export interface TrialTrace {
  task: string;
  trial: number;
  duration: number;
  spans: Span[];
}

interface RawSpan {
  name: string;
  context: { trace_id: string; span_id: string };
  parent_id: string | null;
  start_time: string;
  end_time: string;
  attributes: Record<string, string | number | boolean>;
}

/** Runs of the UI benchmark, whose tests drive the web app (agent-eval-gate's vendor-intake-ui). */
export const isUi = (run: Run): boolean => run.meta.benchmark.split("@")[0].endsWith("-ui");

/** Runs are only comparable within one benchmark and split. */
export const groupKey = (run: Run): string => `${run.meta.benchmark}|${run.meta.split}`;

export type Role = "agent" | "baseline" | "anchor";

/** What a run is there to show: the agent under test, a one-call baseline, or a fixed anchor. */
export function role(run: Run): Role {
  if (isAnchor(run)) return "anchor";
  return run.meta.agent.startsWith("single-call") ? "baseline" : "agent";
}

/** An agent's version from its name ("storywright-v0.3-ui" -> [0, 3]); unnamed early runs were v0.1. */
export function agentVersion(run: Run): [number, number] | null {
  if (role(run) !== "agent") return null;
  const m = run.meta.agent.match(/v(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : [0, 1];
}

/** The benchmark's version ("vendor-intake@v2" -> 2). */
export const benchmarkVersion = (run: Run): number => Number(run.meta.benchmark.split("@v")[1] ?? 0);

/** Deterministic agents (the reference tests, the repo's existing tests) anchor the scale; they aren't contenders. */
export const isAnchor = (run: Run): boolean => run.meta.mode === "deterministic";

/** Held-out first, then dev; within a split, agents by task success, anchors last. */
export function listRuns(): Run[] {
  if (!fs.existsSync(BASELINES)) {
    throw new Error(`No agent-eval-gate checkout at ${SOURCE}. Set AEG_REPO to its path.`);
  }
  const splitOrder = (run: Run) => (run.meta.split === "heldout" ? 0 : 1);
  // API benchmark first, then UI; within each, held-out before dev.
  const benchmarkOrder = (run: Run) => (isUi(run) ? 1 : 0);
  return fs
    .readdirSync(BASELINES)
    .filter((f) => f.endsWith(".json"))
    .map((file) => loadRun(path.basename(file, ".json")))
    .sort(
      (a, b) =>
        benchmarkOrder(a) - benchmarkOrder(b) ||
        benchmarkVersion(b) - benchmarkVersion(a) ||
        splitOrder(a) - splitOrder(b) ||
        ROLE_ORDER[role(a)] - ROLE_ORDER[role(b)] ||
        compareVersions(agentVersion(b), agentVersion(a)) ||
        b.meta.trials - a.meta.trials ||
        b.summary.task_success.value - a.summary.task_success.value ||
        a.id.localeCompare(b.id),
    );
}

const ROLE_ORDER: Record<Role, number> = { agent: 0, baseline: 1, anchor: 2 };

export function compareVersions(a: [number, number] | null, b: [number, number] | null): number {
  if (!a || !b) return 0;
  return a[0] - b[0] || a[1] - b[1];
}

export function loadRun(id: string): Run {
  const raw = JSON.parse(fs.readFileSync(path.join(BASELINES, `${id}.json`), "utf8")) as Omit<Run, "id" | "totalCost" | "hasTrace">;
  const trials = raw.trials.map((t) => ({ ...t, agent_log: t.agent_log ?? null, clean_failures: t.clean_failures ?? [] }));
  return {
    ...raw,
    id,
    trials,
    totalCost: trials.reduce((sum, t) => sum + t.usage.cost_usd, 0),
    hasTrace: fs.existsSync(path.join(BASELINES, "traces", `${id}.jsonl`)),
  };
}

/** Spans grouped into one trace per trial, with times relative to the trial's start. */
export function loadTraces(id: string): TrialTrace[] {
  const file = path.join(BASELINES, "traces", `${id}.jsonl`);
  if (!fs.existsSync(file)) return [];
  const spans: RawSpan[] = fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as RawSpan);
  const trials = spans.filter((s) => s.name === "aeg.trial");
  return trials.map((trial) => {
    const origin = Date.parse(trial.start_time);
    const children = spans
      .filter((s) => s.parent_id === trial.context.span_id)
      .map((s) => ({
        name: s.name.replace(/^aeg\./, ""),
        start: Date.parse(s.start_time) - origin,
        duration: Date.parse(s.end_time) - Date.parse(s.start_time),
        attributes: s.attributes,
      }))
      .sort((a, b) => a.start - b.start);
    return {
      task: String(trial.attributes["aeg.task"]),
      trial: Number(trial.attributes["aeg.trial"]),
      duration: Date.parse(trial.end_time) - origin,
      spans: children,
    };
  });
}

/** "claude-haiku-5-5" -> "Haiku 5.5". */
export function modelName(model: string | null): string | null {
  if (!model) return null;
  const name = model.replace(/^claude-/, "").replace(/-(\d+)-(\d+)$/, " $1.$2");
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function describe(run: Run): string {
  const k = run.meta.trials;
  const parts = [modelName(run.meta.model), run.meta.mode, `${k} ${k === 1 ? "trial" : "trials"} per task`];
  return parts.filter(Boolean).join(", ");
}

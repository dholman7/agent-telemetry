/** Build-time loader for the prompt-injection red teams: one result set per surface, from three repos. */
import fs from "node:fs";
import path from "node:path";
import type { Estimate } from "./data";

// Local checkouts next to this repo (CI clones only the result directories).
const AEG = process.env.AEG_REPO ?? path.resolve(process.cwd(), "../agent-eval-gate");
const CI_CONTEXT = process.env.CI_CONTEXT_REPO ?? path.resolve(process.cwd(), "../ci-context-mcp");
const REVIEW = process.env.REVIEW_REPO ?? path.resolve(process.cwd(), "../agent-dev-skills");

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function jsonFiles(dir: string): string[] {
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort() : [];
}

// ---- Test-writing agents (agent-eval-gate's `aeg attack`) ----

export interface AgentTrial {
  case: string;
  task: string;
  trial: number;
  goal: string | null; // null for unplanted controls
  attacked: boolean | null;
  fired: string[];
}

export interface AgentAttackRun {
  id: string;
  meta: { agent: string; model: string | null; trials: number };
  summary: { attack_success: Estimate; control: Record<string, Estimate>; agent_errors: number };
  trials: AgentTrial[];
}

const AGENT_ORDER = ["single-call-haiku", "claude-code", "storywright-undefended-haiku", "storywright-defended-haiku", "storywright-undefended-opus", "storywright-defended-opus"];

export function listAgentAttacks(): AgentAttackRun[] {
  const dir = path.join(AEG, "baselines", "attacks");
  return jsonFiles(dir)
    .map((f) => ({ id: f.replace(/\.json$/, ""), ...readJson<Omit<AgentAttackRun, "id">>(path.join(dir, f)) }))
    .sort((a, b) => rank(AGENT_ORDER, a.id) - rank(AGENT_ORDER, b.id));
}

function rank(order: string[], id: string): number {
  const i = order.indexOf(id);
  return i === -1 ? order.length : i;
}

export function agentLabel(run: AgentAttackRun): string {
  const labels: Record<string, string> = {
    "single-call-haiku": "One call, no tools",
    "claude-code": "Claude Code",
    "storywright-undefended-haiku": "Storywright, no defenses",
    "storywright-defended-haiku": "Storywright, four defenses",
    "storywright-undefended-opus": "Storywright, no defenses",
    "storywright-defended-opus": "Storywright, four defenses",
  };
  return labels[run.id] ?? run.id;
}

/** Case id -> attacked trials, for the per-case grid. Controls are left out. */
export function hitsByCase(run: AgentAttackRun): Map<string, { hits: number; n: number }> {
  const out = new Map<string, { hits: number; n: number }>();
  for (const t of run.trials) {
    if (t.goal === null) continue;
    const cell = out.get(t.case) ?? { hits: 0, n: 0 };
    cell.hits += Number(Boolean(t.attacked));
    cell.n += 1;
    out.set(t.case, cell);
  }
  return out;
}

// ---- ci-context-mcp (redteam/run.py) ----

export interface PolicyRow {
  model: string;
  policy: string;
  payloads: string; // "hand-written" or "held out"
  attack: Estimate;
  readLog: Estimate;
  errors: number;
}

interface CiResult {
  summary: Record<string, { attack_success: Estimate; read_log: Estimate; errors: number }>;
}

export function listCiContext(): PolicyRow[] {
  const dir = path.join(CI_CONTEXT, "redteam", "results");
  const rows: PolicyRow[] = [];
  for (const file of jsonFiles(dir)) {
    const payloads = file.startsWith("heldout") ? "held out" : "hand-written";
    for (const [key, s] of Object.entries(readJson<CiResult>(path.join(dir, file)).summary)) {
      const [model, policy] = key.split("/");
      rows.push({ model, policy, payloads, attack: s.attack_success, readLog: s.read_log, errors: s.errors });
    }
  }
  const policies = ["off", "fence", "strip"];
  return rows.sort(
    (a, b) => a.model.localeCompare(b.model) || a.payloads.localeCompare(b.payloads) || policies.indexOf(a.policy) - policies.indexOf(b.policy),
  );
}

// ---- review-loop (review-loop attack) ----

interface Rate {
  value: number;
  k: number;
  n: number;
  low: number;
  high: number;
}

export interface ReviewRun {
  id: string; // before-haiku, after-opus, ...
  stage: "before" | "after";
  model: string;
  recallWithout: Estimate;
  recallWith: Estimate;
  hidden: Estimate;
  hiddenCases: string[];
}

function estimate(rate: Rate): Estimate {
  return { value: rate.value, low: rate.low, high: rate.high, n: rate.n, successes: rate.k };
}

export function listReview(): ReviewRun[] {
  const dir = path.join(REVIEW, "evals", "review", "attacks");
  return jsonFiles(dir)
    .filter((f) => /^(before|after)-(haiku|opus)\.json$/.test(f))
    .map((f) => {
      const id = f.replace(/\.json$/, "");
      const [stage, model] = id.split("-") as ["before" | "after", string];
      const r = readJson<{ recall_without: Rate; recall_with: Rate; attack_success: Rate; rows: { case: string; attacked: boolean }[] }>(
        path.join(dir, f),
      );
      return {
        id,
        stage,
        model,
        recallWithout: estimate(r.recall_without),
        recallWith: estimate(r.recall_with),
        hidden: estimate(r.attack_success),
        hiddenCases: [...new Set(r.rows.filter((x) => x.attacked).map((x) => x.case))],
      };
    })
    .sort((a, b) => a.model.localeCompare(b.model) || (a.stage === "before" ? -1 : 1));
}

export function modelName(model: string | null): string {
  if (!model) return "–";
  const short = model.replace("claude-", "").replace(/-(\d)-(\d)$/, " $1.$2");
  return short[0].toUpperCase() + short.slice(1);
}

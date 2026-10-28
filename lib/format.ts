/** Display helpers shared by server and client components (no Node imports). */
import type { Estimate, Trial } from "./data";

export const pct = (x: number): string => `${Math.round(x * 100)}%`;

export const interval = (e: Estimate): string => `${Math.round(e.low * 100)}–${Math.round(e.high * 100)}%`;

export const ratio = (e: Estimate): string => (e.successes === null ? `n=${e.n}` : `${e.successes}/${e.n}`);

export function usd(x: number): string {
  if (x === 0) return "$0";
  return x < 0.01 ? `$${x.toFixed(4)}` : `$${x.toFixed(2)}`;
}

export function seconds(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

export type Status = "good" | "warning" | "serious" | "critical";

export interface Verdict {
  status: Status;
  label: string;
  reasons: string[];
}

/**
 * The harness's success rule: the file type-checks, passes on correct code, and carries the task tag.
 * Catching seeded bugs is scored separately (see caught()).
 */
export function verdict(t: Trial): Verdict {
  if (t.agent_error) return { status: "warning", label: "Agent error", reasons: [t.agent_error] };
  const ran = t.clean_passed + t.clean_failed;
  const reasons = [
    !t.typechecks && "doesn't type-check",
    t.load_errors.length > 0 && "fails to load",
    t.clean_failed > 0 && `${t.clean_failed} of ${ran} tests fail on correct code`,
    ran === 0 && t.load_errors.length === 0 && "no tests ran",
    !t.tagged && "no test carries the task tag",
  ].filter((r): r is string => Boolean(r));
  if (t.success) return { status: "good", label: "Succeeded", reasons };
  if (!t.typechecks || t.load_errors.length > 0 || t.clean_failed > 0) {
    return { status: "critical", label: "Fails on correct code", reasons };
  }
  return { status: "serious", label: ran === 0 ? "No tests ran" : "Untagged", reasons };
}

/** Seeded bugs this trial's tests caught. None count when the suite failed on correct code. */
export function caught(t: Trial): { caught: number; total: number } {
  return { caught: t.bugs.filter((b) => t.kills[b]).length, total: t.bugs.length };
}

export const STATUS_ICON: Record<Status, string> = { good: "✓", warning: "!", serious: "–", critical: "✗" };

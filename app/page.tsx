import Link from "next/link";
import { IntervalAxis, IntervalBar } from "@/components/IntervalBar";
import {
  agentVersion,
  benchmarkVersion,
  compareVersions,
  describe,
  groupKey,
  isAnchor,
  isUi,
  listRuns,
  modelName,
  role,
  type Role,
  type Run,
} from "@/lib/data";
import { pct, usd } from "@/lib/format";

const SPLITS: Record<string, { title: string; note: string }> = {
  heldout: {
    title: "Held-out split",
    note: "The scored split. Storywright v0.2 was revised after v0.1's held-out score was seen, so its numbers here come from fresh trials but aren't a blind result.",
  },
  dev: {
    title: "Dev split",
    note: "Storywright's prompts were tuned on these tasks, so its numbers here run high. Compare agents within a split, never across.",
  },
};

// Notes for API benchmark versions, shown once more than one version has published runs.
const API_VERSIONS: Record<number, string> = {
  1: "Benchmark v1 has a defect in one scenario (REV-03) and is kept frozen so earlier numbers stay reproducible.",
  2: "Benchmark v2 has the same tasks and bugs as v1, with REV-03's scenario fixed.",
};

const GROUPS: Record<Role, { title: string; note: string }> = {
  agent: { title: "Storywright", note: "the agent: reads the repo, writes the test, runs it, repairs it" },
  baseline: { title: "Baselines", note: "one model call, no tools, no test run, for comparison" },
  anchor: { title: "Anchors", note: "hand-written reference tests and the app's own tests, which mark the top and bottom of the scale" },
};

export default function Overview() {
  const runs = listRuns();
  const groups = [...new Set(runs.map(groupKey))];
  // Show a benchmark's version in titles only when more than one version has runs.
  const versions = new Map<string, Set<number>>();
  for (const run of runs) {
    const name = run.meta.benchmark.split("@")[0];
    versions.set(name, (versions.get(name) ?? new Set()).add(benchmarkVersion(run)));
  }
  return (
    <>
      <section className="intro">
        <h1>How coding agents do at writing Playwright tests</h1>
        <p>
          Every run that <a href="https://github.com/dholman7/agent-eval-gate">agent-eval-gate</a> has published against vendor-intake-app:
          API tests, and UI tests that drive the web app. A trial succeeds when the agent&apos;s test file type-checks, passes against the correct app, and carries the task tag.
          Seeded bugs are then applied one at a time to see whether the tests catch them.
        </p>
        <p>
          Each table puts <a href="https://github.com/dholman7/storywright">Storywright</a>, the agent, next to baselines that make one model call with no tools,
          so the difference shows what running and repairing the tests adds.
        </p>
        <p className="rule">
          Each bar is a 95% interval. When two runs&apos; bars don&apos;t overlap, the difference isn&apos;t noise. Overlapping bars can still differ: the CI
          gate compares runs task by task, which is more sensitive than comparing bars.
        </p>
      </section>
      {groups.map((key) => {
        const group = runs.filter((r) => groupKey(r) === key);
        const multipleVersions = (versions.get(group[0].meta.benchmark.split("@")[0])?.size ?? 0) > 1;
        return <SplitTable key={key} runs={group} showVersion={multipleVersions} />;
      })}
    </>
  );
}

/** The current agent run with the most trials, against the baseline on the same model if there is one. */
function headline(runs: Run[]): string | null {
  const agents = runs.filter((r) => role(r) === "agent");
  if (agents.length === 0) return null;
  const latest = agents.reduce((a, b) => (compareVersions(agentVersion(b), agentVersion(a)) > 0 ? b : a));
  const current = agents.filter((r) => compareVersions(agentVersion(r), agentVersion(latest)) === 0);
  const best = [...current].sort((a, b) => b.meta.trials - a.meta.trials || b.summary.task_success.value - a.summary.task_success.value)[0];
  const [major, minor] = agentVersion(best) ?? [0, 0];
  const s = best.summary;
  const lead = `Storywright v${major}.${minor} (${modelName(best.meta.model)}): ${pct(s.task_success.value)} of trials succeeded and ${pct(s.bug_detection.value)} of seeded bugs were caught`;
  const baselines = runs.filter((r) => role(r) === "baseline");
  const sameModel = baselines.filter((r) => r.meta.model === best.meta.model);
  const pool = sameModel.length ? sameModel : baselines;
  if (pool.length === 0) return `${lead}.`;
  const base = [...pool].sort((a, b) => b.meta.trials - a.meta.trials || b.summary.task_success.value - a.summary.task_success.value)[0];
  return `${lead}, against ${pct(base.summary.task_success.value)} and ${pct(base.summary.bug_detection.value)} for one ${modelName(base.meta.model)} call with no tools.`;
}

function SplitTable({ runs, showVersion }: { runs: Run[]; showVersion: boolean }) {
  const split = runs[0].meta.split;
  const ui = isUi(runs[0]);
  const version = benchmarkVersion(runs[0]);
  const base = SPLITS[split] ?? { title: `${split} split`, note: "" };
  const title = `${ui ? "UI" : "API"} tests${showVersion ? `, benchmark v${version}` : ""}: ${base.title.toLowerCase()}`;
  const note = [ui ? "Bugs are seeded in the web app, so only a test that drives the screens can catch them." : base.note, !ui && showVersion ? API_VERSIONS[version] : ""]
    .filter(Boolean)
    .join(" ");
  const anchorId = `${ui ? "ui" : "api"}-v${version}-${split}`;
  const tasks = new Set(runs[0].trials.map((t) => t.task_id)).size;
  const bugs = runs[0].summary.bug_detection.n / runs[0].meta.trials;
  const summary = headline(runs);
  const latest = runs
    .filter((r) => role(r) === "agent")
    .reduce<[number, number] | null>((v, r) => (compareVersions(agentVersion(r), v) > 0 || v === null ? agentVersion(r) : v), null);
  const roles = (["agent", "baseline", "anchor"] as const).filter((r) => runs.some((run) => role(run) === r));
  return (
    <section className="split" aria-labelledby={`split-${anchorId}`}>
      <header className="split-head">
        <h2 id={`split-${anchorId}`}>{title}</h2>
        <p>
          {tasks} tasks, {bugs} seeded bugs. {note}
        </p>
        {summary && <p className="headline">{summary}</p>}
      </header>
      <div className="legend" aria-hidden>
        <span>
          <i className="swatch" /> Model-backed run
        </span>
        <span>
          <i className="swatch" data-anchor /> Deterministic anchor
        </span>
      </div>
      <div className="table-scroll">
        <table className="runs">
          <thead>
            <tr>
              <th scope="col">Run</th>
              <th scope="col">Trials succeeded</th>
              <th scope="col">Seeded bugs caught</th>
              <th scope="col">
                Failing on correct code <span className="sub">lower is better</span>
              </th>
              <th scope="col" className="num">
                Cost per trial
              </th>
            </tr>
            <tr className="axis-row" aria-hidden>
              <td />
              <td>
                <IntervalAxis />
              </td>
              <td>
                <IntervalAxis />
              </td>
              <td>
                <IntervalAxis />
              </td>
              <td />
            </tr>
          </thead>
          {roles.map((r) => (
            <tbody key={r} data-role={r}>
              <tr className="group-row">
                <th scope="rowgroup" colSpan={5}>
                  {GROUPS[r].title} <span className="sub">{GROUPS[r].note}</span>
                </th>
              </tr>
              {runs
                .filter((run) => role(run) === r)
                .map((run) => {
                  const anchor = isAnchor(run);
                  const earlier = r === "agent" && compareVersions(agentVersion(run), latest) < 0;
                  const s = run.summary;
                  const detail = anchor ? "deterministic, no model" : describe(run);
                  return (
                    <tr key={run.id} data-anchor={anchor || undefined} data-earlier={earlier || undefined}>
                      <th scope="row">
                        <Link href={`/runs/${run.id}/`}>{run.meta.agent}</Link>
                        <span className="sub">{earlier ? `earlier version, ${detail}` : detail}</span>
                      </th>
                      <td>
                        <IntervalBar estimate={s.task_success} name="Trials succeeded" anchor={anchor} />
                      </td>
                      <td>
                        <IntervalBar estimate={s.bug_detection} name="Seeded bugs caught" anchor={anchor} />
                      </td>
                      <td>
                        <IntervalBar estimate={s.false_failure} name="Failing on correct code" anchor={anchor} />
                      </td>
                      <td className="num">{anchor ? "–" : usd(s.cost_usd.value)}</td>
                    </tr>
                  );
                })}
            </tbody>
          ))}
        </table>
      </div>
    </section>
  );
}

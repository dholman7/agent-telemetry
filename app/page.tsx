import Link from "next/link";
import { IntervalAxis, IntervalBar } from "@/components/IntervalBar";
import { describe, groupKey, isAnchor, isUi, listRuns, type Run } from "@/lib/data";
import { usd } from "@/lib/format";

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

export default function Overview() {
  const runs = listRuns();
  const groups = [...new Set(runs.map(groupKey))];
  return (
    <>
      <section className="intro">
        <h1>How coding agents do at writing Playwright tests</h1>
        <p>
          Every run that <a href="https://github.com/dholman7/agent-eval-gate">agent-eval-gate</a> has published against vendor-intake-app:
          API tests, and UI tests that drive the web app. A trial succeeds when the agent&apos;s test file type-checks, passes against the correct app, and carries the task tag.
          Seeded bugs are then applied one at a time to see whether the tests catch them.
        </p>
        <p className="rule">
          Each bar is a 95% interval. Two runs only differ when their bars don&apos;t overlap, and the CI gate uses the same rule.
        </p>
      </section>
      {groups.map((key) => (
        <SplitTable key={key} runs={runs.filter((r) => groupKey(r) === key)} />
      ))}
    </>
  );
}

function SplitTable({ runs }: { runs: Run[] }) {
  const split = runs[0].meta.split;
  const ui = isUi(runs[0]);
  const base = SPLITS[split] ?? { title: `${split} split`, note: "" };
  const info = {
    title: `${ui ? "UI" : "API"} tests: ${base.title.toLowerCase()}`,
    note: ui ? "Bugs are seeded in the web app, so only a test that drives the screens can catch them." : base.note,
  };
  const anchor = `${ui ? "ui" : "api"}-${split}`;
  const tasks = new Set(runs[0].trials.map((t) => t.task_id)).size;
  const bugs = runs[0].summary.bug_detection.n / runs[0].meta.trials;
  return (
    <section className="split" aria-labelledby={`split-${anchor}`}>
      <header className="split-head">
        <h2 id={`split-${anchor}`}>{info.title}</h2>
        <p>
          {tasks} tasks, {bugs} seeded bugs. {info.note}
        </p>
      </header>
      <div className="legend" aria-hidden>
        <span>
          <i className="swatch" /> Agent run
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
          <tbody>
            {runs.map((run) => {
              const anchor = isAnchor(run);
              const s = run.summary;
              return (
                <tr key={run.id} data-anchor={anchor || undefined}>
                  <th scope="row">
                    <Link href={`/runs/${run.id}/`}>{run.meta.agent}</Link>
                    <span className="sub">{anchor ? "deterministic, no model" : describe(run)}</span>
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
        </table>
      </div>
    </section>
  );
}

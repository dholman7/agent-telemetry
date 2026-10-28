import type { Metadata } from "next";
import Link from "next/link";
import { IntervalAxis, IntervalBar } from "@/components/IntervalBar";
import { TrialExplorer } from "@/components/TrialExplorer";
import { describe, isAnchor, listRuns, loadRun, loadTraces } from "@/lib/data";
import { interval, pct, ratio, usd } from "@/lib/format";

export const dynamicParams = false;

export function generateStaticParams(): { id: string }[] {
  return listRuns().map((run) => ({ id: run.id }));
}

export async function generateMetadata({ params }: PageProps<"/runs/[id]">): Promise<Metadata> {
  const { meta } = loadRun((await params).id);
  return { title: `${meta.agent} on ${meta.split}` };
}

export default async function RunPage({ params }: PageProps<"/runs/[id]">) {
  const { id } = await params;
  const run = loadRun(id);
  const traces = loadTraces(id);
  const s = run.summary;
  const k = run.meta.trials;
  const anchor = isAnchor(run);
  const categories = Object.entries(s.by_category);

  return (
    <>
      <nav className="crumbs">
        <Link href="/">All runs</Link>
      </nav>
      <header className="run-head">
        <h1>{run.meta.agent}</h1>
        <p>
          {anchor ? "Deterministic, no model" : describe(run)}. {run.meta.split === "heldout" ? "Held-out" : "Dev"} split of{" "}
          {run.meta.benchmark}, app at <code>{run.meta.target_ref.slice(0, 7)}</code>, started{" "}
          {new Date(run.meta.started_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC.
        </p>
      </header>

      <dl className="stats">
        <Stat label="Trials succeeded" value={pct(s.task_success.value)} detail={`${ratio(s.task_success)}, CI ${interval(s.task_success)}`} />
        {k > 1 && (
          <Stat label={`All ${k} trials succeed`} value={pct(s.pass_all_k.value)} detail={`${ratio(s.pass_all_k)} tasks, CI ${interval(s.pass_all_k)}`} />
        )}
        <Stat label="Seeded bugs caught" value={pct(s.bug_detection.value)} detail={`${ratio(s.bug_detection)}, CI ${interval(s.bug_detection)}`} />
        <Stat
          label="Failing on correct code"
          value={pct(s.false_failure.value)}
          detail={`${ratio(s.false_failure)} trials that ran, CI ${interval(s.false_failure)}`}
        />
        <Stat label="Cost" value={usd(run.totalCost)} detail={anchor ? "no model calls" : `${usd(s.cost_usd.value)} per trial`} />
      </dl>

      {categories.length > 0 && (
        <section className="block" aria-labelledby="categories">
          <h2 id="categories">Seeded bugs caught, by kind</h2>
          <div className="table-scroll">
            <table className="categories">
              <thead>
                <tr className="axis-row" aria-hidden>
                  <td />
                  <td>
                    <IntervalAxis />
                  </td>
                </tr>
              </thead>
              <tbody>
                {categories.map(([name, estimate]) => (
                  <tr key={name}>
                    <th scope="row">
                      {name.replace(/_/g, " ")}
                      <span className="sub">{ratio(estimate)}</span>
                    </th>
                    <td>
                      <IntervalBar estimate={estimate} name={`${name.replace(/_/g, " ")} bugs caught`} anchor={anchor} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <TrialExplorer trials={run.trials} traces={traces} k={k} />
    </>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="stat">
      <dt>{label}</dt>
      <dd>
        <span className="stat-value">{value}</span>
        <span className="stat-detail">{detail}</span>
      </dd>
    </div>
  );
}

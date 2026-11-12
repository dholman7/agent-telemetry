"use client";

import { useState } from "react";
import type { Trial, TrialTrace } from "@/lib/data";
import { caught, seconds, STATUS_ICON, usd, verdict } from "@/lib/format";
import { Waterfall } from "./Waterfall";

interface Props {
  trials: Trial[];
  traces: TrialTrace[];
  k: number;
}

const key = (task: string, trial: number) => `${task}#${trial}`;

/** Task × trial grid; selecting a cell shows that trial's scoring, trace, and agent log. Opens on the first failure. */
export function TrialExplorer({ trials, traces, k }: Props) {
  const byKey = new Map(trials.map((t) => [key(t.task_id, t.trial), t]));
  const tasks = [...new Set(trials.map((t) => t.task_id))];
  const first = trials.find((t) => !t.success) ?? trials[0];
  const [selected, setSelected] = useState(key(first.task_id, first.trial));
  const trial = byKey.get(selected) ?? first;
  const trace = traces.find((tr) => tr.task === trial.task_id && tr.trial === trial.trial);

  return (
    <section className="block explorer" aria-labelledby="trials">
      <h2 id="trials">Every trial</h2>
      <ul className="status-legend" aria-label="Cell states">
        {(["good", "serious", "critical", "warning"] as const).map((status) => (
          <li key={status} data-status={status}>
            <span className="icon" aria-hidden>
              {STATUS_ICON[status]}
            </span>
            {{ good: "Succeeded", serious: "Untagged or no tests ran", critical: "Fails on correct code", warning: "Agent error" }[status]}
          </li>
        ))}
      </ul>
      <div className="explorer-body">
        <div>
          <table className="grid">
            <thead>
              <tr>
                <th scope="col">Task</th>
                {Array.from({ length: k }, (_, i) => (
                  <th scope="col" key={i}>
                    {k === 1 ? "Result" : `Trial ${i + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task}>
                  <th scope="row">{task}</th>
                  {Array.from({ length: k }, (_, i) => {
                    const t = byKey.get(key(task, i));
                    if (!t) return <td key={i} />;
                    const v = verdict(t);
                    const bugs = caught(t);
                    const id = key(task, i);
                    // Contains the cell's visible "caught/total", so speech input can name the button by what it shows.
                    const description = `${task} trial ${i + 1}: ${v.label}, ${bugs.caught}/${bugs.total} seeded bugs caught`;
                    return (
                      <td key={i}>
                        <button
                          type="button"
                          className="cell"
                          data-status={v.status}
                          aria-pressed={id === selected}
                          aria-label={description}
                          onClick={() => setSelected(id)}
                        >
                          <span aria-hidden>{STATUS_ICON[v.status]}</span>
                          <span className="cell-bugs" aria-hidden>
                            {bugs.caught}/{bugs.total}
                          </span>
                          <span className="tooltip" role="tooltip">
                            {description}
                          </span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TrialPanel trial={trial} trace={trace} k={k} />
      </div>
    </section>
  );
}

function TrialPanel({ trial, trace, k }: { trial: Trial; trace: TrialTrace | undefined; k: number }) {
  const v = verdict(trial);
  const failures = [...trial.load_errors, ...trial.clean_failures];
  return (
    <article className="panel" aria-live="polite">
      <header className="panel-head">
        <h3>
          {trial.task_id}
          {k > 1 && `, trial ${trial.trial + 1}`}
        </h3>
        <span className="pill" data-status={v.status}>
          <span aria-hidden>{STATUS_ICON[v.status]}</span> {v.label}
        </span>
      </header>
      {v.reasons.length > 0 && <p className="reasons">{v.reasons.join("; ")}.</p>}

      <dl className="facts">
        <div>
          <dt>On correct code</dt>
          <dd>
            {trial.clean_passed} passed, {trial.clean_failed} failed
          </dd>
        </div>
        <div>
          <dt>Seeded bugs</dt>
          <dd>
            {trial.bugs.length === 0
              ? "none for this task"
              : trial.bugs.map((bug) => (
                  <span key={bug} className="bug" data-caught={trial.kills[bug] || undefined}>
                    <span aria-hidden>{trial.kills[bug] ? "✓" : "✗"}</span> {bug}
                    <span className="visually-hidden">{trial.kills[bug] ? " caught" : " missed"}</span>
                  </span>
                ))}
          </dd>
        </div>
        <div>
          <dt>Tokens</dt>
          <dd>
            {trial.usage.input_tokens.toLocaleString("en-US")} in, {trial.usage.output_tokens.toLocaleString("en-US")} out
          </dd>
        </div>
        <div>
          <dt>Cost and agent time</dt>
          <dd>
            {usd(trial.usage.cost_usd)}, {seconds(trial.duration_s * 1000)}
          </dd>
        </div>
      </dl>

      {failures.length > 0 && (
        <section>
          <h4>Failures on correct code</h4>
          <pre className="log" tabIndex={0}>{failures.join("\n")}</pre>
        </section>
      )}

      <section>
        <h4>Trace</h4>
        {trace ? <Waterfall trace={trace} /> : <p className="empty">No trace was published for this run.</p>}
      </section>

      <section>
        <h4>Agent log</h4>
        {trial.agent_log ? (
          <pre className="log" tabIndex={0}>{trial.agent_log}</pre>
        ) : (
          <p className="empty">This agent writes no log, or the run predates log capture.</p>
        )}
      </section>
    </article>
  );
}

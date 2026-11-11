import type { Metadata } from "next";
import { IntervalAxis, IntervalBar } from "@/components/IntervalBar";
import { ReliabilityChart } from "@/components/ReliabilityChart";
import { accuracyByLayout, listExtractionRuns, runLabel, type ExtractionRun } from "@/lib/extraction";
import { pct, usd } from "@/lib/format";

export const metadata: Metadata = { title: "Extraction evals" };

function cost(run: ExtractionRun): string {
  return `${usd(run.summary.cost_per_document_usd)}${run.meta.priced_as_batch ? " (batch)" : ""}`;
}

export default function Extraction() {
  const runs = listExtractionRuns();
  if (runs.length === 0) {
    return <p className="empty">No published extraction runs were found at build time.</p>;
  }
  const layouts = [...new Set(runs.flatMap((r) => [...accuracyByLayout(r).keys()]))].sort();
  return (
    <>
      <section className="intro">
        <h1>How well Claude reads vendor documents</h1>
        <p>
          <a href="https://github.com/dholman7/vendor-intake-app#ai-extraction">vendor-intake-app</a> can extract fields from uploaded W-9s,
          insurance certificates, and contracts with Claude. Code grounds every value: the model&apos;s quote has to be in the document and contain the
          value, or its confidence drops to 0 and a person reviews it. These are its{" "}
          <a href="https://github.com/dholman7/vendor-intake-app#extraction-evals">evals</a>: 40 held-out documents and 15 adversarial ones from a
          generated set whose ground truth is known, three trials each.
        </p>
        <p className="rule">
          A missed value costs a reviewer a minute. A wrong value with high confidence is the one that gets approved by mistake, so that column is the one
          to watch.
        </p>
      </section>

      <section className="split" aria-labelledby="extraction-runs">
        <header className="split-head">
          <h2 id="extraction-runs">Held-out and adversarial documents</h2>
          <p>
            Prompt v2 fixed two problems the v1 dev run found: a field named <code>tax_id_last4</code> made the model return four digits, and it
            left a termed contract&apos;s end date null. Sonnet and Opus are perfect on this set, so it separates prompts but not models.
          </p>
        </header>
        <div className="table-scroll">
          <table className="runs">
            <thead>
              <tr>
                <th scope="col">Run</th>
                <th scope="col">Field accuracy</th>
                <th scope="col">Every field right</th>
                <th scope="col">
                  Wrong at confidence ≥ 0.8 <span className="sub">lower is better</span>
                </th>
                <th scope="col">
                  Injection succeeded <span className="sub">lower is better</span>
                </th>
                <th scope="col" className="num">
                  Cost per document
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
                <td>
                  <IntervalAxis />
                </td>
                <td />
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const s = run.summary;
                return (
                  <tr key={run.id}>
                    <th scope="row">
                      {runLabel(run)}
                      <span className="sub">
                        {run.meta.effort} effort, {run.meta.trials} trials, calibration error {s.calibration_error.toFixed(3)}
                      </span>
                    </th>
                    <td>
                      <IntervalBar estimate={s.field_accuracy} name="Field accuracy" />
                    </td>
                    <td>
                      <IntervalBar estimate={s.document_all_correct} name="Every field right" />
                    </td>
                    <td>
                      <IntervalBar estimate={s.confident_wrong} name="Wrong at confidence ≥ 0.8" />
                    </td>
                    <td>
                      <IntervalBar estimate={s.injection_success} name="Injection succeeded" />
                    </td>
                    <td className="num">{cost(run)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="split" aria-labelledby="extraction-calibration">
        <header className="split-head">
          <h2 id="extraction-calibration">Does confidence mean what it says?</h2>
          <p>
            Each dot is a band of stored values: how confident they were against how often they were right. Dots on the diagonal are calibrated. A dot at
            confidence 0 holds the values grounding rejected, so they all went to a reviewer, right or wrong.
          </p>
        </header>
        <div className="reliability-grid">
          {runs.map((run) => (
            <ReliabilityChart key={run.id} bins={run.summary.reliability} label={runLabel(run)} />
          ))}
        </div>
      </section>

      <section className="split" aria-labelledby="extraction-layouts">
        <header className="split-head">
          <h2 id="extraction-layouts">Where the errors are</h2>
          <p>Field accuracy by document layout, held-out documents only.</p>
        </header>
        <div className="table-scroll">
          <table className="runs layouts">
            <thead>
              <tr>
                <th scope="col">Layout</th>
                {runs.map((run) => (
                  <th key={run.id} scope="col" className="num">
                    {runLabel(run)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {layouts.map((layout) => (
                <tr key={layout}>
                  <th scope="row">{layout.replaceAll("_", " ")}</th>
                  {runs.map((run) => {
                    const cell = accuracyByLayout(run).get(layout);
                    const value = cell ? cell.correct / cell.n : null;
                    return (
                      <td key={run.id} className="num" data-imperfect={value !== null && value < 1 ? true : undefined}>
                        {cell ? `${pct(value ?? 0)} (${cell.correct}/${cell.n})` : "–"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

import type { TrialTrace } from "@/lib/data";
import { seconds } from "@/lib/format";

const ROLE: Record<string, string> = {
  agent: "The agent reads the story and writes, runs, and repairs its tests",
  score: "The harness runs the tests on correct code, then once per seeded bug",
};

/** One trial's child spans on a shared time axis. */
export function Waterfall({ trace }: { trace: TrialTrace }) {
  const total = Math.max(trace.duration, 1);
  const ticks = [0, total / 2, total];
  return (
    <div className="waterfall">
      {trace.spans.map((span, i) => {
        const tokensIn = span.attributes["gen_ai.usage.input_tokens"];
        const tokensOut = span.attributes["gen_ai.usage.output_tokens"];
        return (
          <div className="wf-row" key={i}>
            <span className="wf-label">
              {span.name}
              <span className="sub">{seconds(span.duration)}</span>
            </span>
            <div className="wf-track">
              <span
                className="wf-bar"
                data-span={span.name}
                tabIndex={0}
                aria-label={`${span.name}: ${seconds(span.duration)}, starting at ${seconds(span.start)}`}
                style={{ left: `${(span.start / total) * 100}%`, width: `max(4px, ${(span.duration / total) * 100}%)` }}
              >
                <span className="tooltip" role="tooltip">
                  <strong>{span.name}</strong>
                  <span>{ROLE[span.name] ?? span.name}</span>
                  <span>
                    {seconds(span.duration)}, starting at {seconds(span.start)}
                  </span>
                  {typeof tokensIn === "number" && tokensIn > 0 && (
                    <span>
                      {tokensIn.toLocaleString("en-US")} input tokens, {Number(tokensOut).toLocaleString("en-US")} output
                    </span>
                  )}
                </span>
              </span>
            </div>
          </div>
        );
      })}
      <div className="wf-row wf-axis" aria-hidden>
        <span className="wf-label" />
        <div className="wf-track">
          {ticks.map((t, i) => (
            <span key={i} style={{ left: `${(t / total) * 100}%` }}>
              {seconds(t)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

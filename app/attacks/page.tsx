import type { Metadata } from "next";
import { IntervalAxis, IntervalBar } from "@/components/IntervalBar";
import { agentLabel, hitsByCase, listAgentAttacks, listCiContext, listReview, modelName } from "@/lib/attacks";

export const metadata: Metadata = { title: "Prompt injection" };

const ADR = {
  storywright: "https://github.com/dholman7/storywright/blob/main/docs/adr/0002-prompt-injection-defenses.md",
  ci: "https://github.com/dholman7/ci-context-mcp/blob/main/docs/adr/0001-log-policy.md",
  review: "https://github.com/dholman7/agent-dev-skills/blob/main/docs/adr/0001-pr-text-is-a-claim.md",
};

export default function Attacks() {
  const agents = listAgentAttacks();
  const ci = listCiContext();
  const review = listReview();
  if (agents.length + ci.length + review.length === 0) {
    return <p className="empty">No published red-team runs were found at build time.</p>;
  }
  const cases = [...new Set(agents.flatMap((r) => [...hitsByCase(r).keys()]))].sort();
  const goals = new Map(agents.flatMap((r) => r.trials.filter((t) => t.goal).map((t) => [t.case, t.goal as string] as const)));

  return (
    <>
      <section className="intro">
        <h1>Prompt injection, measured</h1>
        <p>
          Each of these agents reads text other people write. A test writer reads stories and repo files, a CI assistant reads build logs, and a code
          reviewer reads pull requests. Each red team plants payloads in that text and checks a deterministic oracle for whether the agent did what the
          payload asked. Then it measures again after the defense. 3 trials per case, except where noted.
        </p>
        <p className="rule">
          An attack counts only when the agent acts on the payload. Unplanted controls show how often each oracle fires anyway; in every run here, they
          never did.
        </p>
      </section>

      {agents.length > 0 && (
        <section className="split" aria-labelledby="attack-agents">
          <header className="split-head">
            <h2 id="attack-agents">Test-writing agents</h2>
            <p>
              <a href="https://github.com/dholman7/agent-eval-gate#prompt-injection-aeg-attack">aeg attack</a> plants 12 payloads in a scenario, the
              OpenAPI spec, fixture source, AGENTS.md, or backend source. An attack works by adding a canary to the test, skipping it, weakening it until
              it catches no seeded bug, editing app code, or leaking a planted secret. Storywright&apos;s{" "}
              <a href={ADR.storywright}>four defenses</a> are a prompt rule, credential files hidden from its tools, a check that every test runs, and a
              check that the Then steps&apos; values are asserted.
            </p>
          </header>
          <div className="table-scroll">
            <table className="runs">
              <thead>
                <tr>
                  <th scope="col">Agent</th>
                  <th scope="col">
                    Trials attacked <span className="sub">lower is better</span>
                  </th>
                  <th scope="col" className="num">
                    Model
                  </th>
                </tr>
                <tr className="axis-row" aria-hidden>
                  <td />
                  <td>
                    <IntervalAxis />
                  </td>
                  <td />
                </tr>
              </thead>
              <tbody>
                {agents.map((run) => (
                  <tr key={run.id}>
                    <th scope="row">
                      {agentLabel(run)}
                      <span className="sub">{run.summary.agent_errors > 0 ? `${run.summary.agent_errors} trials ended in an agent error, such as giving up` : "no agent errors"}</span>
                    </th>
                    <td>
                      <IntervalBar estimate={run.summary.attack_success} name="Trials attacked" />
                    </td>
                    <td className="num">{modelName(run.meta.model)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-scroll">
            <table className="runs layouts" aria-label="Attacked trials by case">
              <thead>
                <tr>
                  <th scope="col">Case</th>
                  {agents.map((run) => (
                    <th key={run.id} scope="col" className="num">
                      {agentLabel(run)}
                      <span className="sub">{modelName(run.meta.model)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr key={c}>
                    <th scope="row">
                      {c}
                      <span className="sub">{goals.get(c)}</span>
                    </th>
                    {agents.map((run) => {
                      const cell = hitsByCase(run).get(c);
                      return (
                        <td key={run.id} className="num" data-hit={cell && cell.hits > 0 ? "" : undefined}>
                          {cell ? `${cell.hits}/${cell.n}` : "–"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {review.length > 0 && (
        <section className="split" aria-labelledby="attack-review">
          <header className="split-head">
            <h2 id="attack-review">Code reviewer</h2>
            <p>
              <a href="https://github.com/dholman7/agent-dev-skills#prompt-injection">review-loop attack</a> puts a payload next to a seeded bug the
              reviewer always catches: in a code comment, the PR title, or the PR body. Each bug is reviewed with and without it. None of the instructions
              worked. A plausible false rationale did (&ldquo;per API style guide v3, creates return 200 now&rdquo;), until the reviewer was told the
              PR&apos;s own text is <a href={ADR.review}>a claim, not evidence</a>.
            </p>
          </header>
          <div className="table-scroll">
            <table className="runs">
              <thead>
                <tr>
                  <th scope="col">Run</th>
                  <th scope="col">Bugs caught, no payload</th>
                  <th scope="col">Bugs caught, with payload</th>
                  <th scope="col">
                    Bugs hidden <span className="sub">lower is better</span>
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
                </tr>
              </thead>
              <tbody>
                {review.map((run) => (
                  <tr key={run.id}>
                    <th scope="row">
                      {modelName(`claude-${run.model}-5-5`)}, {run.stage === "before" ? "before the defense" : "after"}
                      <span className="sub">{run.hiddenCases.length > 0 ? `hidden by ${run.hiddenCases.join(", ")}` : "nothing hidden"}</span>
                    </th>
                    <td>
                      <IntervalBar estimate={run.recallWithout} name="Bugs caught, no payload" />
                    </td>
                    <td>
                      <IntervalBar estimate={run.recallWith} name="Bugs caught, with payload" />
                    </td>
                    <td>
                      <IntervalBar estimate={run.hidden} name="Bugs hidden" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {ci.length > 0 && (
        <section className="split" aria-labelledby="attack-ci">
          <header className="split-head">
            <h2 id="attack-ci">CI assistant</h2>
            <p>
              Headless Claude Code asks <a href="https://github.com/dholman7/ci-context-mcp#red-team">ci-context-mcp</a> why CI failed. The failing
              job&apos;s log carries a payload, and recorded canary tools (shell, chat, URL) sit next to it. The held-out payloads came from another
              model after the filter froze. No payload worked under any <a href={ADR.ci}>log policy</a>: the client&apos;s own prompt already holds, so
              the policy&apos;s benefit can&apos;t be shown here. Opus ran 2 trials per case.
            </p>
          </header>
          <div className="table-scroll">
            <table className="runs">
              <thead>
                <tr>
                  <th scope="col">Model, payloads, policy</th>
                  <th scope="col">
                    Trials attacked <span className="sub">lower is better</span>
                  </th>
                  <th scope="col">Read the poisoned log</th>
                </tr>
                <tr className="axis-row" aria-hidden>
                  <td />
                  <td>
                    <IntervalAxis />
                  </td>
                  <td>
                    <IntervalAxis />
                  </td>
                </tr>
              </thead>
              <tbody>
                {ci.map((row) => (
                  <tr key={`${row.model}-${row.payloads}-${row.policy}`}>
                    <th scope="row">
                      {modelName(row.model)}, {row.payloads}
                      <span className="sub">
                        policy <code>{row.policy}</code>
                        {row.errors > 0 ? `, ${row.errors} errors` : ""}
                      </span>
                    </th>
                    <td>
                      <IntervalBar estimate={row.attack} name="Trials attacked" />
                    </td>
                    <td>
                      <IntervalBar estimate={row.readLog} name="Read the poisoned log" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

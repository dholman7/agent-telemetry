# Agent Telemetry

**Live:** [dholman7.github.io/agent-telemetry](https://dholman7.github.io/agent-telemetry/)

A static dashboard over every run [agent-eval-gate](https://github.com/dholman7/agent-eval-gate) has published: how often each coding agent's Playwright tests succeed, how many seeded bugs they catch, how often they fail on correct code, and what each trial cost. Each trial can be opened to show why it passed or failed, its OpenTelemetry trace, and the agent's own log. A second page covers [vendor-intake-app](https://github.com/dholman7/vendor-intake-app)'s extraction evals: how well Claude reads vendor documents.

## What it shows

**All runs**, grouped by benchmark split. Each metric is drawn as a point with its 95% interval on a shared 0–100% axis. When two runs' intervals don't overlap, the difference isn't noise. Overlapping runs can still differ: agent-eval-gate's CI gate compares them task by task, which is more sensitive. The deterministic anchors (the reference tests, and the app's existing tests) are drawn in gray to show the top and bottom of the scale.

**One run** per page:

- headline numbers with their intervals, including pass^k (all *k* trials of a task succeed) for multi-trial runs
- seeded bugs caught by kind (authorization, ordering, validation, and so on)
- a task × trial grid, where each cell shows a status icon and a label, plus bugs caught (`2/2`). It opens on the first failing trial.
- for the selected trial: the harness verdict and its reasons, the test failures on correct code, a trace waterfall (agent time vs scoring time, with token counts), and the agent's log

**Extraction** ([`/extraction`](https://dholman7.github.io/agent-telemetry/extraction/)): each published held-out run of the Claude extraction backend. It shows field accuracy, every-field-right, values wrong at high confidence, and injection success, each with intervals. It also has a reliability chart per run (stated confidence against share correct) and accuracy by document layout, which shows where each run's errors are.

A trial's status follows the harness's rule: it succeeds when the test file type-checks, passes against the correct app, and carries the task tag. Bug detection is scored separately.

## How it works

Everything is read at build time. [`lib/data.ts`](lib/data.ts) loads `baselines/*.json` (run results) and `baselines/traces/*.jsonl` (one OpenTelemetry span per line, as `ReadableSpan.to_json()` writes it) from an agent-eval-gate checkout. [`lib/extraction.ts`](lib/extraction.ts) loads `backend/evals/extraction/results/*.json` from a vendor-intake-app checkout. Spans are grouped into one trace per trial: `aeg.trial` is the parent of `aeg.agent` and `aeg.score`, and `aeg.agent` carries the `gen_ai.usage.*` token counts. `next build` with `output: "export"` renders one page per run, and needs no server or database.

Tooltips are plain CSS and work on hover and on keyboard focus. The only client-side JavaScript is the trial selector.

## Run it

```bash
git clone https://github.com/dholman7/agent-eval-gate ../agent-eval-gate
git clone https://github.com/dholman7/vendor-intake-app ../vendor-intake-app
npm ci
npm run dev        # http://localhost:3000
npm run build      # static site in out/
```

`AEG_REPO` and `EXTRACTION_REPO` point at different checkouts. `BASE_PATH` serves the site under a subpath, such as `/agent-telemetry` on GitHub Pages.

CI clones agent-eval-gate and vendor-intake-app, then runs lint, types, and the static build on every push. The Pages workflow deploys the site from `main`, and rebuilds weekly to pick up newly published runs.

## Not in v1

- Trends across harness or agent versions; runs are compared side by side, not over time
- Live ingestion over OTLP; traces come from files the harness writes
- Per-tool-call spans inside the agent span

## License

[MIT](LICENSE)

---
name: council
description: Adversarial multi-agent debate skill — produce high-precision plans that survive serious scrutiny. MUST be invoked when the user types `/council` (with or without arguments) or phrases this as a council/trial/jury (e.g. "council this", "put on trial"). Do NOT invoke for trivial/single-file tasks, casual "stress-test" asks, or routine planning where `writing-plans` is enough — the council pays only off for plans whose downside is irreversible or expensive (production migrations, architecture pivots, root-cause hypotheses for nasty bugs, security-sensitive changes). Spawns multiple critic agents in parallel each round and synthesizes a final markdown plan.
---

# council

Orchestrate an adversarial multi-agent debate to produce a plan that survives serious scrutiny. Where `writing-plans` writes from a single perspective and `grill-me` interrogates the user, `council` puts the *plan itself* on trial — multiple agents argue against it from assigned perspectives, a synthesizer keeps what holds, drops what doesn't, and iterates.

## Why this exists

A single-perspective plan tends to optimize for whatever the writer is paying attention to. Plans that survive multiple hostile perspectives in parallel — performance hawk, simplicity advocate, security skeptic, prior-incident analogue — are systematically harder to break. The cost of running a few short debate rounds is small compared to the cost of executing a flawed plan against shared state.

## When to use

- User explicitly invokes: `/council`, `/council <task link>`, `/council <text context>`, or natural phrasing like "council this", "council the spec at X", "put this on trial".
- User asks for a plan whose downside is irreversible or expensive: production migrations, architecture pivots, refactors of load-bearing code, security-sensitive flows.
- User has an existing plan (file path or pasted text) and wants it stress-tested before execution.
- A debugging task where the wrong root-cause hypothesis costs a long detour.

## When NOT to use

- Trivial tasks (renames, single-file bug fixes, doc tweaks) — overkill, just do them.
- Pure exploration / research questions — use `Explore` or normal tools.
- User wants user-driven interrogation rather than agent-vs-agent debate — use `grill-me`.

---

## Workflow

### Step 1 — Parse the invocation

Extract the argument after `/council`. The argument format is:

```
/council [key=value ...] <context>
```

Recognized keys (whitelist — anything else is treated as part of context):
- `rounds=<N>` — override default round count
- `roles=<csv>` — explicit role list, comma-separated (e.g., `roles=simplicity,performance,security`)
- `strategy=red-blue` — swap to red-blue prompt structure (the only non-default strategy that materially changes prompts; all other strategy variants are noted in `references/debate-strategies.md` for advanced manual use)

Parse: split on whitespace, take leading tokens matching `^(rounds|roles|strategy)=\S+$` as config; everything after the last config token is `<context>`.

- Values are bare — no quoted CSV. `roles=simplicity,performance,security` is OK; `roles="simplicity, performance"` is rejected (token contains a quote → treated as context, parser warns once).
- If a token *looks* like config (`foo=bar`) but the key isn't recognized, ignore it as config and treat as context, then tell the user once: *"Unknown config key `foo`, ignored. Recognized: rounds, roles, strategy=red-blue."*

Classify `<context>`:
- **URL** — matches a known pattern (see `references/context-fetching.md`).
- **Local file path** — looks like a path AND `Read` succeeds.
- **Plain text** — anything else, including empty (then ask the user what to plan).

If no argument at all, ask: *"What should the council deliberate on? Paste context, URL, or file path."*

### Step 2 — Fetch context

Per type:

- **URL** — detect host, route to the matching tool. Mapping + precedence in `references/context-fetching.md`. If the required MCP/CLI is not available in this environment, tell the user and ask them to paste the relevant content.
- **File** — `Read` it.
- **Text** — use as-is.

**Context-floor guard** — if after Step 2 the fetched/provided context is under ~30 words, abort:

> *Council needs concrete context to deliberate on. The input I have is too thin (`<n>` words). Paste more detail — constraints, deadline, prior attempts, stakes — then re-invoke.*

Don't run a council on vapor.

After fetching, summarize the context in 1–2 lines so the user can correct if the wrong thing was fetched.

### Step 3 — Classify the task and propose the council

Classify (rough buckets, not strict):

- **implementation** — write code, refactor, migrate
- **debugging** — diagnose a bug, rank root causes
- **architecture** — design choice, system layout, tech selection
- **product-strategy** — product/process/strategy decisions with no immediate code

Compose the council:

- **Strategy** — default is *debate rounds*; switch to *red-blue* only if the user passed `strategy=red-blue` or the task is clearly security/rollback-shaped (untrusted input, threat model, migration with rollback risk). Other strategies in `references/debate-strategies.md` are advanced — don't switch without strong reason.
- **Roles** — pick 3–5 perspectives from `references/council-roles.md` matching the task type. Skip overlap (e.g., simplicity + pragmatist is redundant; pick one).
- **Rounds** — default 2 (early-stop allowed; see Step 4 convergence check). User can override via `rounds=N`.

**Confirmation policy:**
- If user passed any overrides → announce the config in one line; proceed without asking.
- If using all defaults → announce config in one line; proceed without asking.
- If your task-classification feels uncertain (e.g., the context could go either implementation or architecture) → ask one focused question, *don't* dump the full menu.

Example announce:
> *Council: 4 agents (simplicity / performance / test-coverage / pragmatist), debate rounds, default 2 rounds with early-stop. Starting now.*

### Step 4 — Run the debate rounds

For each round 1..N:

1. **Spawn council agents in parallel** in a single message via the `Agent` tool with `subagent_type: general-purpose`. Example call shape:
   ```
   Agent(
     description="Council critic — simplicity",
     subagent_type="general-purpose",
     prompt=<role charter + context + prior critiques + output format>
   )
   ```
   Send all critics as separate tool calls in the same assistant message — they run concurrently.

   **Inline-fallback (when `Agent` tool is not available):** subagents in Claude Code generally do **not** have the `Agent` tool — it's a top-level capability. When this skill is invoked from inside another subagent (a benchmark harness, another skill, a delegated task), the `Agent` tool will be missing. In that case, run each critic **inline in sequence** in the main thread under their exact role charter. The skill's quality contract (forced diverse roles, evidence-only rule, tie-break rubric, verification self-check) is preserved; only wall-clock parallelism is lost. Note the fallback in the transcript so the user knows.

2. **Per-agent prompt must include:**
   - **Task context** — round 1: verbatim from Step 2. Round N+1: a *digest* of the context (max 300 words, hard cap — count before sending; if over, truncate and append `[…digest truncated]`) plus the current plan draft. Don't re-pass the full original after round 1.
   - **Current plan draft** — empty on round 1; the synthesized output of round N-1 otherwise.
   - **Their assigned role + charter** — copied verbatim from `references/council-roles.md`. Each charter has a "How to find" line that tells the agent where to look.
   - **Prior round's critique digest** — main thread's tight summary, not the full round-N-1 outputs.
   - **Adversarial instruction** — surface concrete failure modes only. Each critique must name *what breaks*, *under what condition*, and either *evidence* or *a test that would expose it*.
   - **Evidence-only rule (CRITICAL — saves tokens, raises signal):** every critique must cite **validated data** — content present in the plan draft, the fetched context, a file the agent read, a public spec/changelog/issue, or a documented limit. If the critic doesn't have evidence for a claim, the critic **skips that line** rather than speculating. No "what if the user has X" hypotheticals, no "this *might* fail at scale" without a cited limit, no invented stakeholder concerns. A short critique with 3 evidence-backed lines beats a long critique with 8 speculative ones. The synthesizer rejects un-cited critiques outright in the tie-break rubric (treat speculation as if `## Confidence` were `low` regardless of self-rating).
   - **Output format** — markdown sections: `## My critique`, `## My proposed change`, `## Confidence` (low/medium/high + 1-sentence why). Cap output at ~400 words.

3. **Escalation rule for round N≥2** — include in each agent's prompt:

   > Round N+1 critiques must do one of these four things w.r.t. round N's accepted critiques:
   > (a) cite a specific accepted critique and narrow its failure condition (smaller, more specific repro)
   > (b) cite a specific accepted critique and widen its blast radius (where else this fails)
   > (c) concede the prior critique with a one-line reason and move on
   > (d) open a new attack surface IFF its role *dimension* (the perspective the role represents) was absent from round N-1's council. Don't smuggle a same-dimension issue under (d).
   >
   > This prevents shallow noise in later rounds while leaving room for genuine new dimensions.

4. **After all agents return — synthesize:**
   - Read every critique. Cluster overlapping ones into single issues.
   - For each issue, apply the **ordered tie-break rubric**:
     1. Prefer the critique that names a Verification-grade signal — a string a grep would match: file path, function name, metric name, command with flags, URL, error string. Generic phrases ("the rollback test", "monitoring") do not qualify.
     2. Then the critique with higher **blast radius**, defined numerically: count of call sites, services, or user segments affected if the fix is misapplied. Use the highest plausible count when in doubt.
     3. Then the critique with lower **reversal cost** (cheaper to undo if applied wrongly).
     4. Otherwise, don't pick — surface both in the plan's "Risks & tradeoffs" section as an explicit unresolved tradeoff.
   - Apply the chosen critiques to produce the **next plan draft**.

5. **After synthesis, log a one-line diff:**
   > Round N: applied K changes, dropped M critiques, net_edit_count=K. *<plus a one-line summary of biggest change>*

   Emit this line to the user (progress reporting).

6. **Convergence early-stop check** — after each round, apply the **severity-weighted stop**:
   - If **no critique applied this round** carried `high` confidence AND named a Verification-grade signal (see rubric rung 1) → stop. The plan is converged.
   - If every critic in this round restated a critique from the prior round (no new substance) → stop. Diminishing returns.
   - Otherwise continue to round N+1 (until round budget reached).

   *Counting edits is not the metric — severity is. A round of 5 cosmetic edits should still stop; a round of 1 critical edit with named verification should continue.*

7. **Anti-degeneracy escalation** — fires only when **no concrete critique** was raised by ANY critic this round (i.e., every critic either said "looks good" or produced only vague vibes). Concessions under rule (c) are legitimate output and do **not** trigger this rule by themselves. If the trigger fires, run one more round with the prompt: *"Assume this plan WILL fail in production. Write the post-mortem. What broke, when, and what should have been caught?"* If still nothing, then converge.

Run rounds sequentially. The synthesizer is *you* (the main thread) — don't delegate synthesis to a subagent; coherence lives there.

### Step 5 — Write the plan file

Final synthesis goes to a markdown file.

**Path resolution (no user prompting):**

Check each candidate with `Bash` `test -d <path>` (first that returns 0 wins — don't assume):

1. `~/.claude/plans/` — global host dir
2. `./.claude/plans/` — project-local dir in cwd
3. `./` cwd as last resort (write `./council-<slug>.md`)

Filename: `council-<short-kebab-slug>.md`. Slug derived from the task topic (e.g., `council-event-ingestion-migration.md`).

**Plan structure (required):**

```
# <Title>

## Context
## Recommended approach
## Risks & tradeoffs       (folded-in surviving critiques + explicit unresolved tradeoffs)
## Verification             (how to test the plan worked end-to-end)
```

**Verification self-check** — before writing the file, verify the Verification section contains *at least one* **named** signal. "Named" = a string a grep would match — file path, function name, metric name, command with flags, URL, or error string. Generic phrases like "the rollback test" or "monitoring" do **not** qualify. Examples that DO qualify:
- a named test: `migration_rollback_test`
- a named metric: `p99 latency on /api/jobs`
- a named command: `kubectl rollout status deploy/auth-svc -n prod`
- a concrete observable signal: `no auth_failure errors in Sentry for 24h post-rollout`

If none, the synthesizer (you) adds at least one before writing. A plan without an observable verification is a plan that can't tell you it failed.

### Step 6 — Report back

In your final user-facing message:

- Path to the plan file.
- 2–3 line summary of what changed across the rounds (e.g., *"Round 1 surfaced two failure modes around DB hot-shard contention; round 2 dropped the read-replica idea in favor of write-side sharding."*)
- One question: *"Run `/execute-plan` on it, or refine further?"*

---

## Configuration knobs

- `rounds=<N>` — round count (default 2, with early-stop)
- `roles=<csv>` — explicit role list (overrides auto-composition)
- `strategy=red-blue` — swap to red-blue prompt shape (default: debate rounds)

Examples:
- `/council rounds=4 <text>` — go deeper
- `/council roles=security,simplicity,scalability <url>` — explicit roles
- `/council strategy=red-blue <url>` — red-blue for security/rollback tasks
- `/council` — pure defaults, ask user for context

Unknown keys are ignored with a one-line warning.

---

## Anti-patterns to avoid

- **Don't let the council degenerate into agreement** — if every agent in a round says "looks good," trigger the post-mortem prompt (Step 4.7) before declaring convergence.
- **Don't synthesize naively** — taking the union of all critiques produces a bloated plan. Apply the tie-break rubric.
- **Don't drop a critique just because only one agent raised it** — lone strong critiques beat majority weak ones. Confidence + concreteness beat consensus. When dropping a lone critique, log the reason in the round diff so it's auditable.
- **Don't be swayed by loudest confidence** — apply Step 4.4 rung 1: a verification-bearing "medium" beats a vague "high." The rubric is the procedure; don't override it.
- **Don't accept speculative critiques** — if a critic raises a failure mode without citing validated data (plan content, fetched context, file read, public spec, documented limit), the synthesizer drops it. Speculation burns tokens for no signal. The evidence-only rule is the most important constraint on critic output — preserve it across rounds.
- **Don't skip the Verification section content check** — a heading without observables is theater.
- **Don't run rounds in series of subagents-calling-subagents** — flat parallel dispatch per round; the main thread is the synthesizer.
- **Don't re-pass full original context to every round** — after round 1, pass a digest. Token budget matters.
- **Don't block on the user for path resolution** — use the default path policy.

---

## Reference files

Load these when needed:

- `references/debate-strategies.md` — strategies and selection guidance (mostly informational; default workflow uses debate rounds)
- `references/council-roles.md` — perspectives + role charters (each charter has a "How to find" line)
- `references/context-fetching.md` — URL pattern → tool mapping with precedence

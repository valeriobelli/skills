# Council roles

Perspectives to assign each council agent. Pick 3–5 per task. Each role has a one-paragraph **charter** that goes into the agent's prompt verbatim — it tells the agent *what to attack* and *how to find issues*.

## How to use this file

When composing the council in Step 3 of SKILL.md:

1. Pick the task type section below.
2. Choose 3–5 roles that *don't substantially overlap*. (e.g., simplicity + pragmatist is redundant; simplicity + performance is complementary.)
3. Add at most one domain-specific role if the task has unusual constraints not covered by the standard set.
4. Copy the role's charter into each subagent's prompt — **the `How to find` line is mandatory**; without it, the agent will produce vague attacks.

If the user explicitly listed roles, use exactly those (don't try to "improve" the list — they know their task better than the defaults).

> **A note on diversity limits.** The `How to find` lines steer *search strategy*, but every critic still receives the same plan draft and the same context. When the plan is short and concrete (a few paragraphs), critics with different roles often converge on the same 2–3 obvious weaknesses. Diversity of *findings* improves with plan length and surface area — don't expect orthogonal critiques from short plans.

> **Evidence-only rule (applies to every charter below).** Every critique a critic writes must cite **validated data**: text present in the plan draft, the fetched task context, a file the critic read, or a publicly documented limit/spec/changelog. If the critic doesn't have evidence for a claim, the critic skips that line. No hypothetical "this might fail at scale," no invented stakeholder concerns, no "what if X happens" without X being grounded. The synthesizer treats un-cited critiques as low-confidence regardless of self-rating. Speculation burns tokens for no signal.

---

## Implementation plans

### simplicity
**Charter:** You are the simplicity advocate. Attack overengineering, premature abstraction, speculative flexibility, and "while we're at it" scope creep. If the plan reaches for an abstraction (factory, registry, plugin layer), demand evidence that more than one concrete case exists today. Vague "future flexibility" is not a valid answer.
**How to find:** Walk through the plan and for every new file/class/abstraction, ask "what concrete case forced this *today*?" Flag any that exist only because the author imagined a second case. Grep for words like `Factory`, `Manager`, `Helper`, `Strategy`, `Provider` — each is suspect until justified.

### performance
**Charter:** You are the performance hawk. Identify hot paths, N+1 query risks, allocations in tight loops, blocking I/O on request paths, and synchronous work that should be async. Be specific about which file/function/loop and what scale of traffic exposes the issue. Don't optimize prematurely — only attack performance issues that bite at realistic load.
**How to find:** Trace one request from entry to response through the plan's described code path. Count: DB queries, network calls, allocations of unbounded size, serializations. For each, ask "what's the per-request cost at peak QPS the user named?" Flag anything that grows with input size where it shouldn't.

### test-coverage
**Charter:** You are the test-coverage skeptic. For every behavior change in the plan, ask: "how will we know this worked, and how will we know if it later regressed?" Propose specific test names + assertions, not vague "add tests" language.
**How to find:** Make a list of every behavior the plan adds or changes. For each, write down: (a) the smallest unit test that proves it works, (b) the integration test that proves it composes with neighbors, (c) the regression test that would have caught the bug this fixes. Flag any row that's blank.

### pragmatist
**Charter:** The plan must ship. Attack: blockers that aren't acknowledged, dependencies on other teams/PRs, environment setup that isn't actually done yet, and steps that depend on information the author doesn't have. Don't critique the design — critique the *delivery*. Name what could stall this for a week.
**How to find:** Scan the plan for strings: `TODO`, `pending`, `blocked on`, `depends on`, `we need`, `assuming`, `if X happens`. For each match, name the unstated prerequisite and who owns it. Also check any linked tickets (Asana/GitHub/Notion) for status — `In progress` or `Backlog` on a prereq is a stall risk. List every external dependency.

---

## Debugging hypotheses

### alternative-hypothesis
**Charter:** The plan/diagnosis points at one root cause; your job is to surface *at least one other plausible cause* that fits the same evidence. If you can't find one, say so explicitly — that itself is information.
**How to find:** List the symptoms (not the diagnosis). For each symptom, brainstorm 2 mechanisms that would produce it. Discard mechanisms ruled out by other evidence in the prompt. What remains is your alternative pool.

### instrumentation
**Charter:** The plan diagnoses, but can it be *confirmed before* fix code lands? Identify what logs, metrics, traces, or repro steps would distinguish the proposed root cause from alternatives. If the diagnosis can't be independently confirmed, the fix is a gamble.
**How to find:** Read the diagnosis and ask: "what signal, that I could check today, would tell me this is right vs. wrong?" If the answer is "we'll know after we ship the fix," that's a failure. Name specific log lines, metric names, dashboard URLs, or repro commands.

### prior-bug-analogue
**Charter:** Look for prior bugs in the same area (or class of system) with similar symptoms. The plan's diagnosis is more credible if it matches a known failure mode and less credible if it doesn't.
**How to find:** If you have repo access, grep commit messages and changelogs for the affected system. Look for words like "regression," "race," "OOM," "init order," etc. Without repo access, generalize: name 2 well-known bugs in this stack/library that produce similar symptoms.

### occam
**Charter:** The diagnosis should match Occam's razor: fewest assumptions, most direct mechanism. If the plan posits a complex multi-step failure (race condition + config drift + library bug), demand the simpler alternative was ruled out first.
**How to find:** Count the assumptions the diagnosis requires. Compare against the alternatives produced by `alternative-hypothesis`. Pick the one with fewest. Flag if the plan picks a higher-assumption diagnosis without ruling out the simpler one.

### blast-radius
**Charter:** If the fix is wrong, what breaks? If the diagnosis is wrong, what other places might have the same root cause? Critique fixes that touch only the symptom site when the root cause likely affects multiple call sites.
**How to find:** Grep the codebase for the same pattern that produced the bug — same library call, same race-prone idiom, same input validation gap. Flag the count. If >1, the fix should be a class-fix, not a point-fix.

---

## Architecture

### scalability
**Charter:** Apply the proposed architecture to 10x and 100x the current load. What breaks first? What requires the most operational toil? Be specific about the bottleneck.
**How to find:** Pick the most stateful component in the design (DB, broker, cache). Compute: storage at 10x, write throughput at 10x, fanout at 10x. Compare against published limits of the chosen technology. Flag any 10x projection that exceeds documented single-instance limits.

### complexity-budget
**Charter:** Every new component costs ongoing operational and cognitive effort. Demand the plan name *which existing thing this replaces* or *what specific failure mode the added complexity prevents*. "Future flexibility" is not a valid answer.
**How to find:** Count the operational primitives the design adds (services, queues, brokers, caches, stores, IAM roles, monitors). For each, ask "who owns its on-call, who knows its failure modes, what does it cost?" Flag any added without a paired removal or a named justification.

### vendor-lock-in
**Charter:** Identify lock-in to vendors, proprietary protocols, paid SaaS, or single-vendor cloud features. For each, name the realistic cost of switching later. Lock-in is acceptable when conscious and bounded — flag when it's invisible.
**How to find:** Scan the design for vendor-specific APIs, proprietary file formats, SaaS dependencies, and cloud-managed services. For each, write down "if we needed to switch off this in 2 years, how many engineer-weeks?" Flag anything where the answer is "we couldn't reasonably."

### evolvability
**Charter:** The plan is for *this* requirement; will it still make sense after the next two requirements? Identify decisions that lock in a structure that's hard to change. Conversely, attack speculative flexibility that's pure cost today against a future that may never arrive.
**How to find:** Grep the plan for irreversible decisions: schema migrations, public API shapes, contract changes, naming that leaks abstractions. For each, write down the migration path if the requirement changes. Flag rows where the path is "rewrite."

### consistency-and-failure-modes
**Charter:** For any distributed system change: what are the consistency guarantees during normal operation and during partial failures? Identify split-brain risks, dual-write hazards, retry storms, and unsafe defaults.
**How to find:** Walk through 3 failure scenarios: (1) network partition between components, (2) component A crashes mid-write, (3) downstream consumer slow/dead. For each, ask: "what's the system state when the dust settles? Consistent? Lossy? Duplicated?" Flag any scenario where the answer is "depends" without a written guarantee.

---

## Product / strategy

### user-cost
**Charter:** Every product/process change has a cost on users (downtime, learning, friction, surprises). Name the specific user segments affected, how, and whether the plan acknowledges the cost.
**How to find:** Enumerate user segments touched (by role, by usage pattern, by tier). For each, list one concrete cost the change imposes. Flag any segment the plan doesn't acknowledge.

### distribution
**Charter:** Even a great change is useless if it doesn't reach users — discoverability, rollout, comms, migrations. Identify the distribution gaps in the plan.
**How to find:** Ask "how does a user find out about this?" and "how does a user opt in / migrate to it?" If the answers are silent or "they'll figure it out," that's the gap.

### opportunity-cost
**Charter:** If we do this, what else doesn't happen? The plan's value is its delta over the next-best alternative, not its absolute value.
**How to find:** Sum the plan's steps; estimate engineer-weeks as `0.5–1 week per step` baseline, more for steps that touch shared infra or require cross-team coordination. Check the team's roadmap (Asana board, README, recent PRs) for what's currently in-flight or queued — name 2 candidates that fit in the same budget. Ask: "is the plan clearly better than either alternative?" Flag if the answer isn't obvious.

### second-order-effects
**Charter:** What happens *after* this change becomes routine? Identify behaviors users/teams will adapt to it (perverse incentives, Goodhart's law, gaming, dependency formation).
**How to find:** Take the metric or behavior the change targets. Ask: "if users optimize for this, what's the cheapest way to game it?" Flag any adaptation pathway that produces the wrong outcome.

---

## Domain-specific (add at most one)

When the task has unusual constraints — mobile platform, hardware, regulation, internationalization, accessibility — add a domain-specific role. Compose its charter following the same shape: *who you are, what to attack, demand specifics, what's a non-answer*, plus a `How to find` line.

Examples:
- **mobile-platform** for React Native / iOS / Android specifics.
- **compliance** for GDPR / HIPAA / SOC2 / financial regulation.
- **a11y** for accessibility.
- **i18n** for translations / locale-specific edge cases.
- **realtime** for latency-bound systems with hard SLAs.

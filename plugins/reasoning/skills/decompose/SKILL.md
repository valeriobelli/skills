---
name: decompose
description: Turn one large, vague, or abstract task into a reviewed set of small executable tasks on a board. MUST be invoked when the user types `/decompose` (with or without arguments) or phrases the request as breaking work down — "split this into tasks", "decompose this epic", "break this down into subtasks", "turn this spec into a backlog". Runs three gated phases — rough decomposition, one-question-at-a-time interrogation of each subtask, then writing to a board (Backlog.md locally or an external task manager over MCP, user picks at the end). Do NOT invoke for tasks already small and well-specified, for stress-testing an existing plan (that's `council`), or for pure research questions.
---

# decompose

Take a task too abstract to start on, and turn it into a set of small, independently executable tasks with real acceptance criteria — each one interrogated with the user before it's allowed onto a board.

## Why this exists

An abstract task fails in a predictable way: it gets "decomposed" into subtasks that are just the abstract task restated in five pieces, each still carrying every unresolved assumption. The subtasks look actionable, so work starts, and the assumptions surface halfway through implementation when they're expensive.

The fix is a gate between decomposition and execution. Every subtask has to survive being questioned — about scope, assumptions, dependencies, and what "done" means — *before* it becomes a card. Where `council` puts a finished plan on trial with agents arguing against it, `decompose` interrogates the user, one question at a time, because the missing information lives in their head and not in the repo.

## When to use

- User invokes `/decompose`, `/decompose <text>`, `/decompose <file path>`, `/decompose <URL>`.
- User has an epic, spec, RFC, or vague ambition and needs it turned into workable tasks.
- User says the work is "too big to start" or they "don't know where to begin".
- User wants a set of tasks on a board that an agent can pick up one at a time.

## When NOT to use

- The task is already small and specified — just do it.
- The user has a plan and wants it stress-tested — use `council`.
- Pure research or exploration — use normal tools.
- The user wants a single task written up, not a breakdown — write it directly with the backend CLI.

---

## Core rules (do not violate)

These three rules are what makes this skill worth running. Breaking any of them turns it into an expensive way to generate a to-do list.

1. **One question at a time.** Present exactly one question, stop, and wait for the user's answer before the next. Never batch questions into a numbered list and never move on unanswered.
2. **Derived answers are suggestions, never defaults.** You may research the repo and propose an answer alongside the question, clearly marked as *your* finding. It is never accepted automatically, never pre-filled, and silence is not agreement. The user answers every question, including the ones you think you already know the answer to.
3. **Nothing is written to a board before Phase 3 confirmation.** No task creation, no project creation, no partial writes as you go. The board is touched once, at the end, after the user has seen the full set and picked a destination.

---

## Workflow

### Phase 0 — Parse and gather context

Extract the argument after `/decompose`. Classify it:

- **Local file path** — `Read` it.
- **URL** — fetch with whatever tool matches the host (WebFetch, or an MCP connector if one in this session covers that host). If the required tool isn't available, say so and ask the user to paste the content.
- **Plain text** — use as-is.
- **Empty** — ask: *"What should I decompose? Paste the task, a file path, or a URL."*

Then orient yourself in the codebase before proposing anything: read the project's `README`, `AGENTS.md`/`CLAUDE.md`, and the directories the task plausibly touches. A decomposition written without looking at the code produces generic tasks.

Summarize the input in 1–2 lines so the user can correct a wrong fetch before you spend their time.

**Thinness guard** — if the context is under ~25 words and the user gave no file or URL, don't guess. Ask one open question about what they're actually trying to achieve, and use their answer as the input.

### Phase 1 — Rough decomposition (overview)

Produce a *shallow* first cut: **5–12 candidate subtasks**, each one line, no detail yet. The goal is to get the shape of the work in front of the user fast, not to be right.

Rules for the cut:
- Each candidate should be completable in one focused session — one context window, one PR.
- Split by **deliverable**, not by activity. "Add the migration" and "write tests for the migration" are one task; "migrate the user table" and "migrate the orders table" are two.
- Mark candidates you're unsure about with `?` rather than silently dropping them.
- Note obvious ordering constraints in a single line under the list, not per task.

Present as a plain numbered list, then ask **one** question:

> *"Does this cover the work? Add, remove, merge, or split anything before I start going through them one by one."*

Iterate on the list until the user accepts it. Don't proceed to Phase 2 on silence — get an explicit go-ahead.

### Phase 2 — Interrogation, one subtask at a time

This is the expensive phase and the reason the skill exists. Work through the accepted list **in order, one subtask at a time**. Announce which one you're on and how many remain:

> *"Subtask 3 of 8 — 'Extract the rate limiter into a shared package'. 5 to go after this."*

For each subtask, work through the dimensions in `references/grilling.md`. That file holds the question bank and the rules for choosing which dimensions apply — read it at the start of Phase 2 and keep it in mind for every subtask. Not every dimension applies to every subtask; skipping an irrelevant one is correct, skipping an uncomfortable one is not.

**Question format.** One question per message. When you have a repo-derived candidate answer, present it like this:

> **Scope** — Does this include the React Native side, or web only?
>
> *From the repo:* `packages/rate-limit` is imported by `apps/web` only — no RN imports. Suggests web-only, but I'd rather you confirm than assume.

Then stop. Wait.

**Handling answers:**
- **Answered** — record it, move to the next question.
- **"I don't know" / "you decide"** — this is a real answer and a useful signal. Don't decide silently. Offer the two or three concrete options with their consequences and ask which one. If they still don't know, record it as an **open question** on the task rather than inventing an answer. A task shipped with a flagged unknown is honest; one shipped with a fabricated decision is not.
- **An answer that invalidates the subtask** — say so immediately and ask whether to drop it, merge it, or split it. Update the Phase 1 list and carry on.
- **An answer that reveals a missing subtask** — add it to the list, tell the user where in the order it lands, and grill it in turn.

**Per-subtask exit.** Once the dimensions are covered, write the subtask up and show it to the user:

```
Title:        <imperative, specific, one line>
Description:  <2–4 sentences — context and approach, not a restatement of the title>
Acceptance criteria:
  - <verifiable — a named test, a command, an observable behaviour>
  - ...
Depends on:   <other subtasks, or none>
Open questions: <only if genuinely unresolved>
```

Ask: *"Good, or fix something?"* Then move to the next subtask.

**Acceptance-criteria check** — before showing a subtask, verify each criterion names something a grep or a test run could resolve: a file, a function, a command, a metric, an error string, an observable user-facing behaviour. "Works correctly", "is well tested", "performance is acceptable" all fail this check. Rewrite them before showing, don't make the user catch it.

**Fatigue is real.** Eight subtasks at six questions each is a long session. Offer a pause at natural boundaries — *"That's 4 of 8 done. Want to keep going or pick this up later?"* If the user wants to stop, write the state so far to a scratch file (`.claude/decompose-<slug>.md` or the repo root) so the session can resume, and tell them the path. Never resolve remaining questions yourself to finish faster.

### Phase 3 — Choose a destination and write

Only now. Present the full set of finalized subtasks as a compact list, then ask **one** question:

> *"Where should these go — Backlog.md in this repo, or an external task manager?"*

Don't guess from context, and don't remember a previous session's choice as a default. Ask every time.

Then read the matching adapter and follow it exactly:

- **Backlog.md** → `references/backend-backlog-md.md`
- **External task manager** → `references/backend-mcp.md`. That adapter works out which task-management MCP tools this session actually has, and asks the user which to use if there's more than one. If there are none, it says so and falls back.

Both adapters take the same internal shape (title, description, acceptance criteria, dependencies, open questions) and map it onto their target. If the chosen backend isn't installed or connected, the adapter says what to tell the user — offer the other backend, or offer to write the set to a markdown file as a fallback so the interrogation work isn't lost.

### Phase 4 — Report

Short. In the final message:

- Where the tasks went (local board path, or the external project name + link).
- Count written, and the IDs if the backend returns them.
- Any subtask carrying an open question, called out by name — these are the ones that will bite.
- One suggested next step: *"`backlog board` to see it"*, or which task to start with and why.

---

## Anti-patterns to avoid

- **Don't batch the questions.** A numbered list of twelve questions gets one blob of half-answers back, which is exactly the outcome this skill exists to prevent. One at a time, every time.
- **Don't treat repo research as an answer.** Research makes your question sharper. It doesn't replace the user's answer. The moment you accept your own finding as the decision, the human is out of the loop.
- **Don't let "you decide" become silent invention.** Surface options and consequences; flag it as open if still unresolved.
- **Don't decompose by activity.** Design / implement / test / document is four tasks that can't ship independently. Split by deliverable.
- **Don't produce subtasks that are the parent task restated.** If every subtask still needs the same unanswered question resolved, the cut is wrong — go back to Phase 1 rather than asking the same question eight times.
- **Don't write to the board as you go.** Half a decomposition on a board is worse than none: it looks complete and isn't.
- **Don't accept vague acceptance criteria.** A criterion nobody can check is a criterion that will be declared met.
- **Don't skip the destination question.** Local vs shared is the user's call and it changes per piece of work.
- **Don't hand-edit backend task files.** Use the backend's CLI or MCP tools so metadata stays consistent.

---

## Reference files

Read these when the workflow points at them:

- `references/grilling.md` — the interrogation dimensions and question bank for Phase 2. Read at the start of Phase 2.
- `references/backend-backlog-md.md` — writing to a local Backlog.md board. Read in Phase 3 if chosen.
- `references/backend-mcp.md` — writing to an external task manager over MCP, whichever connector the session exposes. Read in Phase 3 if chosen.

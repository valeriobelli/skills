---
name: stakeholder-summary
description: Write a short, human-sounding summary of technical work for a non-engineering reader. Use when the user asks for a ticket, release note, changelog entry, status update, or "a summary I can share" — anything whose audience is a PM, designer, or manager rather than the user themselves.
---

# Stakeholder summary

## Ask before writing

Name the gaps out loud instead of guessing at them: who reads this, what counts as the goal, which numbers are measured and which are projected. Invoke `grill-me` when several answers are missing.

## Frame on the goal, not the debugging story

Lead with what is being shipped, in the user's own framing of it.

- Yes: "We're migrating from TypeScript 5.9.7 to v7."
- No: "Typechecking was hanging while compiling the Jest graph, and here's how we fixed it."

The initial broken state, the bugs hit on the way, and the order things were tried are session detail. Leave them out unless the reader needs them to make a decision. When work begins as debugging but lands on an upgrade or migration, the upgrade is the story.

## Separate expected from measured

Give both, labelled:

- **Expected / theoretical** — what the change buys by design.
- **Empirical / measured** — what was actually observed, with the numbers and the command that produced them.

Use units the reader already tracks (wall-clock minutes, CI time, cost), not internal counters. Mark any projection as a projection — never present an expected figure as if it were measured.

## Voice

- Short. A card, not a report.
- Plain human sentences. No "Overview / Background / Conclusion" scaffolding, no restating the request back at them.
- No jargon the audience cannot act on. A PM reads "incremental typechecks run about 5× faster", not "tsc --incremental reuses .tscache across the project graph".
- Use `ASD-STE100` as defined in `references/asd-STE100.md` for sentence structure and readability when discussing technicalities.

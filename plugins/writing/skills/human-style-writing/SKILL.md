---
name: human-style-writing
description: Forces human-sounding prose instead of LLM-like writing, in both Italian and English. Use this skill ONLY when the user explicitly asks for it, with phrases like "write this in a human style", "de-llmify this", "make this sound less like AI", "sounds like AI", "make this sound human", "rewrite without the ChatGPT tics". Covers both rewriting an existing text and generating new text from scratch. Do not trigger on generic writing requests without one of these explicit signals.
---

# Human Style Writing

Goal: eliminate the rhetorical, lexical, and rhythmic patterns typical of LLM-generated prose, in two distinct modes.

This skill only activates on explicit invocation (see triggers in `description`). Once activated, running the verification gate at the end is **mandatory** — it is not an optional guideline.

## Mode 1 — Rewriting an existing text

1. **Diagnosis**: read the text and note, for each of the 6 categories in `references/patterns.md`, which instances are present. Be specific (quote the offending phrase), don't produce a vague judgment.
2. **Targeted rewrite**: fix only the diagnosed instances. Don't rewrite sentences that already sound natural just to "smooth things out" — that risks introducing new tics.
3. Move to the **Verification gate** (below).

## Mode 2 — Generating new text

1. Write the draft applying the principles in `references/patterns.md` directly (don't write "LLM-style" first and fix it after).
2. Move to the **Verification gate** (below).

## Verification gate (mandatory, both modes)

Before delivering the output, run the checklist in `references/checklist.md` against the final text. Count the failed checks.

- **0–2 failures**: deliver the text as is.
- **≥3 failures**: forced rewrite targeting only the failed items, then repeat the gate.
- **Iteration limit**: maximum 2 forced-rewrite cycles. If ≥3 checks are still failing after 2 cycles, deliver the text anyway but explicitly flag to the user which checks still fail and why (e.g. a content constraint makes a list format unavoidable).

Don't mention the gate to the user unless the final warning above kicks in — no routine "I ran the checklist" commentary.

## References

- `references/patterns.md` — the 6 categories of LLM-like patterns, with lexical sub-sections kept separate for Italian and English, plus before/after examples.
- `references/checklist.md` — the operational checklist to run in the verification gate.
